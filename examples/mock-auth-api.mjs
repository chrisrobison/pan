/**
 * Mock Auth API - Client-side JWT authentication simulator
 * For demo/testing purposes only - simulates a backend auth API
 *
 * Usage:
 * <script type="module" src="./examples/mock-auth-api.mjs"></script>
 *
 * Endpoints:
 * POST /api/auth/login   - Login with email/password
 * POST /api/auth/refresh - Refresh token
 * POST /api/auth/logout  - Logout
 * GET  /api/users        - Get users (requires auth)
 */

// Mock user database
const MOCK_USERS = [
  { id: 1, email: 'admin@example.com', password: 'admin123', name: 'Admin User', role: 'admin' },
  { id: 2, email: 'user@example.com', password: 'user123', name: 'Regular User', role: 'user' },
  { id: 3, email: 'demo@example.com', password: 'demo', name: 'Demo User', role: 'user' }
];

// Token storage
const tokenStore = new Map();

// Create a mock JWT token (not cryptographically secure!)
function createMockToken(user, expiresIn = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + expiresIn
  };

  // Base64 encode (not real JWT signing!)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = btoa(`mock-signature-${user.id}-${now}`);

  const token = `${header}.${body}.${signature}`;

  // Store for validation
  tokenStore.set(token, { user, exp: payload.exp });

  return token;
}

// Create refresh token
function createRefreshToken(user) {
  const token = `refresh_${crypto.randomUUID()}_${user.id}`;
  tokenStore.set(token, { user, exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) }); // 30 days
  return token;
}

// Validate token
function validateToken(token) {
  const stored = tokenStore.get(token);
  if (!stored) return null;

  const now = Math.floor(Date.now() / 1000);
  if (stored.exp < now) {
    tokenStore.delete(token);
    return null;
  }

  return stored.user;
}

// Extract Bearer token from Authorization header
function extractToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Mock API router
async function handleMockApi(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  console.log(`[Mock API] ${method} ${path}`);

  // Login endpoint
  if (path === '/api/auth/login' && method === 'POST') {
    try {
      const body = await request.json();
      const { email, password } = body;

      const user = MOCK_USERS.find(u => u.email === email && u.password === password);

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid email or password' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const token = createMockToken(user, 3600); // 1 hour
      const refreshToken = createRefreshToken(user);

      return new Response(
        JSON.stringify({
          token,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Refresh endpoint
  if (path === '/api/auth/refresh' && method === 'POST') {
    try {
      const authHeader = request.headers.get('Authorization');
      const refreshToken = extractToken(authHeader);

      if (!refreshToken) {
        return new Response(
          JSON.stringify({ error: 'Missing refresh token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const user = validateToken(refreshToken);
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired refresh token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const newToken = createMockToken(user, 3600); // 1 hour
      const newRefreshToken = createRefreshToken(user);

      return new Response(
        JSON.stringify({
          token: newToken,
          refreshToken: newRefreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Logout endpoint
  if (path === '/api/auth/logout' && method === 'POST') {
    const authHeader = request.headers.get('Authorization');
    const token = extractToken(authHeader);
    if (token) {
      tokenStore.delete(token);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Protected users endpoint
  if (path === '/api/users' && method === 'GET') {
    const authHeader = request.headers.get('Authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = validateToken(token);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return user list (excluding passwords)
    const users = MOCK_USERS.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role
    }));

    return new Response(
      JSON.stringify(users),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 404 for unknown endpoints
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

// Intercept fetch requests to /api/*
const originalFetch = window.fetch;
window.fetch = function(input, init) {
  const url = typeof input === 'string' ? input : input.url;

  // Only intercept requests to /api/*
  if (url.startsWith('/api/')) {
    console.log('[Mock API] Intercepting:', url);
    return handleMockApi(new Request(url, init));
  }

  // Pass through other requests
  return originalFetch.apply(this, arguments);
};

console.log('[Mock API] Mock auth API loaded');
console.log('[Mock API] Test credentials:');
console.log('  - admin@example.com / admin123');
console.log('  - user@example.com / user123');
console.log('  - demo@example.com / demo');
