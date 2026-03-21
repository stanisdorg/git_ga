// Утилиты для тестов
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SERVER_SCRIPT = path.join(ROOT_DIR, 'server.js');

let serverProcess = null;
let serverStartTime = null;

/**
 * Логирование для тестов
 */
export function testLog(message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`\n[TEST LOG] ${timestamp} - ${message}`);
  if (Object.keys(data).length > 0) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Получить путь к файлу пользователя
 */
export function getUserDataPath(username) {
  return path.join(DATA_DIR, `user_${username}.json`);
}

/**
 * Прочитать данные пользователя из файла
 */
export function readUserData(username) {
  const filePath = getUserDataPath(username);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Сохранить данные пользователя в файл
 */
export function writeUserData(username, data) {
  const filePath = getUserDataPath(username);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Получить хеш содержимого файла (для проверки изменений)
 */
export function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  // Простой хеш - длина + первые 50 символов
  return `${content.length}:${content.substring(0, 50)}`;
}

/**
 * Запустить сервер
 */
export function startServer(port = 8085) {
  return new Promise((resolve, reject) => {
    testLog('Запуск сервера...', { port, script: SERVER_SCRIPT });
    
    serverProcess = spawn('node', [SERVER_SCRIPT], {
      cwd: ROOT_DIR,
      env: { ...process.env, PORT: port.toString() },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    serverStartTime = Date.now();
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      // Логировать только важные сообщения
      if (output.includes('[SERVER') || output.includes('Error') || output.includes('Listening')) {
        console.log(`[SERVER STDOUT] ${output.trim()}`);
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(`[SERVER STDERR] ${data.toString().trim()}`);
    });
    
    serverProcess.on('error', (err) => {
      reject(new Error(`Failed to start server: ${err.message}`));
    });
    
    // Ждём 2 секунды пока сервер запустится
    setTimeout(() => {
      testLog('Сервер запущен', { pid: serverProcess.pid, startTime: serverStartTime });
      resolve(serverProcess);
    }, 2000);
  });
}

/**
 * Остановить сервер
 */
export function stopServer() {
  return new Promise((resolve) => {
    if (!serverProcess) {
      testLog('Сервер не был запущен');
      resolve();
      return;
    }
    
    testLog('Остановка сервера...', { pid: serverProcess.pid });
    
    serverProcess.on('exit', (code) => {
      testLog('Сервер остановлен', { code, uptime: Date.now() - serverStartTime });
      serverProcess = null;
      serverStartTime = null;
      resolve();
    });
    
    serverProcess.kill('SIGTERM');
    
    // Таймаут на случай если процесс не завершится
    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
        serverProcess = null;
      }
      resolve();
    }, 5000);
  });
}

/**
 * Перезапустить сервер
 */
export async function restartServer(port = 8085) {
  testLog('Перезапуск сервера...');
  await stopServer();
  await startServer(port);
  testLog('Сервер перезапущен');
}

/**
 * Найти карточку по вопросу
 */
export function findCardByQuestion(userData, question) {
  if (!userData || !userData._cards) {
    return null;
  }
  return userData._cards.find(card => card.question === question);
}

/**
 * Проверить, что карточка существует в файле
 */
export function assertCardExists(userData, question, context = '') {
  const card = findCardByQuestion(userData, question);
  if (!card) {
    const availableQuestions = userData?._cards?.slice(0, 5).map(c => c.question.substring(0, 30)) || [];
    throw new Error(
      `${context} Карточка не найдена: "${question.substring(0, 50)}...". ` +
      `Доступные карточки: ${availableQuestions.join(', ')}`
    );
  }
  return card;
}
