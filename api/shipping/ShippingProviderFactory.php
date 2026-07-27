<?php
// api/shipping/ShippingProviderFactory.php
//
// Single place that decides self-fleet vs. carrier vs. both, driven by the
// site_settings 'delivery' category (activeDeliveryProviderMode,
// selfFleetEnabled, carrierFallbackEnabled - see migration 047). Checkout
// and admin code should call ShippingProviderFactory::getRates()/etc.
// instead of instantiating SelfFleetProvider/CarrierProviderStub directly -
// that's what makes switching providers a settings change, not a code change.

require_once __DIR__ . '/ShippingProviderInterface.php';
require_once __DIR__ . '/SelfFleetProvider.php';
require_once __DIR__ . '/CarrierProviderStub.php';
require_once __DIR__ . '/../brand_settings.php';

class ShippingProviderFactory
{
    /**
     * @return ShippingProviderInterface[] active providers, in priority order
     */
    public static function getActiveProviders(PDO $pdo): array
    {
        $settings = eh_get_always_load_settings();
        $mode = $settings['activeDeliveryProviderMode'] ?? 'self_fleet';
        $selfFleetEnabled = filter_var($settings['selfFleetEnabled'] ?? true, FILTER_VALIDATE_BOOLEAN);
        $carrierFallback = filter_var($settings['carrierFallbackEnabled'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $providers = [];

        if (($mode === 'self_fleet' || $mode === 'both') && $selfFleetEnabled) {
            $providers[] = new SelfFleetProvider($pdo);
        }

        if (($mode === 'carrier' || $mode === 'both' || $carrierFallback)) {
            $providers[] = new CarrierProviderStub($pdo);
        }

        // Guarantee at least one provider so checkout never has zero options
        // even if settings are misconfigured.
        if (empty($providers)) {
            $providers[] = new SelfFleetProvider($pdo);
        }

        return $providers;
    }

    /**
     * Aggregate rates across all active providers for checkout to display.
     */
    public static function getRates(PDO $pdo, array $origin, array $destination, array $package): array
    {
        $rates = [];
        foreach (self::getActiveProviders($pdo) as $provider) {
            try {
                $rates = array_merge($rates, $provider->getRates($origin, $destination, $package));
            } catch (Throwable $e) {
                error_log('ShippingProviderFactory: provider rate lookup failed - ' . $e->getMessage());
            }
        }
        return $rates;
    }
}
