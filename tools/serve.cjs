// A plain static server for previewing the site locally (with byte ranges, which
// Safari needs to play audio and video).   node tools/serve.cjs [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8090);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};
const HIDDEN = /^(tools|src-img|src-audio|content)(\/|$)|^\./;

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || HIDDEN.test(rel.replace(/\\/g, '/'))) { res.writeHead(404); return res.end('Not found'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      const nf = path.join(ROOT, '404.html');
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return fs.existsSync(nf) ? fs.createReadStream(nf).pipe(res) : res.end('Not found');
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-cache' });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Νεκρή Γραμμή site: http://127.0.0.1:${PORT}/`));
