<?php
// api/shipping/CarrierProviderStub.php
//
// Placeholder carrier implementation. Wires up the same interface as
// SelfFleetProvider so the rest of the app (checkout, admin shipments)
// never needs to change when a real carrier is switched on - only this
// class gets replaced/extended, e.g. with a FedExProvider that calls
// FedEx's actual rating/shipping API using the credentials stored in
// carrier_credentials.
//
// Until a carrier row exists with is_enabled = TRUE, every method here
// either returns an empty result or throws, so it fails safely rather
// than silently pretending to ship something.

require_once __DIR__ . '/ShippingProviderInterface.php';

class CarrierProviderStub implements ShippingProviderInterface
{
    private PDO $pdo;
    private ?array $carrier;

    public function __construct(PDO $pdo, string $carrierName = 'fedex')
    {
        $this->pdo = $pdo;
        $stmt = $this->pdo->prepare("SELECT * FROM carrier_credentials WHERE carrier_name = ? AND is_enabled = TRUE");
        $stmt->execute([$carrierName]);
        $this->carrier = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function assertConfigured(): void
    {
        if ($this->carrier === null) {
            throw new RuntimeException('No carrier is configured and enabled yet. Add credentials in carrier_credentials and set is_enabled = TRUE.');
        }
    }

    public function getRates(array $origin, array $destination, array $package): array
    {
        // Not configured yet: return no options rather than throwing, so a
        // checkout that offers "self-fleet OR carrier" degrades gracefully
        // to self-fleet-only without erroring the whole rates call.
        if ($this->carrier === null) {
            return [];
        }

        // TODO: replace with a real call to the carrier's rating API using
        // $this->carrier['api_key_encrypted'] (decrypt via DATA_ENCRYPTION_KEY,
        // same pattern used elsewhere for encrypted config values).
        throw new RuntimeException('Carrier rating API integration not yet implemented for ' . $this->carrier['carrier_name']);
    }

    public function createShipment(int $orderId, array $origin, array $destination, array $package): array
    {
        $this->assertConfigured();
        throw new RuntimeException('Carrier shipment creation not yet implemented for ' . $this->carrier['carrier_name']);
    }

    public function trackShipment(string $trackingNumber): array
    {
        $this->assertConfigured();
        throw new RuntimeException('Carrier tracking not yet implemented for ' . $this->carrier['carrier_name']);
    }

    public function cancelShipment(string $trackingNumber): bool
    {
        $this->assertConfigured();
        throw new RuntimeException('Carrier cancellation not yet implemented for ' . $this->carrier['carrier_name']);
    }
}
