const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = parseInt(process.argv[2], 10) || 3456;
const DATA_DIR = 'D:\\重要数据';
const DATA_FILE = path.join(DATA_DIR, 'todos.json');

// 启动前清理占用同一端口的旧进程
try {
  const result = execSync(`netstat -ano | findstr "LISTENING" | findstr ":${PORT}"`, { encoding: 'utf-8', timeout: 3000 });
  result.trim().split('\n').forEach(line => {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '' + process.pid) {
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch {}
    }
  });
} catch {} // 没有旧进程，不处理

// 确保数据目录和文件存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ---- API: 读取/写入数据 ----
  if (pathname === '/api/data') {
    if (req.method === 'GET') {
      try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(data);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          JSON.parse(body); // 校验 JSON 合法性
          fs.writeFileSync(DATA_FILE, body, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // ---- API: 存储信息 ----
  if (pathname === '/api/info') {
    try {
      const stats = fs.statSync(DATA_FILE);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        size: stats.size,
        path: DATA_FILE,
        exists: true,
        updatedAt: stats.mtime
      }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ size: 0, path: DATA_FILE, exists: false }));
    }
    return;
  }

  // ---- API: 健康检查 ----
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', time: Date.now() }));
    return;
  }

  // ---- 静态文件 ----
  const filePath = pathname === '/'
    ? path.join(__dirname, 'index.html')
    : path.join(__dirname, pathname);

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(``);
  console.log(`  ✓ 我的想法箱 服务已启动`);
  console.log(`  ✓ 数据存储于: ${DATA_FILE}`);
  console.log(`  ✓ 访问地址: http://localhost:${PORT}`);
  console.log(`  ✓ 按 Ctrl+C 停止服务`);
  console.log(``);
});

// 优雅关闭：Ctrl+C 时真正退出进程
function shutdown() {
  console.log(`\n  正在关闭服务...`);
  server.close(() => {
    process.exit(0);
  });
  // 超过 3 秒强制退出
  setTimeout(() => process.exit(1), 3000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
