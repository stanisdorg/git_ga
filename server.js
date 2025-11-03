const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
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