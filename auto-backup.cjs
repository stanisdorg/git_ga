const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_BASE_DIR = path.join(DATA_DIR, '_backups');
const MAX_AUTO_BACKUPS = 7; // дней
const BACKUP_INTERVAL_HOURS = 24; // раз в сутки

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function getTodayDateString() {
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

function ensureUserBackupDir(username) {
  const dir = path.join(BACKUP_BASE_DIR, username, 'auto');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Очистка: 1 бэкап на дату, максимум MAX_AUTO_BACKUPS дней
function cleanupOldUserBackups(username) {
  try {
    const autoDir = path.join(BACKUP_BASE_DIR, username, 'auto');
    if (!fs.existsSync(autoDir)) return;

    const backupsByDate = {};

    fs.readdirSync(autoDir)
      .filter(f => f.endsWith('.json'))
      .forEach(filename => {
        const dateMatch = filename.match(/backup_(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const date = dateMatch[1];
          if (!backupsByDate[date]) backupsByDate[date] = [];
          const filePath = path.join(autoDir, filename);
          backupsByDate[date].push({ filename, time: fs.statSync(filePath).mtime.getTime(), path: filePath });
        }
      });

    let deletedCount = 0;

    // Для каждой даты оставляем только 1 бэкап (самый свежий)
    Object.values(backupsByDate).forEach(dayBackups => {
      if (dayBackups.length > 1) {
        dayBackups.sort((a, b) => b.time - a.time);
        dayBackups.slice(1).forEach(backup => {
          if (fs.existsSync(backup.path)) {
            fs.rmSync(backup.path, { force: true });
            deletedCount++;
          }
        });
      }
    });

    // Удаляем старые даты если больше MAX_AUTO_BACKUPS дней
    const dates = Object.keys(backupsByDate).sort().reverse();
    if (dates.length > MAX_AUTO_BACKUPS) {
      dates.slice(MAX_AUTO_BACKUPS).forEach(oldDate => {
        backupsByDate[oldDate].forEach(backup => {
          if (fs.existsSync(backup.path)) {
            fs.rmSync(backup.path, { force: true });
            deletedCount++;
          }
        });
      });
    }

    if (deletedCount > 0) {
      console.log(`[BACKUP] 🧹 Удалено ${deletedCount} дубликатов/старых бэкапов для ${username}`);
    }
  } catch (err) {
    console.warn(`[BACKUP] Warning: Failed to cleanup for ${username}:`, err.message);
  }
}

function createUserBackup(username, userData) {
  try {
    const autoDir = ensureUserBackupDir(username);
    const timestamp = getTimestamp();
    const filename = `backup_${timestamp}.json`;
    const backupPath = path.join(autoDir, filename);

    fs.writeFileSync(backupPath, JSON.stringify(userData, null, 2), 'utf-8');

    const size = fs.statSync(backupPath).size;
    console.log(`[BACKUP] ✅ ${username}: ${(size / 1024).toFixed(2)} KB`);

    cleanupOldUserBackups(username);

    return backupPath;
  } catch (err) {
    console.error(`[BACKUP] ❌ ${username}:`, err.message);
    return null;
  }
}

function createBackup() {
  console.log(`\n[BACKUP] === Запуск авто-бэкапа ===`);
  console.log(`[BACKUP] Частота: раз в сутки, максимум ${MAX_AUTO_BACKUPS} дней`);

  try {
    if (!fs.existsSync(BACKUP_BASE_DIR)) {
      fs.mkdirSync(BACKUP_BASE_DIR, { recursive: true });
    }

    // Сначала чистим дубликаты у всех пользователей
    const allUserDirs = fs.readdirSync(BACKUP_BASE_DIR)
      .filter(d => !d.startsWith('.') && fs.statSync(path.join(BACKUP_BASE_DIR, d)).isDirectory());

    allUserDirs.forEach(username => {
      cleanupOldUserBackups(username);
    });

    const userFiles = fs.readdirSync(DATA_DIR)
      .filter(file => file.startsWith('user_') && file.endsWith('.json') &&
        !file.includes('_metadata') &&
        !file.includes('_trash') &&
        !file.includes('_marathon') &&
        !file.includes('_progress'));

    if (userFiles.length === 0) {
      console.log('[BACKUP] Файлы пользователей не найдены');
      return null;
    }

    const results = [];
    const todayString = getTodayDateString();

    userFiles.forEach(userFile => {
      try {
        const username = userFile.replace('user_', '').replace('.json', '');
        const userFilePath = path.join(DATA_DIR, userFile);

        // Проверяем есть ли уже бэкап за сегодня
        const autoDir = path.join(BACKUP_BASE_DIR, username, 'auto');
        if (fs.existsSync(autoDir)) {
          const todayBackups = fs.readdirSync(autoDir)
            .filter(f => f.endsWith('.json') && f.includes(todayString));

          if (todayBackups.length > 0) {
            console.log(`[BACKUP] ⏭️ ${username}: уже есть за ${todayString}`);
            results.push({ username, success: true, skipped: true });
            return;
          }
        }

        const userData = JSON.parse(fs.readFileSync(userFilePath, 'utf-8'));
        const backupPath = createUserBackup(username, userData);

        results.push({ username, success: !!backupPath, path: backupPath });
      } catch (err) {
        console.error(`[BACKUP] ❌ Ошибка ${userFile}:`, err.message);
        results.push({ username: userFile, success: false, error: err.message });
      }
    });

    const created = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    console.log(`[BACKUP] === Создано: ${created}, пропущено: ${skipped} ===\n`);

    return results;
  } catch (err) {
    console.error('[BACKUP] ❌ Критическая ошибка:', err);
    return null;
  }
}

if (require.main === module) {
  console.log(`[BACKUP] Auto-backup: каждые ${BACKUP_INTERVAL_HOURS}ч, храним ${MAX_AUTO_BACKUPS} дней`);
  console.log(`[BACKUP] Первый бэкап сейчас...\n`);

  createBackup();

  setInterval(() => {
    console.log(`\n[BACKUP] Scheduled backup...`);
    createBackup();
  }, BACKUP_INTERVAL_HOURS * 60 * 60 * 1000);
} else {
  console.log('[BACKUP] Module loaded');
}

module.exports = { createBackup };
