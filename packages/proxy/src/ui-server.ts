import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getUIDistPath(): string {
  // In production build, UI is at dist/ui relative to this file
  // After tsup build, this file is at dist/index.js, so ui is at dist/ui
  return join(__dirname, 'ui');
}

function serveFile(res: ServerResponse, filePath: string): void {
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  const stream = createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', () => {
    res.statusCode = 500;
    res.end('Internal Server Error');
  });
}

function handleRequest(req: IncomingMessage, res: ServerResponse, uiPath: string): void {
  const url = new URL(req.url || '/', 'http://localhost');
  let pathname = url.pathname;

  // Remove leading slash and decode
  let relativePath = decodeURIComponent(pathname.slice(1));

  // Default to index.html
  if (relativePath === '' || relativePath === '/') {
    relativePath = 'index.html';
  }

  const filePath = join(uiPath, relativePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(uiPath)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    serveFile(res, filePath);
    return;
  }

  // For SPA routing: serve index.html for non-file requests
  const indexPath = join(uiPath, 'index.html');
  if (existsSync(indexPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    createReadStream(indexPath).pipe(res);
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
}

export interface UIServerOptions {
  port: number;
}

export function createUIServer(options: UIServerOptions): Server | null {
  const { port } = options;
  const uiPath = getUIDistPath();

  // Check if UI is bundled
  if (!existsSync(uiPath) || !existsSync(join(uiPath, 'index.html'))) {
    console.log(chalk.yellow('!'), 'UI not bundled. Run in dev mode or build first.');
    return null;
  }

  const server = createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    handleRequest(req, res, uiPath);
  });

  server.listen(port, () => {
    console.log(chalk.green('✓'), `UI server started on port ${chalk.cyan(port)}`);
  });

  return server;
}

export function getUIPath(): string {
  return getUIDistPath();
}
