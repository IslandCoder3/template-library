<?php
declare(strict_types=1);

/*
 * Template Library
 * ----------------
 * Every folder inside /templates is one template. Drop a new folder in and it shows up.
 *
 *   templates/
 *     my-template/
 *       my-template.html   (or index.html — the main file, with <style> and <script> inline)
 *       images/, videos/   (any assets the template uses)
 *       meta.json          (optional: title, category, description, tags, entry)
 */

const TL_DIR = __DIR__ . '/templates';

/* ---------- helpers ---------- */

function tl_json(mixed $data, int $code = 200): never {
	http_response_code($code);
	header('Content-Type: application/json; charset=utf-8');
	header('Cache-Control: no-store');
	echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
	exit;
}

function tl_slugs(): array {
	$out = [];
	if (!is_dir(TL_DIR)) return $out;
	foreach (scandir(TL_DIR) as $name) {
		if ($name === '' || $name[0] === '.') continue;
		if (is_dir(TL_DIR . '/' . $name)) $out[] = $name;
	}
	return $out;
}

function tl_meta(string $slug): array {
	$file = TL_DIR . '/' . $slug . '/meta.json';
	if (!is_file($file)) return [];
	$data = json_decode((string) file_get_contents($file), true);
	return is_array($data) ? $data : [];
}

function tl_entry(string $slug, array $meta): ?string {
	$dir = TL_DIR . '/' . $slug;
	$candidates = [];
	if (!empty($meta['entry']) && is_string($meta['entry']) && !str_contains($meta['entry'], '..')) {
		$candidates[] = ltrim(str_replace('\\', '/', $meta['entry']), '/');
	}
	$candidates[] = $slug . '.html';
	$candidates[] = 'index.html';
	foreach ($candidates as $c) {
		if (is_file($dir . '/' . $c)) return $c;
	}
	$any = glob($dir . '/*.html') ?: [];
	sort($any);
	return $any ? basename($any[0]) : null;
}

function tl_url(string $slug, string $entry): string {
	$parts = array_map('rawurlencode', explode('/', $entry));
	return 'templates/' . rawurlencode($slug) . '/' . implode('/', $parts);
}

/* Remove the indentation shared by every line, and trim blank lines at the ends. */
function tl_dedent(string $s): string {
	$s = trim(str_replace("\r\n", "\n", $s), "\n");
	$lines = explode("\n", $s);
	$min = null;
	foreach ($lines as $l) {
		if (trim($l) === '') continue;
		preg_match('/^[ \t]*/', $l, $m);
		$len = strlen($m[0]);
		$min = $min === null ? $len : min($min, $len);
	}
	if (!$min) return rtrim($s);
	foreach ($lines as $i => $l) $lines[$i] = substr($l, $min);
	return rtrim(implode("\n", $lines));
}

/* Split one HTML file into its markup, CSS and JS. */
function tl_parse(string $raw): array {
	$raw = str_replace("\r\n", "\n", $raw);

	$title = null;
	if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $raw, $m)) $title = trim(html_entity_decode($m[1]));

	$css = [];
	if (preg_match_all('/<style\b[^>]*>(.*?)<\/style>/is', $raw, $m)) {
		foreach ($m[1] as $c) if (trim($c) !== '') $css[] = tl_dedent($c);
	}

	$inlineScript = '/<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)<\/script>/is';
	$js = [];
	if (preg_match_all($inlineScript, $raw, $m)) {
		foreach ($m[1] as $j) if (trim($j) !== '') $js[] = tl_dedent($j);
	}

	if (preg_match('/<body\b[^>]*>(.*)<\/body>/is', $raw, $m)) {
		$body = $m[1];
	} else {
		$body = preg_replace('/<head\b[^>]*>.*?<\/head>/is', '', $raw);
		$body = preg_replace('/<!DOCTYPE[^>]*>|<\/?html\b[^>]*>/i', '', (string) $body);
	}
	$body = preg_replace($inlineScript, '', (string) $body);
	$body = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', (string) $body);
	$html = preg_replace("/\n{3,}/", "\n\n", tl_dedent((string) $body));

	return [
		'title' => $title,
		'full'  => $raw,
		'html'  => (string) $html,
		'css'   => implode("\n\n", $css),
		'js'    => implode("\n\n", $js),
	];
}

function tl_files(string $slug): array {
	$base = TL_DIR . '/' . $slug;
	$files = [];
	$it = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS),
		RecursiveIteratorIterator::LEAVES_ONLY
	);
	foreach ($it as $f) {
		if (!$f->isFile()) continue;
		$rel = str_replace('\\', '/', substr($f->getPathname(), strlen($base) + 1));
		if ($rel === 'meta.json' || basename($rel)[0] === '.') continue;
		$files[] = ['path' => $rel, 'size' => $f->getSize()];
	}
	usort($files, fn($a, $b) => strcmp($a['path'], $b['path']));
	return $files;
}

function tl_load(string $slug): ?array {
	if (!in_array($slug, tl_slugs(), true)) return null; // whitelist: blocks path traversal
	$meta = tl_meta($slug);
	$entry = tl_entry($slug, $meta);
	if ($entry === null) return null;
	$parsed = tl_parse((string) file_get_contents(TL_DIR . '/' . $slug . '/' . $entry));
	$title = $meta['title'] ?? $parsed['title'] ?? ucwords(str_replace(['-', '_'], ' ', $slug));
	return [
		'slug'        => $slug,
		'title'       => (string) $title,
		'description' => (string) ($meta['description'] ?? ''),
		'category'    => (string) ($meta['category'] ?? 'General'),
		'tags'        => array_values(array_filter((array) ($meta['tags'] ?? []), 'is_string')),
		'entry'       => $entry,
		'url'         => tl_url($slug, $entry),
		'files'       => tl_files($slug),
		'parsed'      => $parsed,
	];
}

/* ---------- routes ---------- */

if (isset($_GET['download'])) {
	$t = tl_load((string) $_GET['download']);
	if (!$t) { http_response_code(404); exit('Template not found.'); }
	if (!class_exists('ZipArchive')) { http_response_code(500); exit('The PHP zip extension (ZipArchive) is not enabled on this server.'); }

	$tmp = tempnam(sys_get_temp_dir(), 'tl_');
	$zip = new ZipArchive();
	if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) { http_response_code(500); exit('Could not create the zip file.'); }
	foreach ($t['files'] as $f) $zip->addFile(TL_DIR . '/' . $t['slug'] . '/' . $f['path'], $f['path']);
	$zip->close();

	$name = preg_replace('/[^A-Za-z0-9._-]+/', '-', $t['slug']) . '.zip';
	header('Content-Type: application/zip');
	header('Content-Disposition: attachment; filename="' . $name . '"');
	header('Content-Length: ' . filesize($tmp));
	header('Cache-Control: no-store');
	readfile($tmp);
	unlink($tmp);
	exit;
}

if (($_GET['api'] ?? '') === 'code') {
	$t = tl_load((string) ($_GET['slug'] ?? ''));
	if (!$t) tl_json(['error' => 'Template not found'], 404);
	tl_json(['code' => $t['parsed'], 'files' => $t['files']]);
}

/* ---------- page ---------- */

$list = [];
foreach (tl_slugs() as $slug) {
	$t = tl_load($slug);
	if (!$t) continue;
	$list[] = [
		'slug'        => $t['slug'],
		'title'       => $t['title'],
		'description' => $t['description'],
		'category'    => $t['category'],
		'tags'        => $t['tags'],
		'url'         => $t['url'],
		'files'       => $t['files'],
	];
}
usort($list, fn($a, $b) => strcasecmp($a['title'], $b['title']));
$json = json_encode($list, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_INVALID_UTF8_SUBSTITUTE);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Template library</title>
<link rel="stylesheet" href="assets/app.css">
</head>
<body>

<div class="tl_app">

	<aside class="tl_side">
		<div class="tl_side__head">
			<h1 class="tl_side__title">Template library</h1>
			<p class="tl_side__count" id="tl_count"></p>
			<input class="tl_search" id="tl_search" type="search" placeholder="Search templates" aria-label="Search templates" autocomplete="off">
			<div class="tl_cats" id="tl_cats"></div>
		</div>
		<nav class="tl_list" id="tl_list" aria-label="Templates"></nav>
		<details class="tl_help">
			<summary>Add a template</summary>
			<p>Create a folder inside <code>templates/</code> and put the main HTML file, plus any <code>images/</code> or <code>videos/</code>, inside it. Optionally add a <code>meta.json</code> with <code>title</code>, <code>category</code>, <code>description</code> and <code>tags</code>. Refresh this page.</p>
		</details>
	</aside>

	<main class="tl_main" id="tl_main"></main>

</div>

<script>window.TL_TEMPLATES = <?= $json ?>;</script>
<script src="assets/app.js"></script>
</body>
</html>
