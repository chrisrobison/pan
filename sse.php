<?php
// Simple SSE hub for PAN: GET streams events; POST appends and broadcasts.
// - GET /sse.php?topics=topic1,topic2&lastEventId=123
// - POST /sse.php  { "topic": "demo.ping", "data": { ... }, "retain": false }

// Config: file-backed queue under ./.rt
$RT_DIR = __DIR__ . DIRECTORY_SEPARATOR . '.rt';
$SEQ_FILE = $RT_DIR . DIRECTORY_SEPARATOR . 'seq.txt';
$LOG_FILE = $RT_DIR . DIRECTORY_SEPARATOR . 'pan-events.ndjson';

// Ensure runtime dir exists
if (!is_dir($RT_DIR)) { @mkdir($RT_DIR, 0777, true); }
if (!file_exists($SEQ_FILE)) { @file_put_contents($SEQ_FILE, "0\n"); }
if (!file_exists($LOG_FILE)) { @touch($LOG_FILE); }

// CORS - Whitelist specific origins (SECURITY FIX)
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
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Last-Event-ID');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// Helpers
function json_body() {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return null;
  $j = json_decode($raw, true);
  return is_array($j) ? $j : null;
}

function send_json($obj, $code=200) {
  http_response_code($code);
  header('Content-Type: application/json');
  echo json_encode($obj);
  exit;
}

function append_event($logFile, $seqFile, $topic, $data, $retain=false) {
  // Open and lock the log first to compute a safe, monotonic id
  $fp = fopen($logFile, 'ab+');
  if (!$fp) return [null, 'open-log-failed'];
  $locked = @flock($fp, LOCK_EX); // best-effort; proceed even if lock unsupported

  // Compute next id: prefer seq file; if not available, read last id from log
  $id = null;
  $seq = @fopen($seqFile, 'c+');
  if ($seq) {
    if (@flock($seq, LOCK_EX)) {
      $cur = (int)trim(stream_get_contents($seq));
      $id = $cur + 1;
      ftruncate($seq, 0); rewind($seq); fwrite($seq, (string)$id . "\n"); fflush($seq);
      @flock($seq, LOCK_UN);
    }
    @fclose($seq);
  }
  if ($id === null) {
    // Fallback: read last JSON line from log to get id
    $pos = ftell($fp); // should be at end
    if ($pos === false) { $pos = 0; }
    if ($pos > 0) {
      $read = min(8192, $pos);
      fseek($fp, -$read, SEEK_END);
      $chunk = fread($fp, $read) ?: '';
      $lines = preg_split("/\r?\n/", $chunk);
      for ($i=count($lines)-1; $i>=0; $i--) {
        $line = trim($lines[$i]); if ($line==='') continue;
        $rec = json_decode($line, true);
        if (is_array($rec) && isset($rec['id'])) { $id = ((int)$rec['id']) + 1; break; }
      }
    }
    if ($id === null) { $id = 1; }
  }

  // Append record
  $rec = [ 'id'=>$id, 'ts'=>time(), 'topic'=>$topic, 'data'=>$data ];
  if ($retain) $rec['retain'] = true;
  $line = json_encode($rec, JSON_UNESCAPED_SLASHES) . "\n";
  fwrite($fp, $line);
  fflush($fp);
  if ($locked) { @flock($fp, LOCK_UN); }
  fclose($fp);
  return [$id, null];
}

function get_param($name, $default=null) {
  if (isset($_GET[$name])) return $_GET[$name];
  if (isset($_POST[$name])) return $_POST[$name];
  return $default;
}

function topic_matches($topic, $patterns) {
  if (!$patterns || count($patterns) === 0) return true;
  foreach ($patterns as $p) {
    $p = trim($p);
    if ($p === '' || $p === '*') return true;
    // Convert PAN wildcard ("*" for single token) to regex
    $re = '/^' . str_replace('\\*', '[^.]+', preg_quote($p, '/')) . '$/';
    if (preg_match($re, $topic)) return true;
  }
  return false;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $body = json_body();
  if (!$body || !isset($body['topic'])) {
    send_json(['ok'=>false, 'error'=>'invalid-payload: require {topic, data?}'], 400);
  }
  $topic = (string)$body['topic'];
  $data = isset($body['data']) ? $body['data'] : null;
  $retain = isset($body['retain']) ? !!$body['retain'] : false;
  list($id, $err) = append_event($LOG_FILE, $SEQ_FILE, $topic, $data, $retain);
  if ($id === null) send_json(['ok'=>false, 'error'=>$err ?: 'append-failed'], 500);
  send_json(['ok'=>true, 'id'=>$id]);
}

// SSE stream (GET)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  // Headers for SSE
  header('Content-Type: text/event-stream');
  header('Cache-Control: no-cache');
  header('Connection: keep-alive');
  header('X-Accel-Buffering: no'); // Nginx: disable proxy buffering

  @ini_set('output_buffering', 'off');
  @ini_set('zlib.output_compression', '0');
  @ini_set('implicit_flush', '1');
  @apache_setenv('no-gzip', 1);
  while (ob_get_level() > 0) { @ob_end_flush(); }
  @ob_implicit_flush(1);

  ignore_user_abort(true);
  set_time_limit(0);

  $topicsRaw = (string)get_param('topics', '');
  $patterns = array_filter(array_map('trim', preg_split('/[,\s]+/', $topicsRaw)));
  $lastId = null;
  if (isset($_GET['lastEventId'])) $lastId = (int)$_GET['lastEventId'];
  // Also accept Last-Event-ID header
  $hdrLast = isset($_SERVER['HTTP_LAST_EVENT_ID']) ? (int)$_SERVER['HTTP_LAST_EVENT_ID'] : null;
  if ($lastId === null && $hdrLast !== null) $lastId = $hdrLast;

  $fp = fopen($LOG_FILE, 'rb');
  if (!$fp) { echo ": failed to open log\n\n"; flush(); exit; }

  // Fast-forward to lastId if provided
  $nextKeepAlive = time() + 15;
  $deadline = time() + 300; // 5 minutes per connection; client will reconnect

  // Helper to emit one SSE event
  $emit = function($rec) {
    $id = isset($rec['id']) ? (int)$rec['id'] : 0;
    $topic = isset($rec['topic']) ? (string)$rec['topic'] : '';
    $data = isset($rec['data']) ? $rec['data'] : null;
    $retain = isset($rec['retain']) ? (bool)$rec['retain'] : false;
    if (!$topic) return;
    echo 'id: ' . $id . "\n";
    echo 'event: ' . $topic . "\n";
    $payload = [ 'topic'=>$topic, 'data'=>$data ];
    if ($retain) $payload['retain'] = true;
    echo 'data: ' . json_encode($payload, JSON_UNESCAPED_SLASHES) . "\n\n";
  };

  // Read existing lines and position to end
  $pos = 0;
  while (!feof($fp)) {
    $line = fgets($fp);
    if ($line === false) break;
    $pos += strlen($line);
    $rec = json_decode($line, true);
    if (!is_array($rec)) continue;
    if ($lastId !== null && isset($rec['id']) && (int)$rec['id'] <= $lastId) continue;
    if (!topic_matches($rec['topic'] ?? '', $patterns)) continue;
    $emit($rec);
    flush();
  }

  // Tail the file for new lines
  while (!connection_aborted() && time() < $deadline) {
    clearstatcache(false, $LOG_FILE);
    $size = @filesize($LOG_FILE);
    if ($size === false) { usleep(200000); continue; }
    if ($size < $pos) { // rotated/truncated
      fclose($fp);
      $fp = fopen($LOG_FILE, 'rb');
      $pos = 0;
    }
    if ($size > $pos) {
      fseek($fp, $pos);
      while (!feof($fp)) {
        $line = fgets($fp);
        if ($line === false) break;
        $pos += strlen($line);
        $rec = json_decode($line, true);
        if (!is_array($rec)) continue;
        if (!topic_matches($rec['topic'] ?? '', $patterns)) continue;
        $emit($rec);
        flush();
      }
    } else {
      // Keepalive comment to keep proxies happy
      if (time() >= $nextKeepAlive) {
        echo ": keepalive\n\n";
        flush();
        $nextKeepAlive = time() + 15;
      }
      usleep(300000); // 300ms
    }
  }

  fclose($fp);
  exit;
}

// Fallback
send_json(['ok'=>false, 'error'=>'method-not-allowed'], 405);
