<?php
// scope-reader.php — reads up to 4 project photos with Gemini vision, extracts the
// SCOPE (which trades, condition, approximate size, what's visible), then turns
// that scope into a dollar range using pricing.php — DPG's own rate table.
//
// The AI never produces a price. It describes what it sees. The arithmetic is ours.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$PER_MIN    = 4;
$PER_DAY    = 25;
$GLOBAL_DAY = 300;
$MAX_BYTES  = 8 * 1024 * 1024;   // per file
$MAX_FILES  = 4;

function out($a) { echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }
function fail($r) { out(['ok' => false, 'reason' => $r]); }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); fail('method'); }

// --- same-origin guard ---
$host = strtolower($_SERVER['HTTP_HOST'] ?? '');
$src  = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($src !== '') {
  $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
  if ($srcHost === '' || $srcHost !== $host) { http_response_code(403); fail('origin'); }
}

// --- rate limiting ---
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$tmp = sys_get_temp_dir(); $now = time(); $today = date('Ymd');
$ipFile = $tmp . '/dpg_scope_' . md5($ip) . '.json';
$stamps = is_file($ipFile) ? json_decode(@file_get_contents($ipFile), true) : [];
if (!is_array($stamps)) $stamps = [];
$inMin = array_filter($stamps, function ($t) use ($now) { return $t > $now - 60; });
$inDay = array_filter($stamps, function ($t) use ($now) { return $t > $now - 86400; });
if (count($inMin) >= $PER_MIN) fail('rate_min');
if (count($inDay) >= $PER_DAY) fail('rate_day');
$gFile = $tmp . '/dpg_scope_global_' . $today . '.txt';
$gCount = is_file($gFile) ? (int) @file_get_contents($gFile) : 0;
if ($gCount >= $GLOBAL_DAY) fail('rate_global');

// --- inputs ---
$area   = isset($_POST['area']) ? (float) $_POST['area'] : 0;      // sq ft, homeowner-supplied
$finish = strtolower(trim((string) ($_POST['finish'] ?? 'mid')));
if (!in_array($finish, ['basic', 'mid', 'premium'], true)) $finish = 'mid';
if ($area <= 0 || $area > 20000) fail('area');

// --- files ---
if (empty($_FILES['photos'])) fail('no_files');
$names = $_FILES['photos']['tmp_name'];
if (!is_array($names)) fail('no_files');
$parts = [];
$count = 0;
foreach ($names as $i => $tmpName) {
  if ($count >= $MAX_FILES) break;
  if (!is_uploaded_file($tmpName)) continue;
  if (($_FILES['photos']['error'][$i] ?? 1) !== 0) continue;
  $size = (int) ($_FILES['photos']['size'][$i] ?? 0);
  if ($size <= 0 || $size > $MAX_BYTES) fail('size');
  $bytes = @file_get_contents($tmpName);
  if ($bytes === false || $bytes === '') continue;
  $mime = '';
  if (function_exists('finfo_open')) {
    $fi = finfo_open(FILEINFO_MIME_TYPE);
    $mime = (string) finfo_file($fi, $tmpName);
    finfo_close($fi);
  }
  $mime = strtolower(trim($mime));
  if ($mime === 'image/jpg') $mime = 'image/jpeg';
  if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], true)) fail('type');
  $parts[] = ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode($bytes)]];
  $count++;
}
if (!$parts) fail('no_files');

// --- key ---
$key = getenv('GEMINI_API_KEY');
if (!$key && is_file(__DIR__ . '/../gemini_api_key.php')) { $key = @include __DIR__ . '/../gemini_api_key.php'; }
if (!$key && is_file(__DIR__ . '/secret_config.php'))     { $key = @include __DIR__ . '/secret_config.php'; }
$key = is_string($key) ? trim($key) : '';
if ($key === '' || $key === 'TU_CLAVE_AQUI') fail('no_key');

// register the request
$stamps[] = $now;
$stamps = array_slice($stamps, -200);
@file_put_contents($ipFile, json_encode(array_values($stamps)), LOCK_EX);
@file_put_contents($gFile, (string) ($gCount + 1), LOCK_EX);

// --- extraction instruction: SCOPE ONLY, never money ---
$INSTR = <<<'TXT'
You are a residential construction estimator's assistant looking at photos of a homeowner's space. Identify the SCOPE of work visible. Return ONLY a valid JSON object (no prose, no ```), with EXACTLY these keys:

{
  "is_construction_photo": true/false,
  "space_type": string or null,
  "trades": [ { "trade": string, "share": number, "what": string } ],
  "condition": "good" | "fair" | "poor" | null,
  "complexity_notes": [ string ],
  "unknowns": [ string ],
  "confidence": "high" | "medium" | "low"
}

Rules:
- "trade" MUST be exactly one of: kitchen, bathroom, flooring, painting, deck, fireplace, roofing, framing, renovation.
- "share" is that trade's fraction of the total work, 0 to 1. All shares must add to 1.0. Use a DOT as the decimal separator.
- "what" is one short sentence on what that trade involves here, based only on what you can see.
- "condition": "good" = cosmetic update, structure looks sound. "fair" = some repair likely. "poor" = visible water damage, rot, or probable structural repair.
- "complexity_notes": up to 4 short items that would drive cost up or down (e.g. "vaulted ceiling", "plumbing appears to move", "load-bearing wall likely"). Only what the photos support.
- "unknowns": up to 4 short items you genuinely cannot tell from photos and that a site visit must confirm (e.g. "condition behind the tile", "subfloor", "electrical panel capacity").
- "is_construction_photo" is false if these are not photos of a building space.
- NEVER output any price, cost, dollar figure, rate, or duration. That is not your job and any number you produce would be wrong.
- If you cannot tell something, say so via "unknowns" and lower "confidence". Do not guess.
TXT;

$parts[] = ['text' => $INSTR];

$payload = [
  'contents' => [['role' => 'user', 'parts' => $parts]],
  'generationConfig' => [
    'temperature'      => 0.1,
    'maxOutputTokens'  => 1200,
    'responseMimeType' => 'application/json',
    'thinkingConfig'   => ['thinkingBudget' => 0],
  ],
];

$url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . urlencode($key);
$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
  CURLOPT_TIMEOUT => 60,
]);
$resp = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);
if ($resp === false || $code >= 400) { @error_log('[dpg-scope] http ' . $code . ' ' . $err . ' ' . substr((string) $resp, 0, 300)); fail('ai'); }

$data = json_decode($resp, true);
$text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

function extract_json($s) {
  $s = trim((string) $s);
  $s = preg_replace('/^```(?:json)?/i', '', $s);
  $s = preg_replace('/```$/', '', trim($s));
  $a = strpos($s, '{'); $b = strrpos($s, '}');
  if ($a === false || $b === false || $b < $a) return null;
  $d = json_decode(substr($s, $a, $b - $a + 1), true);
  return is_array($d) ? $d : null;
}
$p = extract_json($text);
if (!$p) { @error_log('[dpg-scope] unparseable: ' . substr($text, 0, 300)); fail('ai'); }

if (!($p['is_construction_photo'] ?? true)) fail('not_construction');

// --- sanitize the scope ---
$VALID = ['kitchen','bathroom','flooring','painting','deck','fireplace','roofing','framing','renovation'];
$trades = [];
$sum = 0.0;
foreach ((array) ($p['trades'] ?? []) as $t) {
  $name = strtolower(trim((string) ($t['trade'] ?? '')));
  if (!in_array($name, $VALID, true)) continue;
  $share = (float) ($t['share'] ?? 0);
  if ($share <= 0) continue;
  $trades[] = ['trade' => $name, 'share' => $share, 'what' => mb_substr((string) ($t['what'] ?? ''), 0, 200)];
  $sum += $share;
}
if (!$trades || $sum <= 0) fail('no_scope');
foreach ($trades as $i => $t) { $trades[$i]['share'] = $t['share'] / $sum; }   // normalize

$condition = strtolower((string) ($p['condition'] ?? 'good'));
if (!in_array($condition, ['good','fair','poor'], true)) $condition = 'good';
$confidence = strtolower((string) ($p['confidence'] ?? 'medium'));
if (!in_array($confidence, ['high','medium','low'], true)) $confidence = 'medium';

function short_list($arr, $n, $len) {
  $o = [];
  foreach ((array) $arr as $v) {
    if (!is_string($v)) continue;
    $v = trim($v);
    if ($v === '') continue;
    $o[] = mb_substr($v, 0, $len);
    if (count($o) >= $n) break;
  }
  return $o;
}

// --- the money: OUR rates, not the AI's ---
$cfg = @include __DIR__ . '/pricing.php';
if (!is_array($cfg)) $cfg = [];
$ratesReady = !empty($cfg['rates_confirmed']);

$fmult = (float) ($cfg['finish_multiplier'][$finish] ?? 1.0);
$cmult = (float) ($cfg['condition_multiplier'][$condition] ?? 1.0);
$unc   = (float) ($cfg['uncertainty'] ?? 0.15);

$low = 0.0; $high = 0.0; $days = 0.0; $lines = [];
foreach ($trades as $t) {
  $r = $cfg['trades'][$t['trade']] ?? null;
  $sf = $area * $t['share'];
  $label = $r['label'] ?? ucfirst($t['trade']);
  $l = $r ? ((float) $r['low']  * $sf * $fmult * $cmult) : 0.0;
  $h = $r ? ((float) $r['high'] * $sf * $fmult * $cmult) : 0.0;
  if ($r && !empty($r['min_job'])) { $l = max($l, (float) $r['min_job']); $h = max($h, (float) $r['min_job']); }
  $low += $l; $high += $h;
  $days += ((float) ($cfg['days_per_100sf'][$t['trade']] ?? 0)) * ($sf / 100);
  $lines[] = [
    'label'   => $label,
    'sqft'    => round($sf),
    'share'   => round($t['share'] * 100),
    'what'    => $t['what'],
    'low'     => $ratesReady ? (int) round($l) : null,
    'high'    => $ratesReady ? (int) round($h) : null,
  ];
}
$low  = (int) round($low  * (1 - $unc));
$high = (int) round($high * (1 + $unc));

out([
  'ok'          => true,
  'rates_ready' => $ratesReady,
  'space_type'  => is_string($p['space_type'] ?? null) ? mb_substr($p['space_type'], 0, 60) : null,
  'condition'   => $condition,
  'confidence'  => $confidence,
  'finish'      => $finish,
  'area'        => round($area),
  'lines'       => $lines,
  'notes'       => short_list($p['complexity_notes'] ?? [], 4, 120),
  'unknowns'    => short_list($p['unknowns'] ?? [], 4, 120),
  'range'       => $ratesReady ? ['low' => $low, 'high' => $high] : null,
  'days'        => ($ratesReady && $days > 0) ? ['low' => (int) floor($days * 0.8), 'high' => (int) ceil($days * 1.4)] : null,
]);
