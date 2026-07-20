<?php

$name = trim((string)($data['name'] ?? 'Customer'));
$orderRef = trim((string)($data['order_reference'] ?? ''));
$orderTotal = trim((string)($data['order_total'] ?? '0.00'));
$deliveryMethod = trim((string)($data['delivery_method'] ?? 'pickup'));
$deliveryAddress = trim((string)($data['delivery_address'] ?? ''));

$deliveryLabel = $deliveryMethod === 'door_to_door' ? 'Door to Door' : 'Pickup';

return [
    'subject' => "Order Received: {$orderRef}",
    'html' => "
        <div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#111;\">
            <p>Hello {$name},</p>
            <p>Thanks for shopping with {$brandName}. We have received your order.</p>
            <p><strong>Reference:</strong> {$orderRef}<br>
            <strong>Total:</strong> GHS {$orderTotal}<br>
            <strong>Delivery Method:</strong> {$deliveryLabel}</p>
            <p><strong>Delivery/Pickup Address:</strong><br>{$deliveryAddress}</p>
            <p>We will send another update as your order status changes.</p>
        </div>
    ",
    'text' => "Hello {$name},\n\nWe received your order at {$brandName}.\nReference: {$orderRef}\nTotal: GHS {$orderTotal}\nDelivery method: {$deliveryLabel}\nAddress: {$deliveryAddress}\n\nWe will send another status update soon.",
];
