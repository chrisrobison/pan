<?php
/**
 * Secure API Endpoint for PAN
 *
 * Security Improvements:
 * ✓ Prepared statements for all SQL queries
 * ✓ Session-based authentication
 * ✓ CSRF protection
 * ✓ Input validation and sanitization
 * ✓ Resource whitelist
 * ✓ Rate limiting
 * ✓ Security headers
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
	header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
	header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
}

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
	http_response_code(204);
	exit;
}

// Start session for authentication
session_start();

// Rate limiting (simple implementation)
function checkRateLimit($action, $limit = 100, $window = 60) {
	$key = "ratelimit_{$action}_" . ($_SESSION['user_id'] ?? $_SERVER['REMOTE_ADDR']);
	$now = time();

	if (!isset($_SESSION[$key])) {
		$_SESSION[$key] = ['count' => 0, 'reset' => $now + $window];
	}

	$data = $_SESSION[$key];

	// Reset if window expired
	if ($now > $data['reset']) {
		$_SESSION[$key] = ['count' => 1, 'reset' => $now + $window];
		return true;
	}

	// Check limit
	if ($data['count'] >= $limit) {
		http_response_code(429);
		sendJSON(['status' => 'error', 'msg' => 'Rate limit exceeded']);
		exit;
	}

	$_SESSION[$key]['count']++;
	return true;
}

// Authentication check
function requireAuth() {
	if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
		http_response_code(401);
		sendJSON(['status' => 'error', 'msg' => 'Authentication required']);
		exit;
	}
	return true;
}

// CSRF protection
function validateCSRF() {
	if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
		$token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
		$sessionToken = $_SESSION['csrf_token'] ?? '';

		if (!$token || !$sessionToken || !hash_equals($sessionToken, $token)) {
			http_response_code(403);
			sendJSON(['status' => 'error', 'msg' => 'CSRF token invalid']);
			exit;
		}
	}
}

// Generate CSRF token
if (!isset($_SESSION['csrf_token'])) {
	$_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Resource whitelist (prevent arbitrary table access)
$ALLOWED_RESOURCES = [
	'users' => ['table' => 'users', 'pk' => 'userID'],
	'posts' => ['table' => 'posts', 'pk' => 'postID'],
	'comments' => ['table' => 'comments', 'pk' => 'commentID'],
	// Add your tables here
];

// Field whitelist per resource
$ALLOWED_FIELDS = [
	'users' => ['userID', 'username', 'email', 'created_at', 'updated_at'],
	'posts' => ['postID', 'title', 'content', 'userID', 'created_at'],
	'comments' => ['commentID', 'content', 'postID', 'userID', 'created_at'],
];

// Load environment
$env = loadEnvironment('.env');

// Database connection with error handling
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
	sendJSON(['status' => 'error', 'msg' => 'Database unavailable']);
	exit;
}

// Require authentication for all operations
requireAuth();

// Validate CSRF token
validateCSRF();

// Rate limiting
checkRateLimit('api_request');

// Get request input
$in = $_REQUEST;

// Route request
$action = $in['x'] ?? '';
$out = '';

switch($action) {
	case 'list_resources':
		$out = listResources();
		break;
	case 'get':
		$out = get();
		break;
	case 'list_fields':
		$out = listFields();
		break;
	case 'save':
		$out = save();
		break;
	case 'delete':
		$out = delete();
		break;
	default:
		$out = ['status' => 'error', 'msg' => 'Invalid action'];
}

sendJSON($out);
exit;

/**
 * Get resource data (list or single item)
 */
function get() {
	global $in, $link, $ALLOWED_RESOURCES, $ALLOWED_FIELDS;

	// Validate resource
	$resource = $in['rsc'] ?? '';
	if (!isset($ALLOWED_RESOURCES[$resource])) {
		return ['status' => 'error', 'msg' => 'Invalid resource'];
	}

	$config = $ALLOWED_RESOURCES[$resource];
	$table = $config['table'];
	$pk = $config['pk'];

	// Get allowed fields for this resource
	$allowedFields = $ALLOWED_FIELDS[$resource] ?? ['*'];
	$requestedFields = isset($in['fields']) ? explode(',', $in['fields']) : $allowedFields;

	// Validate requested fields
	$fields = [];
	foreach ($requestedFields as $field) {
		$field = trim($field);
		if (in_array($field, $allowedFields)) {
			$fields[] = "`$field`";
		}
	}

	if (empty($fields)) {
		$fields = array_map(fn($f) => "`$f`", $allowedFields);
	}

	$fieldList = implode(', ', $fields);

	// Single item by ID
	if (isset($in['id'])) {
		$stmt = $link->prepare("SELECT $fieldList FROM `$table` WHERE `$pk` = ? LIMIT 1");
		$stmt->bind_param('i', $in['id']);
		$stmt->execute();
		$result = $stmt->get_result();

		$out = [];
		while ($rec = $result->fetch_object()) {
			$out[] = $rec;
		}
		$stmt->close();

		return $out;
	}

	// List with pagination
	$page_size = isset($in['page_size']) ? (int)$in['page_size'] : 20;
	$page_size = max(1, min($page_size, 100)); // Limit to 100 max

	$start = isset($in['start']) ? (int)$in['start'] : 0;
	$start = max(0, $start);

	// Build WHERE clause from filters
	$where = '';
	$whereParams = [];
	$whereTypes = '';

	if (isset($in['filters'])) {
		$filters = json_decode($in['filters'], true);
		if (is_array($filters) && count($filters) > 0) {
			$wheres = [];
			foreach ($filters as $filter) {
				$key = $filter['key'] ?? '';
				$value = $filter['value'] ?? '';

				// Validate filter key is in allowed fields
				if (in_array($key, $allowedFields)) {
					$wheres[] = "`$key` LIKE ?";
					$whereParams[] = "%$value%";
					$whereTypes .= 's';
				}
			}

			if (!empty($wheres)) {
				$where = ' WHERE ' . implode(' AND ', $wheres);
			}
		}
	}

	// Count total
	$stmt = $link->prepare("SELECT COUNT(*) as total FROM `$table` $where");
	if (!empty($whereParams)) {
		$stmt->bind_param($whereTypes, ...$whereParams);
	}
	$stmt->execute();
	$result = $stmt->get_result();
	$total = $result->fetch_object()->total;
	$stmt->close();

	// Get paginated results
	$stmt = $link->prepare("SELECT $fieldList FROM `$table` $where LIMIT ? OFFSET ?");
	$params = array_merge($whereParams, [$page_size, $start]);
	$types = $whereTypes . 'ii';
	$stmt->bind_param($types, ...$params);
	$stmt->execute();
	$result = $stmt->get_result();

	$results = [];
	while ($rec = $result->fetch_object()) {
		$results[] = $rec;
	}
	$stmt->close();

	return [
		'total' => $total,
		'start' => $start,
		'count' => count($results),
		'pages' => ceil($total / $page_size),
		'page' => floor($start / $page_size) + 1,
		'results' => $results
	];
}

/**
 * List available resources
 */
function listResources() {
	global $ALLOWED_RESOURCES;

	// Return only whitelisted resources (don't query database)
	$resources = array_keys($ALLOWED_RESOURCES);

	return ['Resources' => $resources];
}

/**
 * List fields for a resource
 */
function listFields() {
	global $in, $link, $ALLOWED_RESOURCES, $ALLOWED_FIELDS;

	$resource = $in['rsc'] ?? '';
	if (!isset($ALLOWED_RESOURCES[$resource])) {
		return ['status' => 'error', 'msg' => 'Invalid resource'];
	}

	$config = $ALLOWED_RESOURCES[$resource];
	$table = $config['table'];
	$pk = $config['pk'];
	$allowedFields = $ALLOWED_FIELDS[$resource] ?? [];

	// Get column information (using prepared statement)
	$stmt = $link->prepare("SHOW COLUMNS FROM `$table`");
	$stmt->execute();
	$result = $stmt->get_result();

	$fields = [];
	while ($col = $result->fetch_assoc()) {
		// Only include whitelisted fields
		if (in_array($col['Field'], $allowedFields)) {
			$fields[] = [
				'Field' => $col['Field'],
				'Type' => $col['Type'],
				'Null' => $col['Null'],
				'Key' => $col['Key'],
				'Default' => $col['Default'],
				'Extra' => $col['Extra']
			];
		}
	}
	$stmt->close();

	return [
		'Resource' => $resource,
		'PrimaryKey' => $pk,
		'Fields' => $fields
	];
}

/**
 * Save (create or update) a resource item
 */
function save() {
	global $in, $link, $ALLOWED_RESOURCES, $ALLOWED_FIELDS;

	$resource = $in['rsc'] ?? '';
	if (!isset($ALLOWED_RESOURCES[$resource])) {
		return ['status' => 'error', 'msg' => 'Invalid resource'];
	}

	$config = $ALLOWED_RESOURCES[$resource];
	$table = $config['table'];
	$pk = $config['pk'];
	$allowedFields = $ALLOWED_FIELDS[$resource] ?? [];

	// Get data from request
	$data = json_decode($in['data'] ?? '{}', true);
	if (!is_array($data)) {
		return ['status' => 'error', 'msg' => 'Invalid data format'];
	}

	// Filter to only allowed fields
	$filteredData = [];
	foreach ($data as $key => $value) {
		if (in_array($key, $allowedFields) && $key !== $pk) {
			$filteredData[$key] = $value;
		}
	}

	if (empty($filteredData)) {
		return ['status' => 'error', 'msg' => 'No valid fields to save'];
	}

	// Update existing record
	if (isset($in['id']) && $in['id']) {
		$sets = [];
		$values = [];
		$types = '';

		foreach ($filteredData as $key => $value) {
			$sets[] = "`$key` = ?";
			$values[] = $value;
			$types .= is_int($value) ? 'i' : 's';
		}

		$values[] = $in['id'];
		$types .= 'i';

		$sql = "UPDATE `$table` SET " . implode(', ', $sets) . " WHERE `$pk` = ?";
		$stmt = $link->prepare($sql);
		$stmt->bind_param($types, ...$values);
		$stmt->execute();
		$stmt->close();

		return ['status' => 'success', 'id' => $in['id']];
	}

	// Insert new record
	$fields = array_keys($filteredData);
	$values = array_values($filteredData);
	$types = '';

	foreach ($values as $value) {
		$types .= is_int($value) ? 'i' : 's';
	}

	$fieldList = '`' . implode('`, `', $fields) . '`';
	$placeholders = implode(', ', array_fill(0, count($fields), '?'));

	$sql = "INSERT INTO `$table` ($fieldList) VALUES ($placeholders)";
	$stmt = $link->prepare($sql);
	$stmt->bind_param($types, ...$values);
	$stmt->execute();
	$insertId = $stmt->insert_id;
	$stmt->close();

	return ['status' => 'success', 'id' => $insertId];
}

/**
 * Delete a resource item
 */
function delete() {
	global $in, $link, $ALLOWED_RESOURCES;

	$resource = $in['rsc'] ?? '';
	if (!isset($ALLOWED_RESOURCES[$resource])) {
		return ['status' => 'error', 'msg' => 'Invalid resource'];
	}

	if (!isset($in['id']) || !$in['id']) {
		return ['status' => 'error', 'msg' => 'ID required'];
	}

	$config = $ALLOWED_RESOURCES[$resource];
	$table = $config['table'];
	$pk = $config['pk'];

	$stmt = $link->prepare("DELETE FROM `$table` WHERE `$pk` = ? LIMIT 1");
	$stmt->bind_param('i', $in['id']);
	$stmt->execute();
	$affected = $stmt->affected_rows;
	$stmt->close();

	if ($affected > 0) {
		return ['status' => 'success'];
	} else {
		return ['status' => 'error', 'msg' => 'Record not found'];
	}
}

/**
 * Send JSON response
 */
function sendJSON($obj) {
	if (gettype($obj) != "string") {
		$json = json_encode($obj);
	} else {
		$json = $obj;
	}

	header("Content-Type: application/json");
	print $json;
	exit;
}

/**
 * Load environment configuration
 * Secured: only loads .env from current directory
 */
function loadEnvironment($file) {
	// Security: only allow .env file, prevent directory traversal
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
