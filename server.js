import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8085;
const IP = '0.0.0.0'; // Слушаем на всех интерфейсах

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // CORS и preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Сохранение данных в JSON
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        // Путь к целевому файлу
        const targetPath = path.join(__dirname, 'data', 'questions_no_anki.json');
        const backupPath = path.join(__dirname, 'data', 'questions_no_anki copy.json');
        // Делаем бэкап текущего файла
        try {
          const existing = fs.readFileSync(targetPath, 'utf-8');
          fs.writeFileSync(backupPath, existing, 'utf-8');
        } catch (_) {}
        // Записываем новые данные
        fs.writeFile(targetPath, JSON.stringify(data, null, 2), 'utf-8', (err) => {
          if (err) {
            console.error('Failed to write file:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'write_failed' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
      } catch (e) {
        console.error('Invalid JSON body:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
      }
    });
    return;
  }

  // Обработка метаданных (GET)
  if (req.method === 'GET' && req.url === '/metadata') {
    const metaPath = path.join(__dirname, 'data', 'metadata.json');
    const trashPath = path.join(__dirname, 'data', 'trash.json');
    
    let meta = {};
    try {
      if (fs.existsSync(metaPath)) {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      }
    } catch (e) { console.error('Error reading metadata:', e); }

    let trash = [];
    try {
      if (fs.existsSync(trashPath)) {
        trash = JSON.parse(fs.readFileSync(trashPath, 'utf-8'));
        if (!Array.isArray(trash)) trash = [];
      }
    } catch (e) { console.error('Error reading trash:', e); }

    const response = { ...meta, trash_bin: trash };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }

  // Обработка метаданных (POST)
  if (req.method === 'POST' && req.url === '/metadata') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const metaPath = path.join(__dirname, 'data', 'metadata.json');
        
        // Читаем текущие метаданные, чтобы не затереть другие поля
        let currentMeta = {};
        try {
           if (fs.existsSync(metaPath)) currentMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch (_) {}

        // Обновляем поля
        const newMeta = { ...currentMeta, ...payload };
        
        fs.writeFile(metaPath, JSON.stringify(newMeta, null, 2), 'utf-8', (err) => {
          if (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ ok: false }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }


  // Нормализуем URL
  // Декодируем URL для поддержки кириллических имен файлов
  let requestUrl;
  try {
    requestUrl = decodeURIComponent(req.url);
  } catch (e) {
    console.error('URI Decode Error:', e.message);
    requestUrl = req.url;
  }
  
  // Удаляем параметры запроса (например ?t=...)
  const queryIndex = requestUrl.indexOf('?');
  if (queryIndex !== -1) {
    requestUrl = requestUrl.substring(0, queryIndex);
  }

  let filePath = '.' + requestUrl;
  if (filePath === './') {
    filePath = './index.html';
  }

  console.log('Request:', req.url);
  console.log('Decoded:', requestUrl);
  console.log('FilePath:', filePath);


  // Получаем расширение файла
  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  // Читаем файл
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Файл не найден
        fs.readFile('./index.html', (err, content) => {
          if (err) {
            res.writeHead(500);
            res.end('Ошибка сервера: ' + err.code);
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        });
      } else {
        // Другая ошибка сервера
        res.writeHead(500);
        res.end('Ошибка сервера: ' + err.code);
      }
      return;
    }

    // Успешный ответ
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
});

server.listen(PORT, IP, () => {
  console.log(`Server running at http://${IP}:${PORT}/`);
  console.log(`Open http://localhost:${PORT}/ in your browser`);
});
