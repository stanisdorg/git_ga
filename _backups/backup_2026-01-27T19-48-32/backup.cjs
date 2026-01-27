const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '_backups');
const IGNORE_LIST = [
    'node_modules', 
    '.git', 
    '_backups', 
    '.vscode',
    'dist',
    'build',
    '.DS_Store'
];

// Helper to get current timestamp
function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// Recursive copy function
function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }

    fs.readdirSync(from).forEach(element => {
        if (IGNORE_LIST.includes(element)) return;

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

// Main backup function
function createBackup() {
    const timestamp = getTimestamp();
    const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}`);

    console.log(`Starting backup to: ${backupPath}`);
    
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR);
        }
        
        copyFolderSync(__dirname, backupPath);
        console.log('✅ Backup completed successfully!');
        
        // Cleanup old backups (keep last 10)
        cleanupOldBackups();
        
    } catch (err) {
        console.error('❌ Backup failed:', err);
        process.exit(1);
    }
}

function cleanupOldBackups() {
    try {
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('backup_'))
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Newest first

        if (backups.length > 10) {
            console.log(`Cleaning up ${backups.length - 10} old backups...`);
            backups.slice(10).forEach(backup => {
                const backupPath = path.join(BACKUP_DIR, backup.name);
                fs.rmSync(backupPath, { recursive: true, force: true });
                console.log(`Deleted old backup: ${backup.name}`);
            });
        }
    } catch (err) {
        console.warn('⚠️ Warning: Failed to cleanup old backups:', err.message);
    }
}

createBackup();
