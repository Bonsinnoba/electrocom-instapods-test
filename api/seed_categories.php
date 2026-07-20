<?php
header('Content-Type: application/json');
require_once 'db.php';

// Initial categories to seed
$initialCategories = [
    [
        'name' => 'Optics',
        'slug' => 'optics',
        'description' => 'Optical components including lenses, LEDs, displays, and light sensors',
        'icon' => 'Eye',
        'display_order' => 1,
        'is_active' => true
    ],
    [
        'name' => 'Connectors',
        'slug' => 'connectors',
        'description' => 'Electrical and electronic connectors for various applications',
        'icon' => 'Plug',
        'display_order' => 2,
        'is_active' => true
    ],
    [
        'name' => 'Electromechanical',
        'slug' => 'electromechanical',
        'description' => 'Electromechanical components including switches, relays, and motors',
        'icon' => 'Zap',
        'display_order' => 3,
        'is_active' => true
    ],
    [
        'name' => 'Semiconductors',
        'slug' => 'semiconductors',
        'description' => 'Semiconductor components including ICs, transistors, and diodes',
        'icon' => 'Cpu',
        'display_order' => 4,
        'is_active' => true
    ],
    [
        'name' => 'Passives',
        'slug' => 'passives',
        'description' => 'Passive components including resistors, capacitors, and inductors',
        'icon' => 'Zap',
        'display_order' => 5,
        'is_active' => true
    ],
    [
        'name' => 'Gadgets',
        'slug' => 'gadgets',
        'description' => 'Non-component products and gadgets',
        'icon' => 'Package',
        'display_order' => 6,
        'is_active' => true
    ]
];

try {
    $pdo->beginTransaction();

    $insertedCount = 0;
    $skippedCount = 0;

    foreach ($initialCategories as $category) {
        // Check if category already exists
        $checkStmt = $pdo->prepare("SELECT id FROM categories WHERE name = ? OR slug = ?");
        $checkStmt->execute([$category['name'], $category['slug']]);
        
        if ($checkStmt->fetch()) {
            $skippedCount++;
            continue;
        }

        // Insert the category
        $stmt = $pdo->prepare("INSERT INTO categories (name, slug, description, icon, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $category['name'],
            $category['slug'],
            $category['description'],
            $category['icon'],
            $category['display_order'],
            $category['is_active'] ? 1 : 0
        ]);
        
        $insertedCount++;
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => "Seeded {$insertedCount} categories, skipped {$skippedCount} existing categories",
        'inserted' => $insertedCount,
        'skipped' => $skippedCount
    ]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
