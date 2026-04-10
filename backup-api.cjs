const fs = require('fs');
const path = require('path');

const BACKUP_BASE_DIR = path.join(__dirname, 'data', '_backups');
const MAX_AUTO_BACKUPS = 7;
const BACKUP_INTERVAL_HOURS = 24;

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function ensureUserBackupDir(username, type) {
  const dir = path.join(BACKUP_BASE_DIR, username, type);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function getBackupInfo(filePath) {
  const stat = fs.statSync(filePath);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const info = {
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
    hasCards: !!content._cards,
    hasProgress: !!content._achievements || !!content._stats || !!content._srsProgress,
    cardsCount: content._cards ? content._cards.length : 0,
    categoriesCount: content._cards ? new Set(content._cards.map(c => c.category)).size : 0,
    achievementsCount: content._achievements ? Object.keys(content._achievements).length : 0,
  };

  return info;
}

// ==================== АВТОМАТИЧЕСКИЕ БЭКАПЫ ====================

function createAutoBackup(username, userData) {
  try {
    const autoDir = ensureUserBackupDir(username, 'auto');

    // Удаляем старые бэкапы если достигли лимита
    const existingBackups = fs.readdirSync(autoDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(autoDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    while (existingBackups.length >= MAX_AUTO_BACKUPS) {
      const oldest = existingBackups.pop();
      fs.unlinkSync(path.join(autoDir, oldest.name));
    }

    const filename = `backup_${getTimestamp()}.json`;
    const backupPath = path.join(autoDir, filename);

    fs.writeFileSync(backupPath, JSON.stringify(userData, null, 2), 'utf-8');

    console.log(`[BACKUP] Auto backup created for ${username}: ${filename}`);
    return { success: true, filename };
  } catch (err) {
    console.error(`[BACKUP] Auto backup failed for ${username}:`, err);
    return { success: false, error: err.message };
  }
}

// ==================== РУЧНЫЕ БЭКАПЫ ====================

function createManualBackup(username, userData, backupType = 'full', customName = null) {
  try {
    const manualDir = ensureUserBackupDir(username, 'manual');

    // Формируем данные в зависимости от типа
    let backupData = {};

    if (backupType === 'full' || backupType === 'cards') {
      backupData._cards = userData._cards || [];
      backupData._meta = userData._meta || {};
    }

    if (backupType === 'full' || backupType === 'progress') {
      backupData._achievements = userData._achievements || {};
      backupData._stats = userData._stats || {};
      backupData._srsProgress = userData._srsProgress || {};
      backupData._favorites = userData._favorites || [];
      backupData._appSettings = userData._appSettings || {};
    }

    const filename = customName
      ? `${customName}.json`
      : `manual_${getTimestamp()}.json`;

    // Проверяем уникальность имени
    if (fs.existsSync(path.join(manualDir, filename))) {
      return { success: false, error: 'Бэкап с таким именем уже существует' };
    }

    const backupPath = path.join(manualDir, filename);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log(`[BACKUP] Manual backup created for ${username}: ${filename}`);
    return { success: true, filename };
  } catch (err) {
    console.error(`[BACKUP] Manual backup failed for ${username}:`, err);
    return { success: false, error: err.message };
  }
}

// ==================== СПИСОК БЭКАПОВ ====================

function listUserBackups(username) {
  const backups = [];

  ['auto', 'manual'].forEach(type => {
    const dir = path.join(BACKUP_BASE_DIR, username, type);

    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(filename => {
        const filePath = path.join(dir, filename);
        const info = getBackupInfo(filePath);

        return {
          id: `${type}__${filename}`,
          type,
          filename,
          name: filename.replace('.json', '').replace(/^manual_/, '').replace(/^backup_/, ''),
          ...info,
          isAuto: type === 'auto',
          isManual: type === 'manual',
          canDelete: type === 'manual',
          canRename: type === 'manual',
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    backups.push(...files);
  });

  return backups;
}

// ==================== ВОССТАНОВЛЕНИЕ ====================

function restoreFromBackup(username, backupId, restoreType = 'full') {
  try {
    const [type, ...filenameParts] = backupId.split('__');
    const filename = filenameParts.join('__');

    const backupPath = path.join(BACKUP_BASE_DIR, username, type, filename);

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Бэкап не найден' };
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    const userFilePath = path.join(__dirname, 'data', `user_${username}.json`);

    // Загружаем текущие данные
    let userData = {};
    if (fs.existsSync(userFilePath)) {
      userData = JSON.parse(fs.readFileSync(userFilePath, 'utf-8'));
    }

    // Восстанавливаем в зависимости от типа
    if (restoreType === 'full' || restoreType === 'cards') {
      if (backupData._cards) {
        userData._cards = backupData._cards;
      }
      if (backupData._meta) {
        userData._meta = { ...userData._meta, ...backupData._meta };
      }
    }

    if (restoreType === 'full' || restoreType === 'progress') {
      if (backupData._achievements) {
        userData._achievements = backupData._achievements;
      }
      if (backupData._stats) {
        userData._stats = backupData._stats;
      }
      if (backupData._srsProgress) {
        userData._srsProgress = backupData._srsProgress;
      }
      if (backupData._favorites) {
        userData._favorites = backupData._favorites;
      }
      if (backupData._appSettings) {
        userData._appSettings = backupData._appSettings;
      }
    }

    // Сохраняем
    fs.writeFileSync(userFilePath, JSON.stringify(userData, null, 2), 'utf-8');

    console.log(`[BACKUP] Restored ${restoreType} for ${username} from ${filename}`);
    return { success: true, restoreType };
  } catch (err) {
    console.error(`[BACKUP] Restore failed for ${username}:`, err);
    return { success: false, error: err.message };
  }
}

// ==================== УДАЛЕНИЕ ====================

function deleteManualBackup(username, filename) {
  try {
    const backupPath = path.join(BACKUP_BASE_DIR, username, 'manual', filename);

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Бэкап не найден' };
    }

    fs.unlinkSync(backupPath);
    console.log(`[BACKUP] Deleted manual backup for ${username}: ${filename}`);
    return { success: true };
  } catch (err) {
    console.error(`[BACKUP] Delete failed for ${username}:`, err);
    return { success: false, error: err.message };
  }
}

// ==================== ПЕРЕИМЕНОВАНИЕ ====================

function renameManualBackup(username, oldFilename, newFilename) {
  try {
    const oldPath = path.join(BACKUP_BASE_DIR, username, 'manual', oldFilename);
    const newPath = path.join(BACKUP_BASE_DIR, username, 'manual', newFilename);

    if (!fs.existsSync(oldPath)) {
      return { success: false, error: 'Бэкап не найден' };
    }

    if (fs.existsSync(newPath)) {
      return { success: false, error: 'Файл с таким именем уже существует' };
    }

    fs.renameSync(oldPath, newPath);
    console.log(`[BACKUP] Renamed backup for ${username}: ${oldFilename} -> ${newFilename}`);
    return { success: true };
  } catch (err) {
    console.error(`[BACKUP] Rename failed for ${username}:`, err);
    return { success: false, error: err.message };
  }
}

// ==================== ЭКСПОРТ ====================

function getBackupContent(username, backupId) {
  try {
    const [type, ...filenameParts] = backupId.split('__');
    const filename = filenameParts.join('__');

    const backupPath = path.join(BACKUP_BASE_DIR, username, type, filename);

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Бэкап не найден' };
    }

    const content = fs.readFileSync(backupPath, 'utf-8');
    return { success: true, content, filename };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ==================== ИМПОРТ ====================

function importBackup(username, backupData, customName = null) {
  try {
    const manualDir = ensureUserBackupDir(username, 'manual');

    const filename = customName
      ? `${customName}.json`
      : `imported_${getTimestamp()}.json`;

    if (fs.existsSync(path.join(manualDir, filename))) {
      return { success: false, error: 'Бэкап с таким именем уже существует' };
    }

    const backupPath = path.join(manualDir, filename);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log(`[BACKUP] Imported backup for ${username}: ${filename}`);
    return { success: true, filename };
  } catch (err) {
    console.error(`[BACKUP] Import failed for ${username}:`, err);
    return { success: false, error: err.message };
  }
}

// ==================== СБРОС ПРОГРЕССА ====================

function resetProgress(username) {
  try {
    const userFilePath = path.join(__dirname, 'data', `user_${username}.json`);

    if (!fs.existsSync(userFilePath)) {
      return { success: false, error: 'Пользователь не найден' };
    }

    const userData = JSON.parse(fs.readFileSync(userFilePath, 'utf-8'));

    // Очищаем весь прогресс
    userData._srsProgress = {};
    userData._achievements = {};
    userData._stats = {};
    userData._favorites = [];

    fs.writeFileSync(userFilePath, JSON.stringify(userData, null, 2), 'utf-8');

    // Также удаляем файл марафона
    const marathonFilePath = path.join(__dirname, 'data', `user_${username}_marathon.json`);
    if (fs.existsSync(marathonFilePath)) {
      fs.unlinkSync(marathonFilePath);
      console.log(`[BACKUP] Marathon file deleted for ${username}`);
    }

    console.log(`[BACKUP] Progress reset for ${username}`);
    return { success: true };
  } catch (err) {
    console.error(`[BACKUP] Reset progress failed for ${username}:`, err);
    return { success: false, error: err.message };
  }
}

// ==================== ЭКСПОРТ ====================

module.exports = {
  createAutoBackup,
  createManualBackup,
  listUserBackups,
  restoreFromBackup,
  deleteManualBackup,
  renameManualBackup,
  getBackupContent,
  importBackup,
  resetProgress,
  MAX_AUTO_BACKUPS,
  BACKUP_INTERVAL_HOURS,
};
