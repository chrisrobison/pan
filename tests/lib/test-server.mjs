/**
 * Simple HTTP server for running tests
 * Serves static files from project root
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from tests/lib
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// MIME types for common file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Create and start HTTP server
 * @param {number} port - Port to listen on
 * @returns {Promise<http.Server>} HTTP server instance
 */
export function createTestServer(port = 3000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Parse URL and remove query string
      const urlPath = req.url.split('?')[0];

      // Security: prevent directory traversal
      const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(PROJECT_ROOT, safePath);

      // Check if path is within project root
      if (!filePath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
      }

      // Read and serve file
      fs.readFile(filePath, (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
          }
          return;
        }

        // Determine content type
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        // Set CORS headers for local development
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-cache',
        });

        res.end(data);
      });
    });

    server.listen(port, () => {
      console.log(`Test server listening at http://localhost:${port}`);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      }
      reject(err);
    });
  });
}

/**
 * Stop HTTP server
 * @param {http.Server} server - Server instance to stop
 * @returns {Promise<void>}
 */
export function stopTestServer(server) {
  return new Promise((resolve) => {
    server.close(() => {
      console.log('Test server stopped');
      resolve();
    });
  });
}

// If run directly, start server
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || '3000', 10);
  createTestServer(port).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
