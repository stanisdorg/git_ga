// Серверный логгер с сохранением в файлы
// Без перехвата console для избежания зацикливания

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', 'logs');
const MAX_LOG_FILES = 10;
const MAX_LOG_AGE_HOURS = 24;

// Создаём папку для логов
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let currentLevel = LEVELS.DEBUG;
let logBuffer = [];
let flushTimer = null;

function timestamp() {
    return new Date().toISOString();
}

function getLogFileName() {
    const now = new Date();
    return `server-${now.toISOString().slice(0, 13).replace(/:/g, '-')}.log`;
}

// Ротация логов
function rotateLogs() {
    try {
        const files = fs.readdirSync(LOGS_DIR)
            .filter(f => f.startsWith('server-') && f.endsWith('.log'))
            .map(f => ({ name: f, path: path.join(LOGS_DIR, f), mtime: fs.statSync(path.join(LOGS_DIR, f)).mtime }));
        
        files.sort((a, b) => b.mtime - a.mtime);
        
        const now = Date.now();
        files.forEach((file, index) => {
            const ageHours = (now - file.mtime.getTime()) / (1000 * 60 * 60);
            if (ageHours > MAX_LOG_AGE_HOURS || index >= MAX_LOG_FILES) {
                fs.unlinkSync(file.path);
            }
        });
    } catch (e) {
        console.error('[Logger] Ошибка ротации:', e);
    }
}

setInterval(rotateLogs, 30 * 60 * 1000);

// Сброс буфера
function flushBuffer() {
    if (logBuffer.length === 0) return;
    const logsToWrite = [...logBuffer];
    logBuffer = [];
    try {
        const logPath = path.join(LOGS_DIR, getLogFileName());
        fs.appendFileSync(logPath, logsToWrite.join('\n') + '\n', 'utf8');
    } catch (err) {
        console.error('[Logger] Ошибка записи в файл:', err);
    }
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushBuffer();
        flushTimer = null;
        scheduleFlush();
    }, 5000);
}

// Основная функция логирования
function log(level, message, data = null, context = 'server') {
    if (level < currentLevel) return;
    const levelName = Object.keys(LEVELS).find(k => LEVELS[k] === level) || 'UNKNOWN';
    const ts = timestamp();
    const logLine = `${ts} [${levelName}] [${context}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}`;
    logBuffer.push(logLine);
    scheduleFlush();
    
    // Вывод в консоль
    const consoleMethod = level === LEVELS.ERROR ? 'error' : level === LEVELS.WARN ? 'warn' : 'log';
    if (data) {
        console[consoleMethod](`[${levelName}] [${context}] ${message}`, data);
    } else {
        console[consoleMethod](`[${levelName}] [${context}] ${message}`);
    }
}

export const logger = {
    debug: (msg, data, ctx) => log(LEVELS.DEBUG, msg, data, ctx),
    info: (msg, data, ctx) => log(LEVELS.INFO, msg, data, ctx),
    warn: (msg, data, ctx) => log(LEVELS.WARN, msg, data, ctx),
    error: (msg, data, ctx) => log(LEVELS.ERROR, msg, data, ctx),
    setLevel: (level) => { currentLevel = level; },
    
    getLogs: (options = {}) => {
        const { limit = 1000, level = 'DEBUG', context = null, search = null, since = null } = options;
        try {
            // Файлы сортируем от новых к старым
            const files = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('server-') && f.endsWith('.log')).sort().reverse();
            const allLines = [];
            const minLevel = LEVELS[level] || LEVELS.DEBUG;

            for (const file of files) {
                const content = fs.readFileSync(path.join(LOGS_DIR, file), 'utf-8');
                // Строки читаем с конца (новые первыми)
                const lines = content.split('\n').filter(l => l.trim()).reverse();
                for (const line of lines) {
                    const match = line.match(/^(\S+)\s+\[(\w+)\]\s+\[(\w+)\]\s+(.+?)(?:\s+\|\s+(.+))?$/);
                    if (!match) continue;
                    const [, ts, lvl, ctx, msg, dataStr] = match;
                    if (LEVELS[lvl] < minLevel) continue;
                    if (context && ctx !== context) continue;
                    if (search && !msg.toLowerCase().includes(search.toLowerCase())) continue;
                    if (since && ts < since) continue;
                    allLines.push({ timestamp: ts, level: lvl, context: ctx, message: msg, data: dataStr ? JSON.parse(dataStr) : null });
                    if (allLines.length >= limit) break;
                }
                if (allLines.length >= limit) break;
            }
            // Возвращаем в правильном порядке (старые → новые)
            return allLines.reverse();
        } catch (e) {
            return [];
        }
    },
    
    clearLogs: () => {
        try {
            const files = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('server-') && f.endsWith('.log'));
            files.forEach(f => fs.unlinkSync(path.join(LOGS_DIR, f)));
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    },
    
    getStats: () => {
        try {
            const files = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('server-') && f.endsWith('.log'));
            const totalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(LOGS_DIR, f)).size, 0);
            return { files: files.length, totalSizeBytes: totalSize };
        } catch (e) {
            return { error: e.message };
        }
    }
};

logger.info('Логгер инициализирован', { logsDir: LOGS_DIR });
export default logger;
