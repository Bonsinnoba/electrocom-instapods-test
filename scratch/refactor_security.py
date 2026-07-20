import os

file_path = r'c:\Users\balik\Iven\EssentialsHub-project\api\security.php'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove resolveFulfillmentBranch
import re
content = re.sub(r'/\*\*\s+\* Resolve Fulfillment Center.*?\n\s*\}\n\s*\}', '', content, flags=re.DOTALL)

# Refactor calculateRegionalShipping
shipping_pattern = r'if \(!function_exists\(\'calculateRegionalShipping\'\)\) \{.*?\}\n\}'
new_shipping = """if (!function_exists('calculateRegionalShipping')) {
    function calculateRegionalShipping($userRegion, $sourceBranchId, $subtotal, $pdo)
    {
        $baseFee = 35.00; // Default: Regional/Upcountry
        
        // Define 'Local' as Greater Accra (Main Hub Location)
        $localRegions = ['Greater Accra', 'Accra'];
        if ($userRegion && in_array($userRegion, $localRegions)) {
            $baseFee = 15.00;
        }
        
        // Dynamic discount for large orders
        if ($subtotal >= 1500) {
            $baseFee = $baseFee * 0.5;
        }

        return [
            'fee' => (float)$baseFee,
            'city' => 'Accra',
            'source_branch_id' => 1 // Legacy support
        ];
    }
}"""

content = re.sub(shipping_pattern, new_shipping, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Security.php refactored successfully.")
