<?php
// backend/invoice.php — Generates a printable HTML invoice for an order
require_once 'db.php';
require_once 'security.php';
require_once __DIR__ . '/brand_settings.php';

$userId = authenticate($pdo);
$orderId = (int)($_GET['order_id'] ?? 0);

if ($orderId <= 0) {
    http_response_code(400);
    echo "Missing order_id";
    exit;
}

try {
    // Fetch order
    $roleStmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $roleStmt->execute([$userId]);
    $userRole = $roleStmt->fetchColumn();
    $isAdmin = in_array($userRole, ['store_manager', 'super']);

    if ($isAdmin) {
        $stmt = $pdo->prepare("
            SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
    } else {
        $stmt = $pdo->prepare("
            SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ? AND o.user_id = ?
        ");
        $stmt->execute([$orderId, $userId]);
    }
    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        http_response_code(404);
        echo "Order not found";
        exit;
    }

    $brandInv = eh_brand_invoice_block();

    // Fetch order items
    $itemStmt = $pdo->prepare("
        SELECT oi.*, p.name as product_name, p.product_code
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    ");
    $itemStmt->execute([$orderId]);
    $items = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

    $orderDate = date('d M Y, h:i A', strtotime($order['created_at']));
    $total = number_format((float)$order['total_amount'], 2);

    // Output as styled HTML (user can print to PDF from browser)
    header('Content-Type: text/html; charset=utf-8');
?>
    <!DOCTYPE html>
    <html lang="en">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice — ORD-<?= $orderId ?></title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                color: #1e293b;
                background: #f8fafc;
                padding: 40px;
            }

            .invoice {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                border-radius: 16px;
                box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
                overflow: hidden;
            }

            .header {
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                color: white;
                padding: 40px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }

            .header h1 {
                font-size: 28px;
                font-weight: 800;
            }

            .header .order-id {
                font-size: 14px;
                opacity: 0.9;
                margin-top: 4px;
            }

            .header .company {
                text-align: right;
                font-size: 13px;
                line-height: 1.6;
                opacity: 0.9;
            }

            .body {
                padding: 40px;
            }

            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 32px;
                margin-bottom: 32px;
            }

            .info-block h3 {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #94a3b8;
                margin-bottom: 8px;
                font-weight: 700;
            }

            .info-block p {
                font-size: 14px;
                line-height: 1.6;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 24px;
            }

            thead {
                background: #f1f5f9;
            }

            th {
                padding: 12px 16px;
                text-align: left;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #64748b;
                font-weight: 700;
            }

            td {
                padding: 14px 16px;
                border-bottom: 1px solid #f1f5f9;
                font-size: 14px;
            }

            .total-row {
                background: #f8fafc;
            }

            .total-row td {
                font-weight: 800;
                font-size: 16px;
                border-bottom: none;
            }

            .footer {
                padding: 24px 40px;
                background: #f8fafc;
                border-top: 1px solid #e2e8f0;
                text-align: center;
                font-size: 12px;
                color: #94a3b8;
            }

            .status-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 100px;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
            }

            .status-pending {
                background: #fef3c7;
                color: #d97706;
            }

            .status-processing {
                background: #dbeafe;
                color: #2563eb;
            }

            .status-shipped {
                background: #e0e7ff;
                color: #4f46e5;
            }

            .status-delivered {
                background: #d1fae5;
                color: #059669;
            }

            .status-cancelled {
                background: #fee2e2;
                color: #dc2626;
            }

            .print-btn {
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: #2563eb;
                color: white;
                border: none;
                padding: 14px 28px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
            }

            .print-btn:hover {
                background: #1d4ed8;
            }

            @media print {
                body {
                    background: white;
                    padding: 0;
                }

                .invoice {
                    box-shadow: none;
                    border-radius: 0;
                }

                .print-btn {
                    display: none;
                }
            }
        </style>
    </head>

    <body>
        <div class="invoice">
            <div class="header">
                <div>
                    <h1>INVOICE</h1>
                    <div class="order-id">ORD-<?= $orderId ?></div>
                </div>
                <div class="company">
                    <strong style="font-size: 18px;"><?= htmlspecialchars($brandInv['name']) ?></strong><br>
                    <?= htmlspecialchars($brandInv['email']) ?><br>
                    <?= $brandInv['phone_line'] !== '' ? htmlspecialchars($brandInv['phone_line']) . '<br>' : '' ?>
                    <?= $brandInv['address'] !== '' ? nl2br(htmlspecialchars($brandInv['address'])) : '' ?>
                </div>
            </div>

            <div class="body">
                <div class="info-grid">
                    <div class="info-block">
                        <h3>Bill To</h3>
                        <p>
                            <strong><?= htmlspecialchars($order['customer_name']) ?></strong><br>
                            <?= htmlspecialchars($order['customer_email']) ?><br>
                            <?= htmlspecialchars($order['customer_phone'] ?? '') ?>
                        </p>
                    </div>
                    <div class="info-block" style="text-align: right;">
                        <h3>Order Details</h3>
                        <p>
                            <strong>Date:</strong> <?= $orderDate ?><br>
                            <strong>Payment:</strong> <?= htmlspecialchars($order['payment_method'] ?? 'N/A') ?><br>
                            <strong>Status:</strong> <span class="status-badge status-<?= $order['status'] ?>"><?= ucfirst($order['status']) ?></span>
                        </p>
                    </div>
                </div>

                <?php if ($order['shipping_address']): ?>
                    <div class="info-block" style="margin-bottom: 24px;">
                        <h3>Ship To</h3>
                        <p><?= htmlspecialchars($order['shipping_address']) ?></p>
                    </div>
                <?php endif; ?>

                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Code</th>
                            <th style="text-align: center;">Qty</th>
                            <th style="text-align: right;">Unit Price</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($items as $item):
                            $subtotal = $item['quantity'] * $item['price_at_purchase'];
                        ?>
                            <tr>
                                <td><strong><?= htmlspecialchars($item['product_name'] ?? 'Product') ?></strong></td>
                                <td><?= htmlspecialchars($item['product_code'] ?? '—') ?></td>
                                <td style="text-align: center;"><?= $item['quantity'] ?></td>
                                <td style="text-align: right;">GHS <?= number_format($item['price_at_purchase'], 2) ?></td>
                                <td style="text-align: right;">GHS <?= number_format($subtotal, 2) ?></td>
                            </tr>
                        <?php endforeach; ?>
                        <tr class="total-row">
                            <td colspan="4" style="text-align: right;">Total</td>
                            <td style="text-align: right; color: #2563eb;">GHS <?= $total ?></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="footer">
                <p><?= $brandInv['footer_note'] !== '' ? htmlspecialchars($brandInv['footer_note']) : ('Thank you for shopping with ' . htmlspecialchars($brandInv['name']) . '!') ?></p>
                <p style="margin-top: 4px;">This invoice was generated on <?= date('d M Y') ?></p>
            </div>
        </div>

        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </body>

    </html>
<?php
} catch (Exception $e) {
    error_log("Invoice generation error: " . $e->getMessage());
    http_response_code(500);
    echo "Failed to generate invoice";
}
