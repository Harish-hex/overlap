<?php
return [
    'dsn'  => getenv('OVERLAP_DSN') ?: 'mysql:host=127.0.0.1;dbname=overlap;charset=utf8mb4',
    'user' => getenv('OVERLAP_DB_USER') ?: 'overlap',
    'pass' => getenv('OVERLAP_DB_PASS') ?: 'overlap_dev',
];
