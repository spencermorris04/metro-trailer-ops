<?php

require_once __DIR__ . '/../src/class-metro-registration-graph-client.php';

$trailer_number = $argv[1] ?? '5318190';
$output_dir = getenv('METRO_REGISTRATION_OUTPUT_DIR') ?: __DIR__ . '/../artifacts';

try {
    $client = new Metro_Registration_Graph_Client();
    $pdf = $client->get_registration_pdf($trailer_number);

    if (!is_dir($output_dir)) {
        mkdir($output_dir, 0775, true);
    }

    $filename = preg_replace('/[^A-Za-z0-9._-]/', '_', $pdf['filename']);
    $output_path = rtrim($output_dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $trailer_number . '-' . $filename;
    file_put_contents($output_path, $pdf['content']);

    fwrite(STDOUT, "Saved PDF to {$output_path}\n");
    fwrite(STDOUT, "File URL: " . ($pdf['web_url'] ?? 'n/a') . "\n");
    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . "\n");
    exit(1);
}
