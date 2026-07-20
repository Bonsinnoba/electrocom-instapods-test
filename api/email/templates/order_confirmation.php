<?php

$name = trim((string)($data['name'] ?? 'Customer'));
$orderRef = trim((string)($data['order_reference'] ?? ''));
$orderTotal = trim((string)($data['order_total'] ?? '0.00'));
$deliveryMethod = trim((string)($data['delivery_method'] ?? 'pickup'));
$deliveryAddress = trim((string)($data['delivery_address'] ?? ''));

$deliveryLabel = $deliveryMethod === 'door_to_door' ? 'Door to Door' : 'Pickup';

// Pickup location contact information
$contactPerson = trim((string)($data['pickup_contact_person'] ?? ''));
$contactPhone = trim((string)($data['pickup_contact_phone'] ?? ''));
$pickupInstructions = trim((string)($data['pickup_instructions'] ?? ''));
$whatToBring = trim((string)($data['what_to_bring'] ?? ''));
$idRequirements = trim((string)($data['id_requirements'] ?? ''));

$pickupDetailsHtml = '';
$pickupDetailsText = '';

if ($deliveryMethod === 'pickup' && ($contactPerson || $contactPhone || $pickupInstructions || $whatToBring || $idRequirements)) {
    $pickupDetailsHtml = '<div style="background:#f5f5f5;padding:15px;border-radius:8px;margin:15px 0;">';
    $pickupDetailsHtml .= '<h3 style="margin:0 0 10px 0;color:#333;">Pickup Information</h3>';
    
    if ($contactPerson || $contactPhone) {
        $pickupDetailsHtml .= '<p style="margin:5px 0;"><strong>Contact:</strong> ' . htmlspecialchars($contactPerson);
        if ($contactPhone) {
            $pickupDetailsHtml .= ' • ' . htmlspecialchars($contactPhone);
        }
        $pickupDetailsHtml .= '</p>';
    }
    
    if ($pickupInstructions) {
        $pickupDetailsHtml .= '<p style="margin:5px 0;"><strong>Pickup Instructions:</strong> ' . htmlspecialchars($pickupInstructions) . '</p>';
    }
    
    if ($whatToBring) {
        $pickupDetailsHtml .= '<p style="margin:5px 0;"><strong>What to Bring:</strong> ' . htmlspecialchars($whatToBring) . '</p>';
    }
    
    if ($idRequirements) {
        $pickupDetailsHtml .= '<p style="margin:5px 0;"><strong>ID Requirements:</strong> ' . htmlspecialchars($idRequirements) . '</p>';
    }
    
    $pickupDetailsHtml .= '</div>';
    
    $pickupDetailsText = "\n\nPICKUP INFORMATION:\n";
    if ($contactPerson || $contactPhone) {
        $pickupDetailsText .= "Contact: " . $contactPerson;
        if ($contactPhone) {
            $pickupDetailsText .= " • " . $contactPhone;
        }
        $pickupDetailsText .= "\n";
    }
    if ($pickupInstructions) {
        $pickupDetailsText .= "Pickup Instructions: " . $pickupInstructions . "\n";
    }
    if ($whatToBring) {
        $pickupDetailsText .= "What to Bring: " . $whatToBring . "\n";
    }
    if ($idRequirements) {
        $pickupDetailsText .= "ID Requirements: " . $idRequirements . "\n";
    }
}

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
            {$pickupDetailsHtml}
            <p>We will send another update as your order status changes.</p>
        </div>
    ",
    'text' => "Hello {$name},\n\nWe received your order at {$brandName}.\nReference: {$orderRef}\nTotal: GHS {$orderTotal}\nDelivery method: {$deliveryLabel}\nAddress: {$deliveryAddress}{$pickupDetailsText}\n\nWe will send another status update soon.",
];
