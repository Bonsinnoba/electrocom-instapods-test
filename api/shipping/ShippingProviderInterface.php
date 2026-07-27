<?php
// api/shipping/ShippingProviderInterface.php
//
// Common contract both delivery modes implement. Callers (checkout,
// admin shipment screens) code against this interface only - swapping
// self-fleet for a carrier, or running both side by side, never touches
// call sites, only which class ShippingProviderFactory hands back.

interface ShippingProviderInterface
{
    /**
     * @param array $origin      ['lat' => float, 'lng' => float, 'region' => string]
     * @param array $destination ['lat' => float, 'lng' => float, 'region' => string]
     * @param array $package     ['subtotal' => float, 'weight_kg' => float|null]
     * @return array [['service' => string, 'label' => string, 'cost' => float, 'eta_hours' => int|null], ...]
     */
    public function getRates(array $origin, array $destination, array $package): array;

    /**
     * Create the shipment record for a paid/confirmed order.
     * @return array ['shipment_id' => int, 'tracking_number' => string|null]
     */
    public function createShipment(int $orderId, array $origin, array $destination, array $package): array;

    /**
     * @return array ['status' => string, 'location' => string|null, 'eta' => string|null]
     */
    public function trackShipment(string $trackingNumber): array;

    public function cancelShipment(string $trackingNumber): bool;
}
