#!/usr/bin/env node

/**
 * Secure HTTPS Development Server for PAN
 *
 * Features:
 * - HTTPS with Let's Encrypt or self-signed certificates
 * - Proper CORS configuration (whitelist)
 * - Content Security Policy (CSP) headers
 * - Security headers (X-Frame-Options, etc.)
 * - Static file serving
 * - PHP support via php-cgi (optional)
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Configuration
const CONFIG = {
  port: process.env.PORT || 8443,
  httpPort: process.env.HTTP_PORT || 8080,
  host: process.env.HOST || '0.0.0.0',
  domain: process.env.DOMAIN || 'cdr2.com',

  // Allowed origins for CORS (whitelist)
  allowedOrigins: [
    'https://cdr2.com',
    'https://www.cdr2.com',
    'https://localhost:8443',
    'http://localhost:8080',
    'http://localhost:3000',
  ],

  // SSL certificate paths
  sslPaths: [
    // Let's Encrypt (production)
    {
      cert: '/etc/letsencrypt/live/cdr2.com/fullchain.pem',
      key: '/etc/letsencrypt/live/cdr2.com/privkey.pem',
    },
    // Self-signed (development)
    {
      cert: path.join(ROOT_DIR, '.ssl', 'cert.pem'),
      key: path.join(ROOT_DIR, '.ssl', 'key.pem'),
    },
  ],
};

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
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
  '.md': 'text/markdown',
};

/**
 * Get SSL certificate paths
 */
function getSSLCertificates() {
  for (const certPath of CONFIG.sslPaths) {
    try {
      if (fs.existsSync(certPath.cert) && fs.existsSync(certPath.key)) {
        console.log('✓ Using SSL certificates from:', path.dirname(certPath.cert));
        return {
          cert: fs.readFileSync(certPath.cert),
          key: fs.readFileSync(certPath.key),
        };
      }
    } catch (err) {
      // Continue to next option
    }
  }

  // Generate self-signed certificate if none found
  console.log('⚠ No SSL certificates found. Generating self-signed certificate...');
  return generateSelfSignedCert();
}

/**
 * Generate self-signed certificate for development
 */
function generateSelfSignedCert() {
  const sslDir = path.join(ROOT_DIR, '.ssl');
  const certPath = path.join(sslDir, 'cert.pem');
  const keyPath = path.join(sslDir, 'key.pem');

  // Create .ssl directory
  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
  }

  // Generate self-signed cert using openssl
  try {
    const { execSync } = require('child_process');
    execSync(
      `openssl req -x509 -newkey rsa:4096 -nodes ` +
      `-keyout "${keyPath}" -out "${certPath}" -days 365 ` +
      `-subj "/C=US/ST=Dev/L=Dev/O=Dev/CN=${CONFIG.domain}"`,
      { stdio: 'inherit' }
    );

    console.log('✓ Generated self-signed certificate');

    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  } catch (err) {
    console.error('✗ Failed to generate self-signed certificate:', err.message);
    console.log('Please install openssl or provide SSL certificates manually');
    process.exit(1);
  }
}

/**
 * Get security headers
 */
function getSecurityHeaders(origin) {
  const headers = {
    // CSP - Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: https://api.openai.com https://api.anthropic.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),

    // CORS
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Last-Event-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',

    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',

    // HSTS (only for HTTPS)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };

  // Set CORS origin if allowed
  if (origin && CONFIG.allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (origin && origin.startsWith('http://localhost')) {
    // Allow any localhost origin in development
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/**
 * Serve static file
 */
function serveStaticFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const origin = req.headers.origin || '';
    const headers = {
      'Content-Type': contentType,
      ...getSecurityHeaders(origin),
    };

    res.writeHead(200, headers);
    res.end(data);
  });
}

/**
 * Handle PHP file
 */
function handlePHP(req, res, filePath) {
  // Check if php-cgi is available
  try {
    const phpProcess = spawn('php-cgi', [filePath], {
      env: {
        ...process.env,
        REQUEST_METHOD: req.method,
        QUERY_STRING: new URL(req.url, `https://${req.headers.host}`).search.slice(1),
        SCRIPT_FILENAME: filePath,
        REDIRECT_STATUS: 200,
      },
    });

    let output = '';
    let headers = {};
    let body = '';
    let inHeaders = true;

    phpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    phpProcess.on('close', () => {
      // Parse CGI output (headers + body)
      const parts = output.split('\r\n\r\n');
      if (parts.length >= 2) {
        const headerLines = parts[0].split('\r\n');
        body = parts.slice(1).join('\r\n\r\n');

        headerLines.forEach(line => {
          const [key, ...valueParts] = line.split(':');
          if (key && valueParts.length) {
            headers[key.trim()] = valueParts.join(':').trim();
          }
        });
      } else {
        body = output;
      }

      const origin = req.headers.origin || '';
      const securityHeaders = getSecurityHeaders(origin);

      res.writeHead(200, { ...headers, ...securityHeaders });
      res.end(body);
    });

    phpProcess.on('error', (err) => {
      console.error('PHP execution error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    });

    // Pipe request body to PHP if POST
    if (req.method === 'POST') {
      req.pipe(phpProcess.stdin);
    } else {
      phpProcess.stdin.end();
    }

  } catch (err) {
    console.error('PHP not available:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('PHP is not available');
  }
}

/**
 * Request handler
 */
function handleRequest(req, res) {
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || '';
    const headers = getSecurityHeaders(origin);
    res.writeHead(204, headers);
    res.end();
    return;
  }

  // Parse URL
  const parsedUrl = new URL(req.url, `https://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  // Security: prevent directory traversal
  if (pathname.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Default to index.html for directories
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }

  const filePath = path.join(ROOT_DIR, pathname);

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err) {
      // Try .html extension
      const htmlPath = filePath + '.html';
      fs.stat(htmlPath, (htmlErr, htmlStats) => {
        if (!htmlErr && htmlStats.isFile()) {
          serveStaticFile(req, res, htmlPath);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        }
      });
      return;
    }

    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      serveStaticFile(req, res, indexPath);
      return;
    }

    // Handle PHP files
    if (filePath.endsWith('.php')) {
      handlePHP(req, res, filePath);
      return;
    }

    // Serve static file
    serveStaticFile(req, res, filePath);
  });
}

/**
 * Start HTTPS server
 */
function startHTTPSServer() {
  const sslOptions = getSSLCertificates();

  const server = https.createServer(sslOptions, handleRequest);

  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log('\n🔒 HTTPS Development Server');
    console.log('━'.repeat(50));
    console.log(`✓ Server running at: https://${CONFIG.domain}:${CONFIG.port}`);
    console.log(`✓ Local: https://localhost:${CONFIG.port}`);
    console.log(`✓ Root: ${ROOT_DIR}`);
    console.log('\n🛡️  Security Features:');
    console.log('  ✓ HTTPS enabled');
    console.log('  ✓ Content Security Policy (CSP)');
    console.log('  ✓ CORS whitelist enabled');
    console.log('  ✓ Security headers configured');
    console.log('\n📋 Allowed Origins:');
    CONFIG.allowedOrigins.forEach(origin => console.log(`  • ${origin}`));
    console.log('\n⌨️  Press Ctrl+C to stop\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`✗ Port ${CONFIG.port} is already in use`);
      process.exit(1);
    } else {
      console.error('✗ Server error:', err);
    }
  });
}

/**
 * Start HTTP redirect server (optional)
 */
function startHTTPRedirectServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(301, {
      Location: `https://${req.headers.host}:${CONFIG.port}${req.url}`,
    });
    res.end();
  });

  server.listen(CONFIG.httpPort, CONFIG.host, () => {
    console.log(`✓ HTTP→HTTPS redirect: http://localhost:${CONFIG.httpPort} → https://localhost:${CONFIG.port}`);
  });
}

// Start servers
startHTTPSServer();
// Uncomment to enable HTTP→HTTPS redirect
// startHTTPRedirectServer();
