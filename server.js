const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8081;
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
        const targetPath = path.join(__dirname, 'data', 'Копия вопросы.json');
        const backupPath = path.join(__dirname, 'data', 'Копия вопросы copy.json');
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

  // Нормализуем URL
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

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
  console.log(`Сервер запущен на http://${IP}:${PORT}`);
  console.log(`Для доступа с других устройств в локальной сети используйте IP адрес вашего компьютера`);
  console.log(`Например: http://192.168.1.X:${PORT} (где X - ваш локальный IP)`);
});
