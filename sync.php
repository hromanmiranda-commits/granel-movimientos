<?php
// Granel Movimientos - Secure Sync Endpoint
$SECRET_TOKEN = "Granel2026SecureSyncTokenKey";

// CORS headers
header("Access-Control-Allow-Origin: *");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_POST['token'] ?? '';
    $data_js = $_POST['data_js'] ?? '';

    if ($token !== $SECRET_TOKEN) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Invalid secret token"]);
        exit;
    }

    if (!empty($data_js)) {
        if (!is_dir(__DIR__ . '/js')) {
            mkdir(__DIR__ . '/js', 0755, true);
        }
        file_put_contents(__DIR__ . '/js/data.js', $data_js);
        echo json_encode(["status" => "success", "message" => "Data synchronized successfully"]);
        exit;
    }
}

echo json_encode(["status" => "active", "service" => "Granel Movimientos Sync API"]);
?>
