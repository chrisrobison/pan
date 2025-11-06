<?php
/**
 * Authentication Endpoint for PAN
 *
 * Handles login, logout, token refresh, and session management
 *
 * Security Features:
 * ✓ Password hashing with bcrypt
 * ✓ HttpOnly cookies for session/JWT
 * ✓ CSRF protection
 * ✓ Rate limiting
 * ✓ Secure session configuration
 */

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

// CORS - Whitelist specific origins
$allowedOrigins = [
	'https://cdr2.com',
	'https://www.cdr2.com',
	'https://localhost:8443',
	'http://localhost:8080',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins) || strpos($origin, 'http://localhost:') === 0) {
	header("Access-Control-Allow-Origin: $origin");
	header('Access-Control-Allow-Credentials: true');
	header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
	header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
}

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
	http_response_code(204);
	exit;
}

// Secure session configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1); // Requires HTTPS
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', 1);

session_start();

// Generate CSRF token
if (!isset($_SESSION['csrf_token'])) {
	$_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Rate limiting
function checkRateLimit($action, $limit = 5, $window = 300) {
	$key = "ratelimit_{$action}";
	$ip = $_SERVER['REMOTE_ADDR'];
	$now = time();

	if (!isset($_SESSION[$key])) {
		$_SESSION[$key] = [$ip => ['count' => 0, 'reset' => $now + $window]];
	}

	if (!isset($_SESSION[$key][$ip])) {
		$_SESSION[$key][$ip] = ['count' => 0, 'reset' => $now + $window];
	}

	$data = $_SESSION[$key][$ip];

	// Reset if window expired
	if ($now > $data['reset']) {
		$_SESSION[$key][$ip] = ['count' => 1, 'reset' => $now + $window];
		return true;
	}

	// Check limit
	if ($data['count'] >= $limit) {
		http_response_code(429);
		sendJSON(['ok' => false, 'error' => 'Too many attempts. Please try again later.']);
		exit;
	}

	$_SESSION[$key][$ip]['count']++;
	return true;
}

// Validate CSRF token
function validateCSRF() {
	if ($_SERVER['REQUEST_METHOD'] === 'POST') {
		$token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
		$sessionToken = $_SESSION['csrf_token'] ?? '';

		if (!$token || !$sessionToken || !hash_equals($sessionToken, $token)) {
			http_response_code(403);
			sendJSON(['ok' => false, 'error' => 'CSRF token invalid']);
			exit;
		}
	}
}

// Get JSON body
function getJSONBody() {
	$raw = file_get_contents('php://input');
	if ($raw === false || $raw === '') return null;
	$json = json_decode($raw, true);
	return is_array($json) ? $json : null;
}

// Send JSON response
function sendJSON($data) {
	header('Content-Type: application/json');
	echo json_encode($data);
	exit;
}

// JWT encoding (simple implementation - use a library like firebase/php-jwt in production)
function createJWT($payload, $secret, $expiresIn = 3600) {
	$header = ['alg' => 'HS256', 'typ' => 'JWT'];
	$payload['iat'] = time();
	$payload['exp'] = time() + $expiresIn;

	$base64Header = base64_encode(json_encode($header));
	$base64Payload = base64_encode(json_encode($payload));
	$signature = hash_hmac('sha256', "$base64Header.$base64Payload", $secret, true);
	$base64Signature = base64_encode($signature);

	return "$base64Header.$base64Payload.$base64Signature";
}

function verifyJWT($token, $secret) {
	$parts = explode('.', $token);
	if (count($parts) !== 3) return null;

	[$base64Header, $base64Payload, $base64Signature] = $parts;

	// Verify signature
	$expectedSignature = base64_encode(
		hash_hmac('sha256', "$base64Header.$base64Payload", $secret, true)
	);

	if (!hash_equals($expectedSignature, $base64Signature)) {
		return null;
	}

	// Decode payload
	$payload = json_decode(base64_decode($base64Payload), true);

	// Check expiration
	if (isset($payload['exp']) && $payload['exp'] < time()) {
		return null;
	}

	return $payload;
}

// Load environment
$env = loadEnvironment('.env');

// JWT secret (store securely in production)
$JWT_SECRET = $env['security']['jwt_secret'] ?? 'change-this-secret-in-production';

// Connect to database
try {
	$link = new mysqli(
		$env['db']['host'],
		$env['db']['user'],
		$env['db']['pass'],
		$env['db']['db']
	);

	if ($link->connect_error) {
		throw new Exception('Database connection failed');
	}

	$link->set_charset('utf8mb4');
} catch (Exception $e) {
	http_response_code(500);
	sendJSON(['ok' => false, 'error' => 'Service unavailable']);
	exit;
}

// Route request
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
	case 'login':
		handleLogin();
		break;

	case 'logout':
		handleLogout();
		break;

	case 'refresh':
		handleRefresh();
		break;

	case 'check':
		handleCheck();
		break;

	case 'csrf':
		// Return CSRF token
		sendJSON([
			'ok' => true,
			'csrf_token' => $_SESSION['csrf_token']
		]);
		break;

	default:
		http_response_code(400);
		sendJSON(['ok' => false, 'error' => 'Invalid action']);
}

/**
 * Handle login
 */
function handleLogin() {
	global $link, $JWT_SECRET;

	// Rate limiting: 5 attempts per 5 minutes
	checkRateLimit('login', 5, 300);

	// Validate CSRF
	validateCSRF();

	// Get credentials
	$body = getJSONBody();
	$email = $body['email'] ?? $_POST['email'] ?? '';
	$password = $body['password'] ?? $_POST['password'] ?? '';

	if (!$email || !$password) {
		http_response_code(400);
		sendJSON(['ok' => false, 'error' => 'Email and password required']);
	}

	// Query user (use prepared statement)
	$stmt = $link->prepare("SELECT userID, username, email, password_hash FROM users WHERE email = ? LIMIT 1");
	$stmt->bind_param('s', $email);
	$stmt->execute();
	$result = $stmt->get_result();
	$user = $result->fetch_assoc();
	$stmt->close();

	// Verify password
	if (!$user || !password_verify($password, $user['password_hash'])) {
		// Use same error message to prevent user enumeration
		http_response_code(401);
		sendJSON(['ok' => false, 'error' => 'Invalid credentials']);
	}

	// Create session
	$_SESSION['authenticated'] = true;
	$_SESSION['user_id'] = $user['userID'];
	$_SESSION['username'] = $user['username'];
	$_SESSION['email'] = $user['email'];

	// Regenerate session ID to prevent session fixation
	session_regenerate_id(true);

	// Create JWT token
	$token = createJWT([
		'sub' => $user['userID'],
		'username' => $user['username'],
		'email' => $user['email'],
	], $JWT_SECRET, 900); // 15 minutes

	// Create refresh token (longer expiry)
	$refreshToken = createJWT([
		'sub' => $user['userID'],
		'type' => 'refresh',
	], $JWT_SECRET, 604800); // 7 days

	// Set tokens as HttpOnly cookies
	setcookie('jwt', $token, [
		'expires' => time() + 900,
		'path' => '/',
		'secure' => true,
		'httponly' => true,
		'samesite' => 'Strict',
	]);

	setcookie('refresh_jwt', $refreshToken, [
		'expires' => time() + 604800,
		'path' => '/',
		'secure' => true,
		'httponly' => true,
		'samesite' => 'Strict',
	]);

	// Return success (token also in response for backward compatibility)
	sendJSON([
		'ok' => true,
		'user' => [
			'id' => $user['userID'],
			'username' => $user['username'],
			'email' => $user['email'],
		],
		'token' => $token,
		'refresh_token' => $refreshToken,
	]);
}

/**
 * Handle logout
 */
function handleLogout() {
	// Clear session
	$_SESSION = [];

	// Delete cookies
	setcookie('jwt', '', [
		'expires' => time() - 3600,
		'path' => '/',
		'secure' => true,
		'httponly' => true,
		'samesite' => 'Strict',
	]);

	setcookie('refresh_jwt', '', [
		'expires' => time() - 3600,
		'path' => '/',
		'secure' => true,
		'httponly' => true,
		'samesite' => 'Strict',
	]);

	// Destroy session
	session_destroy();

	sendJSON(['ok' => true]);
}

/**
 * Handle token refresh
 */
function handleRefresh() {
	global $JWT_SECRET;

	// Get refresh token from cookie
	$refreshToken = $_COOKIE['refresh_jwt'] ?? '';

	if (!$refreshToken) {
		http_response_code(401);
		sendJSON(['ok' => false, 'error' => 'No refresh token']);
	}

	// Verify refresh token
	$payload = verifyJWT($refreshToken, $JWT_SECRET);

	if (!$payload || ($payload['type'] ?? '') !== 'refresh') {
		http_response_code(401);
		sendJSON(['ok' => false, 'error' => 'Invalid refresh token']);
	}

	// Create new access token
	$token = createJWT([
		'sub' => $payload['sub'],
	], $JWT_SECRET, 900); // 15 minutes

	// Set new token cookie
	setcookie('jwt', $token, [
		'expires' => time() + 900,
		'path' => '/',
		'secure' => true,
		'httponly' => true,
		'samesite' => 'Strict',
	]);

	sendJSON([
		'ok' => true,
		'token' => $token,
	]);
}

/**
 * Handle auth check
 */
function handleCheck() {
	if (isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true) {
		sendJSON([
			'ok' => true,
			'authenticated' => true,
			'user' => [
				'id' => $_SESSION['user_id'] ?? null,
				'username' => $_SESSION['username'] ?? null,
				'email' => $_SESSION['email'] ?? null,
			],
			'csrf_token' => $_SESSION['csrf_token'],
		]);
	} else {
		sendJSON([
			'ok' => true,
			'authenticated' => false,
			'csrf_token' => $_SESSION['csrf_token'],
		]);
	}
}

/**
 * Load environment configuration
 */
function loadEnvironment($file) {
	$file = basename($file);
	if ($file !== '.env') {
		die('Invalid configuration file');
	}

	if (!file_exists($file)) {
		die('Configuration file not found');
	}

	$txt = file_get_contents($file);
	$lines = preg_split("/\n/", $txt);

	$out = [];
	$section = '';

	foreach ($lines as $line) {
		if (preg_match("/\[(\w+)\]/", $line, $m)) {
			$section = $m[1];
			$out[$section] = [];
		} else {
			$parts = preg_split("/\s*=\s*/", $line, 2);
			if (count($parts) == 2) {
				$out[$section][$parts[0]] = $parts[1];
			}
		}
	}

	return $out;
}
