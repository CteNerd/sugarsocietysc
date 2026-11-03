const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '../packages/web/build');
const types = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

async function serve(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end();
    return;
  }
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }
  const target = path.extname(pathname) ? file : path.join(root, 'index.html');
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.error(`Browser build file missing: ${target}`);
    response.writeHead(404).end();
  }
}

const server = createServer((request, response) => {
  serve(request, response).catch((error) => {
    console.error('Browser build server failed', error);
    response.writeHead(500).end();
  });
});
server.listen(4173, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
