<?php
// api/run_kb_migration.php
// Run knowledge base population migration

require_once 'config.php';

try {
    $pdo = new PDO(
        "mysql:host={$config['DB_HOST']};dbname={$config['DB_NAME']};charset=utf8mb4",
        $config['DB_USER'],
        $config['DB_PASS'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

// Comprehensive Q&A data
$qaPairs = [
    // Account Management
    ['question' => 'How do I create an account?', 'answer' => 'To create an account, click the "Sign Up" button on the top right corner of the homepage. Fill in your name, email, phone number, and password. You will receive a verification code via email or SMS to complete registration.', 'category' => 'account', 'keywords' => '["register", "signup", "new account"]'],
    ['question' => 'How do I log in to my account?', 'answer' => 'Click the "Login" button on the top right corner. Enter your email and password, then click "Sign In". If you forgot your password, click "Forgot Password" to reset it.', 'category' => 'account', 'keywords' => '["login", "signin", "access"]'],
    ['question' => 'How do I reset my password?', 'answer' => 'Click "Forgot Password" on the login page. Enter your email address and you will receive a reset link via email. Follow the instructions to create a new password.', 'category' => 'account', 'keywords' => '["password", "reset", "forgot"]'],
    ['question' => 'How do I update my profile information?', 'answer' => 'Go to your account dashboard and click on "Profile". You can update your name, email, phone, address, and region. Click "Save Changes" to update your information.', 'category' => 'account', 'keywords' => '["profile", "update", "edit"]'],
    ['question' => 'How do I change my profile picture?', 'answer' => 'In your profile settings, click on the profile picture area to upload a new image. Supported formats include JPG, PNG, and GIF. The image will be automatically resized.', 'category' => 'account', 'keywords' => '["avatar", "picture", "photo"]'],

    // Product Browsing and Search
    ['question' => 'How do I search for products?', 'answer' => 'Use the search bar at the top of the page. You can search by product name, category, or technical specifications. The search supports fuzzy matching and will show relevant results even with partial matches.', 'category' => 'products', 'keywords' => '["search", "find", "look for"]'],
    ['question' => 'How do I filter products?', 'answer' => 'On the Shop page, use the filter panel on the left to filter by category, price range, minimum rating, and discount percentage. You can apply multiple filters at once.', 'category' => 'products', 'keywords' => '["filter", "narrow", "refine"]'],
    ['question' => 'How do I compare products?', 'answer' => 'Click the "Compare" button on any product card to add it to your comparison bar. You can compare up to 4 products side-by-side, viewing their specifications, prices, and features in a unified table.', 'category' => 'products', 'keywords' => '["compare", "difference", "versus"]'],
    ['question' => 'What do the stock labels mean?', 'answer' => '"Only X left!" indicates limited remaining stock, while "Selling fast" shows items with high recent demand. These labels help you make timely purchasing decisions.', 'category' => 'products', 'keywords' => '["stock", "availability", "labels"]'],
    ['question' => 'How do I view product specifications?', 'answer' => 'Click on any product to view its detailed page. The specifications section shows technical details like voltage, current, dimensions, and other relevant parameters.', 'category' => 'products', 'keywords' => '["specs", "specifications", "details"]'],

    // Shopping Cart and Checkout
    ['question' => 'How do I add items to my cart?', 'answer' => 'Click the "Add to Cart" button on any product card. The item will be added to your shopping cart. You can view your cart by clicking the cart icon in the top right corner.', 'category' => 'cart', 'keywords' => '["add", "cart", "shopping"]'],
    ['question' => 'How do I remove items from my cart?', 'answer' => 'Go to your cart page and click the "Remove" button next to the item you want to delete. You can also adjust quantities using the +/- buttons.', 'category' => 'cart', 'keywords' => '["remove", "delete", "cart"]'],
    ['question' => 'How do I apply a promo code?', 'answer' => 'During checkout, you will find a promo code field in the order summary section. Enter your flash sale code and click "Apply". The discount will be instantly reflected in your total.', 'category' => 'cart', 'keywords' => '["promo", "discount", "coupon"]'],
    ['question' => 'What payment methods do you accept?', 'answer' => 'We accept payments via Paystack (card, mobile money, bank transfer) and cash on delivery for pickup orders. All transactions are secure and encrypted.', 'category' => 'cart', 'keywords' => '["payment", "pay", "methods"]'],
    ['question' => 'How do I complete my order?', 'answer' => 'After adding items to your cart, proceed to checkout. Fill in your shipping address, select a delivery method, choose payment method, and review your order. Click "Place Order" to complete the purchase.', 'category' => 'cart', 'keywords' => '["checkout", "complete", "finish"]'],

    // Order Management
    ['question' => 'How do I make an order?', 'answer' => 'Add products to your cart, then proceed to checkout. Fill in your shipping details, select delivery method (pickup or door-to-door), choose payment method, and click "Place Order" to complete your purchase.', 'category' => 'orders', 'keywords' => '["order", "buy", "purchase"]'],
    ['question' => 'How do I track my order?', 'answer' => 'Go to the Orders page in your dashboard to see a live timeline of your order status. The timeline shows each stage from processing to delivery, with real-time updates as your order progresses.', 'category' => 'orders', 'keywords' => '["track", "status", "timeline"]'],
    ['question' => 'How do I cancel my order?', 'answer' => 'Orders can be cancelled within 1 hour of placement by contacting our support team immediately. Orders already in processing cannot be cancelled. Go to your Orders page and use the "Cancel Order" button if available.', 'category' => 'orders', 'keywords' => '["cancel", "stop", "abort"]'],
    ['question' => 'What order statuses are there?', 'answer' => 'Order statuses include: Pending (awaiting processing), Processing (being prepared), Shipped (on the way), Delivered (completed), and Cancelled (order cancelled). You can track these in your Orders dashboard.', 'category' => 'orders', 'keywords' => '["status", "states", "stages"]'],
    ['question' => 'How do I view my order history?', 'answer' => 'Go to the Orders page in your dashboard. All your past and current orders are listed there with their status, total amount, and date. Click on any order to view detailed information.', 'category' => 'orders', 'keywords' => '["history", "past", "previous"]'],

    // Returns and Refunds
    ['question' => 'What is your return policy?', 'answer' => 'We accept returns for DOA (dead-on-arrival) or damaged components and unopened STEM kits within 14 days. Opened component packs and ESD-damaged items are not eligible for return.', 'category' => 'returns', 'keywords' => '["return", "policy", "refund"]'],
    ['question' => 'How do I request a return?', 'answer' => 'Go to your Orders page, find the order you want to return, and click "Request Return". Select the items you want to return, provide a reason, and submit your request. Our team will review and approve it.', 'category' => 'returns', 'keywords' => '["return", "request", "send back"]'],
    ['question' => 'How do refunds work?', 'answer' => 'For multi-item returns, we consolidate refunds into a single transaction to keep your statement clean. Refunds are processed back to your original payment method (Paystack) or via cash within 5-7 business days.', 'category' => 'returns', 'keywords' => '["refund", "money back", "credit"]'],
    ['question' => 'Can I return multiple items at once?', 'answer' => 'Yes! You can select and request returns for multiple items from the same order at once through your dashboard\'s Return Manager. This makes the process more efficient.', 'category' => 'returns', 'keywords' => '["multiple", "several", "batch"]'],
    ['question' => 'What items cannot be returned?', 'answer' => 'Opened component packs, ESD-damaged items, and items beyond the 14-day return window cannot be returned. Special order items may also have different return policies.', 'category' => 'returns', 'keywords' => '["cannot", "not eligible", "excluded"]'],

    // Wishlist and Favorites
    ['question' => 'How do I add items to my wishlist?', 'answer' => 'Click the heart icon on any product card to add it to your wishlist. You can access your wishlist from your dashboard or by clicking the wishlist icon in the navigation.', 'category' => 'wishlist', 'keywords' => '["wishlist", "favorites", "save"]'],
    ['question' => 'How do I remove items from my wishlist?', 'answer' => 'Go to your Favorites page and click the "Remove" button next to any item you want to delete from your wishlist.', 'category' => 'wishlist', 'keywords' => '["remove", "delete", "unsave"]'],
    ['question' => 'How do I move items from wishlist to cart?', 'answer' => 'On your Favorites page, click the "Add to Cart" button on any item. It will be added to your shopping cart and remain in your wishlist for future reference.', 'category' => 'wishlist', 'keywords' => '["move", "transfer", "cart"]'],
    ['question' => 'What is the difference between wishlist and favorites?', 'answer' => 'They are the same feature - your wishlist is also called your Favorites. It\'s a place to save products you\'re interested in for later purchase.', 'category' => 'wishlist', 'keywords' => '["difference", "same", "versus"]'],

    // Shipping and Delivery
    ['question' => 'What delivery methods do you offer?', 'answer' => 'We offer two delivery methods: Pickup (collect from our store) and Door-to-Door (delivery to your address). Pickup is free, while door-to-door has a shipping fee based on your region.', 'category' => 'shipping', 'keywords' => '["delivery", "shipping", "methods"]'],
    ['question' => 'How much does shipping cost?', 'answer' => 'Shipping costs depend on your region. Local delivery (Greater Accra) costs 15 GHS, while regional delivery costs 35 GHS. Orders over 1500 GHS get 50% off shipping fees.', 'category' => 'shipping', 'keywords' => '["cost", "fee", "price"]'],
    ['question' => 'How long does delivery take?', 'answer' => 'Local delivery (Greater Accra) typically takes 1-2 business days. Regional delivery takes 2-5 business days depending on your location. You can track your order status in real-time.', 'category' => 'shipping', 'keywords' => '["time", "duration", "how long"]'],
    ['question' => 'Can I change my delivery address?', 'answer' => 'You can change your delivery address only if your order is still in "Pending" status. Once processing begins, the address cannot be changed. Contact support immediately if you need to make changes.', 'category' => 'shipping', 'keywords' => '["address", "change", "location"]'],
    ['question' => 'What are pickup locations?', 'answer' => 'We have multiple pickup locations across Greater Accra. During checkout with pickup selected, you can choose the most convenient location for you to collect your order.', 'category' => 'shipping', 'keywords' => '["pickup", "location", "collect"]'],

    // Discounts and Promotions
    ['question' => 'What are flash sales?', 'answer' => 'Flash sales are limited-time promotions with significant discounts on selected products. They have expiration dates, so use the promo codes before they expire to get the discounted price.', 'category' => 'discounts', 'keywords' => '["flash sale", "promotion", "deal"]'],
    ['question' => 'How do I get discount codes?', 'answer' => 'Discount codes are sent via email, SMS, or announced on our website. Subscribe to our newsletter and follow our social media to stay updated on the latest promotions.', 'category' => 'discounts', 'keywords' => '["codes", "coupons", "promotions"]'],
    ['question' => 'Do you offer bulk discounts?', 'answer' => 'Yes! We offer competitive bulk discounts for institutions, universities, and engineering firms. Email us with your parts list and quantities for a custom quote.', 'category' => 'discounts', 'keywords' => '["bulk", "wholesale", "quantity"]'],
    ['question' => 'What is the loyalty points system?', 'answer' => 'Earn loyalty points with every purchase. Points can be redeemed for discounts on future orders. Higher spending levels (Elite, VIP) earn more points per purchase.', 'category' => 'discounts', 'keywords' => '["loyalty", "points", "rewards"]'],
    ['question' => 'How do I check my loyalty level?', 'answer' => 'Your loyalty level is displayed in your account dashboard. Levels include Starter, Elite (500+ GHS spent), and VIP (2000+ GHS spent). Higher levels get better rewards and discounts.', 'category' => 'discounts', 'keywords' => '["level", "tier", "status"]'],

    // Account Settings
    ['question' => 'How do I change my theme?', 'answer' => 'Go to your account settings and select your preferred theme (Light or Dark mode). The setting applies across all pages of the website.', 'category' => 'settings', 'keywords' => '["theme", "dark mode", "light mode"]'],
    ['question' => 'How do I manage my notifications?', 'answer' => 'In your account settings, you can enable or disable email notifications, push notifications, and SMS tracking for orders and promotions.', 'category' => 'settings', 'keywords' => '["notifications", "alerts", "preferences"]'],
    ['question' => 'How do I delete my account?', 'answer' => 'To delete your account, please contact our support team. We will process your request after verifying your identity. Note that this action is irreversible and all your data will be permanently deleted.', 'category' => 'settings', 'keywords' => '["delete", "remove", "close"]'],
    ['question' => 'How do I verify my email?', 'answer' => 'After registration, you will receive a verification email. Click the link in the email to verify your account. If you didn\'t receive it, check your spam folder or request a new verification code.', 'category' => 'settings', 'keywords' => '["verify", "email", "confirm"]'],
    ['question' => 'How do I verify my phone number?', 'answer' => 'During registration, you can choose SMS verification. You will receive a code via SMS to verify your phone number. Enter the code to complete verification.', 'category' => 'settings', 'keywords' => '["verify", "phone", "sms"]'],

    // Product Information
    ['question' => 'Are your components genuine?', 'answer' => 'Yes. All components are sourced from verified suppliers and authorized distributors. We guarantee authenticity and provide datasheets on request for ICs, transistors, and modules.', 'category' => 'products', 'keywords' => '["genuine", "authentic", "original"]'],
    ['question' => 'Do you provide datasheets?', 'answer' => 'Yes. For most ICs, sensors, and modules we can provide the manufacturer datasheet on request. Contact us with the part number and we\'ll send it within 24 hours.', 'category' => 'products', 'keywords' => '["datasheet", "documentation", "specs"]'],
    ['question' => 'What is DOA warranty?', 'answer' => 'DOA (Dead-On-Arrival) warranty covers components that are defective upon delivery. We replace DOA items free of charge within 14 days of delivery.', 'category' => 'products', 'keywords' => '["doa", "warranty", "defective"]'],
    ['question' => 'How do I identify the right component?', 'answer' => 'Use our search and filter features to find components by specifications. You can also compare multiple products side-by-side to choose the right one for your project.', 'category' => 'products', 'keywords' => '["identify", "choose", "select"]'],
    ['question' => 'Do you sell STEM kits?', 'answer' => 'Yes! We offer a variety of STEM kits for education and hobby projects. These include complete project kits with all necessary components and instructions.', 'category' => 'products', 'keywords' => '["stem", "kits", "education"]'],

    // Support and Help
    ['question' => 'How do I contact support?', 'answer' => 'You can reach us via Live Chat (available on the Support page), WhatsApp, phone, or email. Our support team is available 9am-6pm on weekdays.', 'category' => 'support', 'keywords' => '["contact", "support", "help"]'],
    ['question' => 'What is the live chat response time?', 'answer' => 'Our average response time is under 1 minute for all active sessions. If your question isn\'t in our knowledge base, it will be redirected to a human agent.', 'category' => 'support', 'keywords' => '["response time", "wait", "speed"]'],
    ['question' => 'How do I report a problem with my order?', 'answer' => 'Go to your Orders page, find the problematic order, and click "Report Issue". Describe the problem and our team will investigate and resolve it promptly.', 'category' => 'support', 'keywords' => '["report", "problem", "issue"]'],
    ['question' => 'Can I get technical help with products?', 'answer' => 'Yes! Our support team includes technical experts who can help with product selection, usage questions, and troubleshooting. Contact us via Live Chat or email for technical assistance.', 'category' => 'support', 'keywords' => '["technical", "help", "assistance"]'],
    ['question' => 'How do I give feedback?', 'answer' => 'We value your feedback! You can rate answers in the live chat, leave product reviews, or email us directly with suggestions and comments.', 'category' => 'support', 'keywords' => '["feedback", "review", "suggestion"]'],

    // Additional Sample Questions
    ['question' => 'Where can I find my order number?', 'answer' => 'Your order number is displayed on your Orders page in your dashboard. You can also find it in the order confirmation email sent to your registered email address.', 'category' => 'orders', 'keywords' => '["order number", "find", "locate"]'],
    ['question' => 'Can I modify my order after placing it?', 'answer' => 'Orders can only be modified if they are still in "Pending" status. Once processing begins, modifications are not possible. Contact support immediately if you need changes.', 'category' => 'orders', 'keywords' => '["modify", "change", "edit order"]'],
    ['question' => 'What payment options are available for pickup?', 'answer' => 'For pickup orders, you can pay via cash on delivery or Paystack (card, mobile money, bank transfer) when placing the order online.', 'category' => 'cart', 'keywords' => '["pickup payment", "cash", "payment options"]'],
    ['question' => 'How do I know if a product is in stock?', 'answer' => 'Stock status is displayed on each product card. "In Stock" means items are available, while "Only X left!" indicates limited stock. "Out of Stock" means the item is temporarily unavailable.', 'category' => 'products', 'keywords' => '["stock", "availability", "in stock"]'],
    ['question' => 'Can I pre-order out of stock items?', 'answer' => 'Currently, we do not offer pre-orders for out of stock items. You can add them to your wishlist and we\'ll notify you when they become available again.', 'category' => 'products', 'keywords' => '["preorder", "out of stock", "notify"]'],
    ['question' => 'What is the minimum order value?', 'answer' => 'There is no minimum order value. You can order as little or as much as you need. However, orders over 1500 GHS get 50% off shipping fees.', 'category' => 'cart', 'keywords' => '["minimum order", "order value", "small order"]'],
    ['question' => 'Do you offer express delivery?', 'answer' => 'We offer standard delivery with 1-2 business days for local (Greater Accra) and 2-5 business days for regional. Express delivery options may be available for urgent orders - contact support for details.', 'category' => 'shipping', 'keywords' => '["express", "urgent", "fast delivery"]'],
    ['question' => 'Can I ship to multiple addresses?', 'answer' => 'Currently, each order can only be shipped to a single address. For multiple addresses, please place separate orders for each destination.', 'category' => 'shipping', 'keywords' => '["multiple addresses", "split shipment", "different locations"]'],
    ['question' => 'How do I track my package after shipping?', 'answer' => 'Once your order is shipped, you will receive a tracking number via SMS and email. Use this number on the courier\'s website or in your Orders dashboard to track real-time location updates.', 'category' => 'orders', 'keywords' => '["tracking", "package", "shipment"]'],
    ['question' => 'What happens if my package is lost?', 'answer' => 'If your package is lost in transit, contact our support team immediately. We will investigate with the courier and either reship your order or provide a full refund, depending on the situation.', 'category' => 'shipping', 'keywords' => '["lost package", "missing", "lost shipment"]'],
    ['question' => 'Can I return damaged items?', 'answer' => 'Yes, damaged items can be returned within 14 days of delivery. Contact support with photos of the damage and your order details to initiate the return process.', 'category' => 'returns', 'keywords' => '["damaged", "broken", "defective"]'],
    ['question' => 'How long does refund processing take?', 'answer' => 'Refunds are processed within 5-7 business days after we receive and inspect the returned items. The refund will be credited to your original payment method.', 'category' => 'returns', 'keywords' => '["refund time", "processing", "how long"]'],
    ['question' => 'Do you charge restocking fees?', 'answer' => 'No, we do not charge restocking fees for eligible returns. However, return shipping costs may apply unless the return is due to our error.', 'category' => 'returns', 'keywords' => '["restocking fee", "charges", "cost"]'],
    ['question' => 'Can I exchange items instead of returning?', 'answer' => 'Currently, we only offer refunds for returns, not exchanges. You can return the item and place a new order for the replacement if needed.', 'category' => 'returns', 'keywords' => '["exchange", "swap", "replacement"]'],
    ['question' => 'How do I use loyalty points?', 'answer' => 'Loyalty points can be redeemed during checkout. The available points and their value will be displayed in your cart. Select the points you want to apply to reduce your order total.', 'category' => 'discounts', 'keywords' => '["loyalty points", "redeem", "use points"]'],
    ['question' => 'Do loyalty points expire?', 'answer' => 'Loyalty points do not expire as long as your account remains active. However, points may be forfeited if your account is inactive for an extended period (typically 12 months).', 'category' => 'discounts', 'keywords' => '["expire", "expiry", "validity"]'],
    ['question' => 'Can I transfer loyalty points to another account?', 'answer' => 'No, loyalty points are non-transferable and can only be used by the account holder who earned them.', 'category' => 'discounts', 'keywords' => '["transfer", "share", "give points"]'],
    ['question' => 'How do I earn more loyalty points?', 'answer' => 'Earn points by making purchases (1 point per GHS spent), writing product reviews, and referring friends. Higher loyalty levels (Elite, VIP) earn bonus points on every purchase.', 'category' => 'discounts', 'keywords' => '["earn points", "get points", "accumulate"]'],
    ['question' => 'What is the referral program?', 'answer' => 'Our referral program rewards you for inviting friends. Share your unique referral link, and when they make their first purchase, both you and your friend earn bonus loyalty points.', 'category' => 'discounts', 'keywords' => '["referral", "invite friends", "refer"]'],
    ['question' => 'Can I change my email address?', 'answer' => 'Yes, go to your Profile settings and update your email address. You will need to verify the new email address before the change takes effect.', 'category' => 'account', 'keywords' => '["change email", "update email", "email address"]'],
    ['question' => 'How do I enable two-factor authentication?', 'answer' => 'Two-factor authentication can be enabled in your account security settings. We support SMS-based 2FA for added account protection.', 'category' => 'account', 'keywords' => '["2fa", "two factor", "security"]'],
    ['question' => 'Can I have multiple delivery addresses?', 'answer' => 'Yes, you can save multiple delivery addresses in your profile. During checkout, you can select from your saved addresses or add a new one.', 'category' => 'account', 'keywords' => '["multiple addresses", "saved addresses", "delivery locations"]'],
    ['question' => 'How do I download my invoice?', 'answer' => 'Invoices are available in your Orders dashboard. Click on any completed order to view and download the PDF invoice for your records.', 'category' => 'orders', 'keywords' => '["invoice", "receipt", "download"]'],
    ['question' => 'What currencies do you accept?', 'answer' => 'We currently accept payments in Ghanaian Cedis (GHS) only. All prices are displayed in GHS.', 'category' => 'cart', 'keywords' => '["currency", "money", "ghs"]'],
    ['question' => 'Do you offer gift cards?', 'answer' => 'Gift cards are coming soon! You will be able to purchase digital gift cards for friends and family to use on our platform.', 'category' => 'discounts', 'keywords' => '["gift card", "voucher", "present"]'],
    ['question' => 'How do I subscribe to newsletters?', 'answer' => 'You can subscribe to our newsletter in your account settings or by entering your email in the newsletter signup form on our homepage. Subscribers get exclusive deals and updates.', 'category' => 'account', 'keywords' => '["newsletter", "subscribe", "email updates"]'],
    ['question' => 'Can I unsubscribe from marketing emails?', 'answer' => 'Yes, you can unsubscribe from marketing emails in your notification settings or by clicking the "Unsubscribe" link at the bottom of any marketing email.', 'category' => 'account', 'keywords' => '["unsubscribe", "opt out", "marketing"]'],
    ['question' => 'What are your business hours?', 'answer' => 'Our online store is open 24/7. Customer support is available Monday-Friday, 9am-6pm. Orders placed outside support hours will be processed the next business day.', 'category' => 'support', 'keywords' => '["business hours", "hours", "support time"]'],
    ['question' => 'Do you have a physical store?', 'answer' => 'Yes, we have pickup locations in Greater Accra. During checkout with pickup selected, you can choose the most convenient location to collect your order.', 'category' => 'shipping', 'keywords' => '["physical store", "location", "visit"]'],
    ['question' => 'Can I visit your warehouse?', 'answer' => 'Our warehouse is not open to public visits. However, you can pick up orders from our designated pickup locations during business hours.', 'category' => 'shipping', 'keywords' => '["warehouse", "visit", "pickup"]'],
    ['question' => 'How do I report a website bug?', 'answer' => 'If you encounter a bug or technical issue on our website, please contact support with details of the problem, including screenshots if possible. Our technical team will investigate and fix it.', 'category' => 'support', 'keywords' => '["bug", "technical issue", "website problem"]'],
    ['question' => 'Is my personal information secure?', 'answer' => 'Yes, we take data security seriously. All personal information is encrypted, and we comply with data protection regulations. We never share your data with third parties without your consent.', 'category' => 'account', 'keywords' => '["security", "privacy", "data protection"]'],
    ['question' => 'How do I close my account permanently?', 'answer' => 'To permanently close your account, contact our support team. We will verify your identity and process the request. Note that this action is irreversible and all data will be deleted.', 'category' => 'account', 'keywords' => '["close account", "delete account", "permanent"]'],
    ['question' => 'Can I reactivate a closed account?', 'answer' => 'Once an account is permanently closed, it cannot be reactivated. You would need to create a new account if you wish to use our services again.', 'category' => 'account', 'keywords' => '["reactivate", "reopen", "restore account"]'],
    ['question' => 'What browsers do you support?', 'answer' => 'Our website supports all modern browsers including Chrome, Firefox, Safari, and Edge. For the best experience, we recommend using the latest version of your browser.', 'category' => 'support', 'keywords' => '["browser", "supported", "compatibility"]'],
    ['question' => 'Does the site work on mobile?', 'answer' => 'Yes, our website is fully responsive and works great on mobile devices, tablets, and desktop computers. You can shop from anywhere using any device.', 'category' => 'support', 'keywords' => '["mobile", "responsive", "phone"]'],
    ['question' => 'How do I clear my browser cache?', 'answer' => 'To clear your browser cache, go to your browser settings and look for "Clear browsing data" or "History". Select cached images and files, then click clear. This can help resolve loading issues.', 'category' => 'support', 'keywords' => '["cache", "clear cache", "browser data"]'],
    ['question' => 'Why is my page loading slowly?', 'answer' => 'Slow loading can be due to internet connection, browser cache, or high server traffic. Try clearing your cache, checking your internet connection, or trying a different browser.', 'category' => 'support', 'keywords' => '["slow loading", "performance", "speed"]'],
    ['question' => 'Can I save items for later without adding to cart?', 'answer' => 'Yes, use the wishlist feature by clicking the heart icon on any product. Items in your wishlist are saved for later and won\'t affect your cart.', 'category' => 'wishlist', 'keywords' => '["save for later", "wishlist", "bookmark"]'],
    ['question' => 'How do I share a product with friends?', 'answer' => 'On any product page, you can use the share button to copy the product link and share it via email, social media, or messaging apps.', 'category' => 'products', 'keywords' => '["share", "send to friend", "product link"]'],
    ['question' => 'Do you price match?', 'answer' => 'We do not currently offer price matching. However, we regularly run promotions and discounts to ensure competitive pricing on all our products.', 'category' => 'discounts', 'keywords' => '["price match", "competitor", "price guarantee"]'],
    ['question' => 'How often do you add new products?', 'answer' => 'We add new products weekly. Subscribe to our newsletter or follow our social media to stay updated on new arrivals and special launches.', 'category' => 'products', 'keywords' => '["new products", "arrivals", "updates"]'],
    ['question' => 'Can I request a specific product?', 'answer' => 'Yes! If you\'re looking for a specific component or product we don\'t carry, contact us with the details. We\'ll do our best to source it for you or suggest alternatives.', 'category' => 'products', 'keywords' => '["request product", "special order", "source"]'],
    ['question' => 'Do you offer educational discounts?', 'answer' => 'Yes, students and educational institutions can contact us for special pricing on bulk orders for projects, labs, or classroom use.', 'category' => 'discounts', 'keywords' => '["educational discount", "student", "school"]'],
    ['question' => 'What payment security measures do you have?', 'answer' => 'All payments are processed through Paystack, which uses industry-standard encryption and security measures. We never store your full card details on our servers.', 'category' => 'cart', 'keywords' => '["payment security", "encryption", "safe payment"]'],
    ['question' => 'Can I pay in installments?', 'answer' => 'Currently, we do not offer installment payments. All orders must be paid in full at checkout. We may introduce installment options in the future.', 'category' => 'cart', 'keywords' => '["installments", "pay later", "finance"]'],
    ['question' => 'What happens if payment fails?', 'answer' => 'If payment fails during checkout, you can retry with a different payment method. If payment fails after order placement, we will contact you to resolve the issue before processing.', 'category' => 'cart', 'keywords' => '["payment failed", "failed transaction", "payment error"]'],
    ['question' => 'How do I get a receipt?', 'answer' => 'A digital receipt is sent to your email immediately after successful payment. You can also download invoices from your Orders dashboard at any time.', 'category' => 'orders', 'keywords' => '["receipt", "proof of purchase", "confirmation"]'],
    ['question' => 'Can I cancel a pickup order?', 'answer' => 'Pickup orders can be cancelled within 1 hour of placement. Contact support immediately if you need to cancel a pickup order.', 'category' => 'orders', 'keywords' => '["cancel pickup", "pickup cancellation", "cancel order"]'],
    ['question' => 'What ID do I need for pickup?', 'answer' => 'When picking up your order, bring a valid government-issued ID (national ID, passport, or driver\'s license) and your order confirmation email or order number.', 'category' => 'shipping', 'keywords' => '["pickup id", "identification", "id required"]'],
    ['question' => 'Can someone else pick up my order?', 'answer' => 'Yes, someone else can pick up your order if they have your order number and a valid ID. You can also authorize a specific person by contacting support in advance.', 'category' => 'shipping', 'keywords' => '["proxy pickup", "someone else", "authorize pickup"]'],
    ['question' => 'How long do you hold pickup orders?', 'answer' => 'Pickup orders are held for 7 days from the order date. After 7 days, uncollected orders may be cancelled and refunded.', 'category' => 'shipping', 'keywords' => '["hold period", "pickup duration", "how long"]'],
    ['question' => 'What if I\'m late for pickup?', 'answer' => 'If you\'re running late, contact the pickup location to let them know. While we try to accommodate, orders not collected within 7 days may be cancelled.', 'category' => 'shipping', 'keywords' => '["late pickup", "delayed", "running late"]']
];

// Function to normalize question
function normalizeQuestion($question) {
    return strtolower(trim(preg_replace('/[^a-z0-9\s]/i', '', $question)));
}

// Insert each Q&A pair
$stmt = $pdo->prepare("INSERT INTO knowledge_base (question, question_normalized, answer, category, keywords, created_by) VALUES (?, ?, ?, ?, ?, 1)");

$successCount = 0;
$errorCount = 0;

foreach ($qaPairs as $qa) {
    try {
        $normalized = normalizeQuestion($qa['question']);
        $stmt->execute([
            $qa['question'],
            $normalized,
            $qa['answer'],
            $qa['category'],
            $qa['keywords']
        ]);
        $successCount++;
        echo "✓ Added: {$qa['question']}\n";
    } catch (PDOException $e) {
        $errorCount++;
        echo "✗ Failed: {$qa['question']} - " . $e->getMessage() . "\n";
    }
}

echo "\n=== Summary ===\n";
echo "Successfully added: $successCount Q&A pairs\n";
echo "Failed: $errorCount Q&A pairs\n";
echo "Knowledge base population completed!\n";
