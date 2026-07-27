<?php
// api/shipping/SelfFleetProvider.php
//
// Self-owned fleet implementation of ShippingProviderInterface. Zone
// matching uses a simple haversine radius check (shipping_zones.center_lat/
// lng + radius_km) with a region-name fallback for zones that were entered
// without coordinates. Falls back to the legacy calculateRegionalShipping()
// flat fee (security.php) when no zone matches at all, so existing checkout
// behavior is preserved until zones are configured for every service area.

require_once __DIR__ . '/ShippingProviderInterface.php';
require_once __DIR__ . '/../order_utils.php';

class SelfFleetProvider implements ShippingProviderInterface
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusKm = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return $earthRadiusKm * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /**
     * @return array{zone: array, distance_km: float}|null
     */
    private function matchZone(array $destination): ?array
    {
        $stmt = $this->pdo->query("SELECT * FROM shipping_zones WHERE is_active = TRUE");
        $zones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $destLat = $destination['lat'] ?? null;
        $destLng = $destination['lng'] ?? null;
        $destRegion = $destination['region'] ?? null;

        $bestMatch = null;

        foreach ($zones as $zone) {
            if ($destLat !== null && $destLng !== null && $zone['center_lat'] !== null && $zone['center_lng'] !== null) {
                $distance = $this->haversineKm((float)$destLat, (float)$destLng, (float)$zone['center_lat'], (float)$zone['center_lng']);
                if ($distance <= (float)$zone['radius_km']) {
                    if ($bestMatch === null || $distance < $bestMatch['distance_km']) {
                        $bestMatch = ['zone' => $zone, 'distance_km' => $distance];
                    }
                }
            } elseif ($destRegion !== null && $zone['region'] !== null && strcasecmp($zone['region'], $destRegion) === 0) {
                if ($bestMatch === null) {
                    $bestMatch = ['zone' => $zone, 'distance_km' => 0.0];
                }
            }
        }

        return $bestMatch;
    }

    public function getRates(array $origin, array $destination, array $package): array
    {
        $match = $this->matchZone($destination);

        if ($match === null) {
            // No configured zone covers this destination yet - fall back to
            // the existing flat-fee logic so checkout never breaks.
            $fallback = calculateRegionalShipping($destination['region'] ?? 'Greater Accra', (float)($package['subtotal'] ?? 0), $this->pdo);
            return [[
                'service' => 'self_fleet_flat',
                'label' => 'Standard Delivery',
                'cost' => $fallback['fee'],
                'eta_hours' => 48,
            ]];
        }

        $zone = $match['zone'];
        $cost = (float)$zone['base_fee'] + ((float)$zone['per_km_fee'] * $match['distance_km']);

        if ((float)($package['subtotal'] ?? 0) >= 1500) {
            $cost *= 0.5;
        }

        return [[
            'service' => 'self_fleet_zone',
            'label' => $zone['name'],
            'cost' => round($cost, 2),
            'eta_hours' => 24,
        ]];
    }

    public function createShipment(int $orderId, array $origin, array $destination, array $package): array
    {
        $match = $this->matchZone($destination);
        $zoneId = $match['zone']['id'] ?? null;
        $trackingNumber = 'SF-' . $orderId . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));

        $stmt = $this->pdo->prepare("
            INSERT INTO shipments (order_id, provider_type, zone_id, tracking_number, status, cost, origin_address, destination_address)
            VALUES (?, 'self_fleet', ?, ?, 'pending', ?, ?, ?)
        ");
        $stmt->execute([
            $orderId,
            $zoneId,
            $trackingNumber,
            $package['cost'] ?? 0,
            $origin['address'] ?? null,
            $destination['address'] ?? null,
        ]);

        $shipmentId = (int)$this->pdo->lastInsertId();
        logOrderEvent($orderId, 'shipment_created', "Self-fleet shipment created ({$trackingNumber})", $this->pdo);

        return ['shipment_id' => $shipmentId, 'tracking_number' => $trackingNumber];
    }

    public function trackShipment(string $trackingNumber): array
    {
        $stmt = $this->pdo->prepare("
            SELECT s.status, s.estimated_delivery, r.name AS rider_name, r.current_lat, r.current_lng
            FROM shipments s
            LEFT JOIN riders r ON s.rider_id = r.id
            WHERE s.tracking_number = ?
        ");
        $stmt->execute([$trackingNumber]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return ['status' => 'unknown', 'location' => null, 'eta' => null];
        }

        $location = $row['rider_name'] ? "With rider {$row['rider_name']}" : null;
        return ['status' => $row['status'], 'location' => $location, 'eta' => $row['estimated_delivery']];
    }

    public function cancelShipment(string $trackingNumber): bool
    {
        $stmt = $this->pdo->prepare("UPDATE shipments SET status = 'cancelled' WHERE tracking_number = ? AND status NOT IN ('delivered', 'cancelled')");
        $stmt->execute([$trackingNumber]);
        return $stmt->rowCount() > 0;
    }
}
