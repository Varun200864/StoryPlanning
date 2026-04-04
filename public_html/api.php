<?php

declare(strict_types=1);

$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private' . DIRECTORY_SEPARATOR . 'data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'store.json';

function ensureStorage(string $dataDir, string $dataFile): void
{
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0775, true);
    }

    if (!file_exists($dataFile)) {
        file_put_contents(
            $dataFile,
            json_encode(['stories' => new stdClass()], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
            LOCK_EX
        );
    }
}

function readStore(string $dataDir, string $dataFile): array
{
    ensureStorage($dataDir, $dataFile);
    $content = file_get_contents($dataFile);
    $store = json_decode($content ?: '', true);

    if (!is_array($store)) {
        $store = ['stories' => []];
    }

    if (!isset($store['stories']) || !is_array($store['stories'])) {
        $store['stories'] = [];
    }

    return $store;
}

function writeStore(string $dataFile, array $store): void
{
    file_put_contents(
        $dataFile,
        json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
}

function sendJson(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function parseBody(): array
{
    $body = file_get_contents('php://input');

    if ($body === false || trim($body) === '') {
        return [];
    }

    $decoded = json_decode($body, true);

    if (!is_array($decoded)) {
        sendJson(400, ['error' => 'Invalid request body.']);
    }

    return $decoded;
}

function normalizeId($value, string $fallback): string
{
    $cleaned = strtolower(trim((string) ($value ?? $fallback)));
    $cleaned = preg_replace('/[^a-z0-9-_]+/', '-', $cleaned ?? '');
    $cleaned = trim((string) $cleaned, '-');

    return $cleaned !== '' ? $cleaned : $fallback;
}

function getOrCreateStory(array &$store, string $storyId): array
{
    if (!isset($store['stories'][$storyId]) || !is_array($store['stories'][$storyId])) {
        $store['stories'][$storyId] = [
            'storyId' => $storyId,
            'adminKey' => bin2hex(random_bytes(12)),
            'revealed' => false,
            'votes' => []
        ];
    }

    if (empty($store['stories'][$storyId]['adminKey'])) {
        $store['stories'][$storyId]['adminKey'] = bin2hex(random_bytes(12));
    }

    if (!isset($store['stories'][$storyId]['votes']) || !is_array($store['stories'][$storyId]['votes'])) {
        $store['stories'][$storyId]['votes'] = [];
    }

    return $store['stories'][$storyId];
}

function toStoryResponse(array $story, bool $includeVotes, bool $isAdmin): array
{
    $voteEntries = array_values($story['votes'] ?? []);

    usort($voteEntries, static function (array $left, array $right): int {
        return strcmp($left['name'] ?? '', $right['name'] ?? '');
    });

    return [
        'storyId' => $story['storyId'],
        'isAdmin' => $isAdmin,
        'revealed' => (bool) $story['revealed'],
        'totalVotes' => count($voteEntries),
        'votes' => $includeVotes
            ? array_map(static function (array $entry): array {
                return [
                    'name' => $entry['name'],
                    'points' => $entry['points']
                ];
            }, $voteEntries)
            : []
    ];
}

function isAdminRequest(array $story): bool
{
    $adminKey = isset($_GET['adminKey']) ? (string) $_GET['adminKey'] : '';
    return $adminKey !== '' && $adminKey === ($story['adminKey'] ?? '');
}

ensureStorage($dataDir, $dataFile);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$route = isset($_GET['route']) ? (string) $_GET['route'] : '/';
$storyId = normalizeId($_GET['story'] ?? 'default-story', 'default-story');

if ($method === 'POST' && $route === '/story/create') {
    $body = parseBody();
    $requestedStoryId = normalizeId($body['storyId'] ?? $storyId, $storyId);
    $store = readStore($dataDir, $dataFile);
    $story = getOrCreateStory($store, $requestedStoryId);
    writeStore($dataFile, $store);

    sendJson(200, [
        'storyId' => $story['storyId'],
        'adminKey' => $story['adminKey']
    ]);
}

if ($method === 'GET' && $route === '/story') {
    $store = readStore($dataDir, $dataFile);
    $story = getOrCreateStory($store, $storyId);
    $isAdmin = isAdminRequest($story);
    writeStore($dataFile, $store);

    sendJson(200, toStoryResponse($story, (bool) $story['revealed'], $isAdmin));
}

if ($method === 'POST' && $route === '/vote') {
    $body = parseBody();
    $name = trim((string) ($body['name'] ?? ''));
    $points = trim((string) ($body['points'] ?? ''));

    if ($name === '' || $points === '') {
        sendJson(400, ['error' => 'Name and story point are required.']);
    }

    $store = readStore($dataDir, $dataFile);
    $story = getOrCreateStory($store, $storyId);
    $voterKey = normalizeId($name, 'user-' . time());

    $story['votes'][$voterKey] = [
        'name' => $name,
        'points' => $points
    ];
    $store['stories'][$storyId] = $story;

    writeStore($dataFile, $store);

    sendJson(200, [
        'message' => 'Vote submitted successfully.',
        'story' => toStoryResponse($story, (bool) $story['revealed'], isAdminRequest($story))
    ]);
}

if ($method === 'POST' && $route === '/reveal') {
    parseBody();
    $store = readStore($dataDir, $dataFile);
    $story = getOrCreateStory($store, $storyId);

    if (!isAdminRequest($story)) {
        sendJson(403, ['error' => 'Only BA can reveal votes.']);
    }

    $story['revealed'] = true;
    $store['stories'][$storyId] = $story;
    writeStore($dataFile, $store);

    sendJson(200, [
        'message' => 'Votes revealed.',
        'story' => toStoryResponse($story, true, true)
    ]);
}

if ($method === 'POST' && $route === '/reset') {
    parseBody();
    $store = readStore($dataDir, $dataFile);
    $story = getOrCreateStory($store, $storyId);

    if (!isAdminRequest($story)) {
        sendJson(403, ['error' => 'Only BA can reset the story.']);
    }

    $store['stories'][$storyId] = [
        'storyId' => $storyId,
        'adminKey' => $story['adminKey'],
        'revealed' => false,
        'votes' => []
    ];

    writeStore($dataFile, $store);

    sendJson(200, [
        'message' => 'Story reset.',
        'story' => toStoryResponse($store['stories'][$storyId], false, true)
    ]);
}

sendJson(404, ['error' => 'Not found']);
