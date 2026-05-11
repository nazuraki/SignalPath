import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.ts';
import { fetchEpic } from './jira.ts';

const PORT = config.server.port;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const isProd = process.env.NODE_ENV === 'production';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

const json = (res: ServerResponse, status: number, payload: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const handleApi = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  if (req.url === '/api/config') {
    return json(res, 200, {
      ui: config.ui,
      jiraBase: config.jira.base,
      parity: config.parity,
    });
  }
  if (req.url === '/api/burndown') {
    try {
      const epics = await Promise.all(config.jira.epics.map(fetchEpic));
      return json(res, 200, { epics });
    } catch (e) {
      console.error(e);
      return json(res, 500, { error: (e as Error).message });
    }
  }
  return json(res, 404, { error: 'not found' });
};

const serveStatic = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  if (!isProd) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Run `npm run dev` and open http://localhost:5173 — Vite serves the client in dev.');
    return;
  }
  const urlPath = (req.url ?? '/').split('?')[0];
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = normalize(join(DIST_DIR, rel));
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  const target = existsSync(filePath) ? filePath : join(DIST_DIR, 'index.html');
  try {
    const buf = await readFile(target);
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] ?? 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
};

const srv = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/')) return handleApi(req, res);
  return serveStatic(req, res);
});

srv.listen(PORT, () => {
  console.log(`Orchestrator API: http://localhost:${PORT}`);
  if (!isProd) console.log('Client (dev): http://localhost:5173');
});
