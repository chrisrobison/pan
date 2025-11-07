# Secure Development Server

## Quick Start

```bash
npm run serve
```

Server will start at: **https://localhost:8443**

## Features

✅ **HTTPS** - Self-signed certificates auto-generated
✅ **Security Headers** - CSP, HSTS, X-Frame-Options, etc.
✅ **CORS Whitelist** - Only allowed origins
✅ **Static File Serving** - HTML, JS, CSS, images, etc.
✅ **PHP Support** - Via php-cgi (optional)

## Configuration

### Environment Variables

```bash
# Port configuration
PORT=8443                # HTTPS port
HTTP_PORT=8080          # HTTP port (for redirect)
HOST=0.0.0.0            # Bind address
DOMAIN=cdr2.com         # Domain name
```

### Example

```bash
# Custom port
PORT=3000 npm run serve

# Different domain
DOMAIN=example.com npm run serve
```

## SSL Certificates

The server looks for certificates in this order:

1. **Let's Encrypt** (production):
   - `/etc/letsencrypt/live/cdr2.com/fullchain.pem`
   - `/etc/letsencrypt/live/cdr2.com/privkey.pem`

2. **Self-signed** (development):
   - `.ssl/cert.pem`
   - `.ssl/key.pem`

If no certificates are found, the server will auto-generate self-signed certs.

## Security Headers

The server automatically adds:

```
Content-Security-Policy: [strict policy]
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000
```

## CORS Configuration

Edit `scripts/dev-server.mjs` to modify allowed origins:

```javascript
allowedOrigins: [
    'https://cdr2.com',
    'https://localhost:8443',
    'http://localhost:8080',
    // Add your origins here
]
```

## Accessing Your Site

### Browser
Navigate to: **https://localhost:8443**

Accept the self-signed certificate warning (development only).

### Adding to /etc/hosts
```bash
# Add this line to /etc/hosts for domain access
127.0.0.1  cdr2.com
```

Then access at: **https://cdr2.com:8443**

## PHP Support

The server automatically handles `.php` files via `php-cgi` if available.

### Test PHP

Create `test.php`:
```php
<?php
phpinfo();
?>
```

Access at: **https://localhost:8443/test.php**

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :8443

# Kill the process
kill -9 <PID>

# Or use different port
PORT=9443 npm run serve
```

### Self-Signed Certificate Warning
This is normal for development. To avoid warnings:

1. **Chrome/Edge**: Import `.ssl/cert.pem` into Trusted Root Certificates
2. **Firefox**: Accept the exception once
3. **Use Let's Encrypt** for production

### PHP Not Available
If you see "PHP is not available":

```bash
# Install PHP (macOS)
brew install php

# Verify php-cgi is available
which php-cgi
```

## Production Deployment

For production, use:
- Real SSL certificates (Let's Encrypt)
- Reverse proxy (nginx/Apache)
- Process manager (PM2, systemd)

The dev server is for **development only**.

## Examples

### Serve on all interfaces
```bash
HOST=0.0.0.0 npm run serve
```

### Custom domain and port
```bash
DOMAIN=myapp.local PORT=4433 npm run serve
```

### With Let's Encrypt certs
```bash
# Assumes certs at /etc/letsencrypt/live/cdr2.com/
npm run serve
```

## Directory Structure

```
project/
├── scripts/
│   └── dev-server.mjs       # Server implementation
├── .ssl/                     # Auto-generated certs (gitignored)
│   ├── cert.pem
│   └── key.pem
├── api.php           # Secured API
├── auth.php                 # Authentication endpoint
├── sse.php                  # SSE endpoint
└── [your files]
```

## Security Notes

- ✅ Development server includes production-grade security headers
- ✅ CORS whitelist prevents unauthorized access
- ✅ CSP prevents XSS attacks
- ✅ HSTS enforces HTTPS
- ⚠️ Self-signed certs are for development only
- ⚠️ Use real SSL certificates in production
