<?php

$env = loadEnvironment('.env');

$in = $_REQUEST;

$link = mysqli_connect($env['db']['host'], $env['db']['user'], $env['db']['pass'], $env['db']['db']);
$out = '';

if (isset($in['x'])) {
	$out = "";
	switch($in['x']) {
		case "list_resources":
			$out = listResources();
			break;
		case "get":
			$out = get();
			break;
		case "list_fields":
			$out = listFields();
			break;
		default:
			$out = get();
	}
} else {
	$out = ['status'=>'error', 'msg'=>'Invalid request'];
}

if ($out != "") {
	sendJSON($out);
	exit;
}

function get() {
	global $in;
	global $link;

	$page_size = isset($in['page_size']) ? $in['page_size'] : 20;
	if ($page_size > 20) $page_size = 20;

	if (isset($in['rsc'])) {
		$out = [];
		$fields = isset($in['fields']) ? $in['fields'] : '*';

		if (isset($in['id'])) {
			$sql = "SELECT {$fields} FROM `{$in['rsc']}` WHERE {$in['rsc']}ID='{$in['id']}'";
			$result = $link->query($sql);

			while($rec = $result->fetch_object()) { $out[] = $rec; }

		} else {
			$start = isset($in['start']) ? $in['start'] : 0;
			$where = "";
			if (isset($in['filters'])) {
				$filters = json_decode($in['filters']);
				if (count($filters)) {
					$wheres = [];
					foreach ($filters as $filter) {
						$wheres[] = $filter->key . " LIKE '%" . $filter->value . "%' ";
					}
					$where = " WHERE " . join(" AND ", $wheres);
				}
			}
			$sql = "SELECT COUNT(*) FROM `{$in['rsc']}` {$where}";
			$result = $link->query($sql);
			$out['total'] = $result->fetch_row()[0];
			$out['start'] = $start;

			$sql = "SELECT {$fields} FROM `{$in['rsc']}` {$where} LIMIT {$start}, {$page_size}";
			$result = $link->query($sql);
			$out['results'] = [];
			while($rec = $result->fetch_object()) { $out['results'][] = $rec; }
			$out['count'] = count($out['results']);
			$out['pages'] = ceil($out['total'] / $page_size);
			$out['page'] = floor($start / $page_size) + 1;
		}

	}
	
	return $out;
}

function listResources() {
	global $in;
	global $link;

	$sql = "SHOW TABLES";

	if (isset($in['filter'])) {
		$sql .= " LIKE '%{$in['filter']}%'";
	}

	$result = $link->query($sql);
	$tbls = [];
	while ($tbl = $result->fetch_array()) {
		$tbls[] = $tbl[0];
	}
	$out = ["Resources"=>$tbls];

	return $out;
}

function listFields() {
	global $in;
	global $link;

	if (!isset($in['rsc']) || $in['rsc'] === '') {
		return [ 'status' => 'error', 'msg' => 'Missing rsc' ];
	}

	$table = $link->real_escape_string($in['rsc']);
	$fields = [];
	$pk = null;

	// Describe columns
	$sql = "SHOW COLUMNS FROM `{$table}`";
	if ($res = $link->query($sql)) {
		while ($col = $res->fetch_assoc()) {
			$fields[] = [
				'Field' => $col['Field'],
				'Type' => $col['Type'],
				'Null' => $col['Null'],
				'Key' => $col['Key'],
				'Default' => $col['Default'],
				'Extra' => $col['Extra']
			];
			if ($col['Key'] === 'PRI' && $pk === null) { $pk = $col['Field']; }
		}
	}

	// Fallback to conventional <Table>ID if no explicit PK found
	if ($pk === null) { $pk = $table . 'ID'; }

	return [ 'Resource' => $table, 'PrimaryKey' => $pk, 'Fields' => $fields ];
}

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

function loadEnvironment($file) {
	$txt = file_get_contents($file);
	$lines = preg_split("/\n/", $txt);
	
	$out = [];
	$cur = '';
	$section = '';

	foreach ($lines as $line) {
		if (preg_match("/\[(\w+)\]/", $line, $m)) {
			$section = $m[1];
			$out[$section] = [];
			$cur = $out[$section];
		} else {
			$parts = preg_split("/\s*=\s*/", $line, 2);
			if (count($parts) ==2) {
				$out[$section][$parts[0]] = $parts[1];
			}
		}
	}

	return $out;
}
