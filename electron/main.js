// Main process for Electron prototype
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

let mainWindow = null;
let sttProc = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true
        }
    });

    // Load existing UI
    mainWindow.loadFile(join(__dirname, '..', 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC placeholders for future streaming STT
ipcMain.on('stt:start', (event, config) => {
    if (sttProc) return;
    const workerPath = join(__dirname, 'stt_worker.py');
    sttProc = spawn('python3', [workerPath], { stdio: ['pipe', 'pipe', 'inherit'] });
    sttProc.stdout.setEncoding('utf8');
    sttProc.stdout.on('data', (chunk) => {
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const msg = JSON.parse(line);
                if (msg.event === 'partial') mainWindow.webContents.send('stt:partial', msg.data);
                if (msg.event === 'final') mainWindow.webContents.send('stt:final', msg.data);
            } catch (_) {}
        }
    });
    // send config
    sttProc.stdin.write(JSON.stringify({ type: 'config', config }) + '\n');
});

ipcMain.on('stt:stop', () => {
    if (sttProc) {
        try { sttProc.stdin.write(JSON.stringify({ type: 'stop' }) + '\n'); } catch (_) {}
        sttProc.kill();
        sttProc = null;
    }
});

ipcMain.on('stt:audio-chunk', (event, chunk) => {
    if (!sttProc) return;
    try {
        sttProc.stdin.write(JSON.stringify({ type: 'audio_chunk', payload: chunk }) + '\n');
    } catch (_) {}
});


