const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'data', '_backups');
const DATA_DIR = path.join(__dirname, 'data');
const MAX_BACKUPS = 7;
const BACKUP_INTERVAL_HOURS = 6;

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }

  fs.readdirSync(from).forEach(element => {
    if (element === '_backups') return;

    const stat = fs.lstatSync(path.join(from, element));
    const dest = path.join(to, element);
    const src = path.join(from, element);

    if (stat.isFile()) {
      fs.copyFileSync(src, dest);
    } else if (stat.isDirectory()) {
      copyFolderSync(src, dest);
    }
  });
}

function cleanupOldBackups() {
  try {
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_'))
      .map(file => ({
        name: file,
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      toDelete.forEach(backup => {
        const backupPath = path.join(BACKUP_DIR, backup.name);
        fs.rmSync(backupPath, { recursive: true, force: true });
        console.log(`[BACKUP] Удалён старый бэкап: ${backup.name}`);
      });
    }
  } catch (err) {
    console.warn('[BACKUP] Warning: Failed to cleanup old backups:', err.message);
  }
}

function createBackup() {
  const timestamp = getTimestamp();
  const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}`);

  console.log(`[BACKUP] Starting backup to: ${backupPath}`);

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    copyFolderSync(DATA_DIR, backupPath);

    const size = fs.readdirSync(backupPath)
      .reduce((acc, file) => {
        const stat = fs.statSync(path.join(backupPath, file));
        return acc + (stat.isFile() ? stat.size : 0);
      }, 0);

    console.log(`[BACKUP] ✅ Backup completed: ${(size / 1024).toFixed(2)} KB`);

    cleanupOldBackups();

    return backupPath;
  } catch (err) {
    console.error('[BACKUP] ❌ Backup failed:', err);
    return null;
  }
}

if (require.main === module) {
  console.log(`[BACKUP] Auto-backup every ${BACKUP_INTERVAL_HOURS} hours`);
  console.log(`[BACKUP] Max backups: ${MAX_BACKUPS}`);
  console.log(`[BACKUP] First backup starting now...\n`);

  createBackup();

  setInterval(() => {
    console.log(`\n[BACKUP] Scheduled backup starting...`);
    createBackup();
  }, BACKUP_INTERVAL_HOURS * 60 * 60 * 1000);
} else {
  console.log('[BACKUP] Module loaded');
}

module.exports = { createBackup };
