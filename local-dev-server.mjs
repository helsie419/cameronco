#!/usr/bin/env node
import 'dotenv/config';

import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preferredPort = Number(process.env.PORT || 8888);

const functionRoutes = [
  ['/api/rate-admin', './netlify/functions/rate-admin.mjs'],
  ['/api/jobs', './netlify/functions/jobs.mjs'],
  ['/api/xero', './netlify/functions/xero.mjs'],
  ['/api/email', './netlify/functions/email.mjs'],
  ['/api/stock', './netlify/functions/stock.mjs'],
  ['/api/settings', './netlify/functions/settings.mjs'],
  ['/api', './netlify/functions/api.mjs'],
];

const functionCache = new Map();

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.pdf', 'application/pdf'],
  ['.webp', 'image/webp'],
]);

const requestHandler = async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${preferredPort}`}`);
    const route = functionRoutes.find(([prefix]) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));

    if (route) {
      await handleFunction(route[1], req, res, url);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendText(res, 500, 'Local server error');
  }
};

listen(preferredPort);

function listen(nextPort) {
  const server = createServer(requestHandler);

  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && !process.env.PORT && nextPort < preferredPort + 20) {
      server.close();
      listen(nextPort + 1);
      return;
    }
    throw error;
  });

  // Keep the local CRM/API reachable only from this machine. Binding to all
  // interfaces would expose customer and insurance data on the local network.
  server.listen(nextPort, '127.0.0.1', () => {
    const dbUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.NETLIFY_DB_URL || '';
    const dbHost = dbUrl ? new URL(dbUrl).host : 'not configured';
    console.log(`Cameron & Co CRM local server: http://localhost:${nextPort}`);
    console.log(`Database: ${dbHost}`);
  });
}

async function handleFunction(modulePath, req, res, url) {
  const handler = await loadFunction(modulePath);
  const request = await toRequest(req, url);
  const response = await handler(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = response.body ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0);
  res.end(body);
}

async function loadFunction(modulePath) {
  if (!functionCache.has(modulePath)) {
    const loaded = await import(pathToFileURL(path.join(__dirname, modulePath)).href);
    functionCache.set(modulePath, loaded.default);
  }
  return functionCache.get(modulePath);
}

async function toRequest(req, url) {
  const body = ['GET', 'HEAD'].includes(req.method || 'GET')
    ? undefined
    : Buffer.concat(await collect(req));

  return new Request(url.href, {
    method: req.method,
    headers: req.headers,
    body,
  });
}

function collect(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(chunks));
    req.on('error', reject);
  });
}

async function serveStatic(rawPathname, res) {
  const pathname = decodeURIComponent(rawPathname);
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(__dirname, safePath === '/' ? 'index.html' : safePath);

  if (!filePath.startsWith(__dirname)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  if (existsSync(filePath) && (await stat(filePath)).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!existsSync(filePath)) {
    sendText(res, 404, 'Not found');
    return;
  }

  const type = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  createReadStream(filePath).pipe(res);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}
