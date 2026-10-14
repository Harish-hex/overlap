<?php
// Dev router: php -S localhost:8080 -t public public/router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($path, '/api')) { require __DIR__ . '/../api/index.php'; return true; }
if (preg_match('#^/e/\w+/?$#', $path)) { readfile(__DIR__ . '/e/index.html'); return true; }
if ($path === '/') { header('Location: /app/'); return true; }
if ($path === '/app' ) { header('Location: /app/'); return true; }
return false;
