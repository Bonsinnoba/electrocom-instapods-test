# ElectrCom — Development Log

> **Purpose:** A living record of every feature built, every architectural decision made, and the reasoning behind it.
> **Format:** Newest entries at the top within each section.
> **Timezone:** All timestamps are UTC.

---

## 📋 Table of Contents

1. [Phase 9 — Concurrency & Webhook Hardening](#phase-9--concurrency--webhook-hardening)
2. [Phase 8 — Order Simulation & Component Refactoring](#phase-8--order-simulation--component-refactoring)
3. [Phase 7 — ProductModal UX Improvements & Admin Panel Enhancements](#phase-7--productmodal-ux-improvements--admin-panel-enhancements)
4. [Phase 6 — Comparison Panel, Stock Urgency Labels & Wishlist Sync](#phase-6--comparison-panel-stock-urgency-labels--wishlist-sync)
5. [Phase 5 — Flash Sale Countdown Banners](#phase-5--flash-sale-countdown-banners)
6. [Phase 4 — Order Tracking Timeline UX](#phase-4--order-tracking-timeline-ux)
7. [Phase 3 — Push Alerts & Advanced Filtering](#phase-3--push-alerts--advanced-filtering)
8. [Partners Marquee Slider](#partners-marquee-slider)
9. [POS & Admin Refund System](#pos--admin-refund-system)
10. [Registration UX](#registration-ux)
11. [Case Studies & Design Conversations](#case-studies--design-conversations)
12. [Pending / Future Work](#pending--future-work)
13. [Decisions Index](#decisions-index)

---

## Phase 5 — Flash Sale Countdown Banners

### ✅ Flash Sale Countdown Banner Component
**Completed:** 2026-05-20 · 22:20 UTC

**What was built:**

#### `storefront/src/components/FlashSaleBanner.jsx` [NEW]
A premium, glassmorphic flash-sale banner rendered directly on the storefront homepage below the Hero Slider. Key features:

| Feature | Details |
|---|---|
| **Dynamic Product Scanning** | Filters `products[]` prop for active discounts (`discount_percent > 0`) with future `sale_ends_at` timestamps |
| **Spotlight Logic** | Selects the product with the **highest discount percentage** as the featured deal |
| **Self-Healing Fallback** | If no sale items exist in the catalog, renders a beautiful "Weekend Tech Extravaganza" promotional banner with a rolling midnight countdown so the banner never looks empty |
| **Real-Time Countdown** | 4-block timer (Days · Hours · Mins · Secs) updates via `setInterval` every second |
| **Featured Product Card** | Compact inline card with product image, strikethrough original price, green promo price, and floating `SAVE X%` badge |
| **Promo Code Fallback** | In non-sale mode, shows a glowing `CODE: FLASH35` promo code chip |

**Micro-Animations & Styling:**
- Deep dark glassmorphic gradient background with dual ambient radial red/blue glows
- Pulsing flame icon animation (`@keyframes flame-pulse`) with CSS `filter: drop-shadow`
- Hover: banner lifts 4px, border colour shifts to `rgba(239,68,68,0.2)`, CTA button glows
- Responsive stacking via `flexWrap: wrap` — countdown blocks and product info drop to new rows on mobile

**Integration:**
- Injected into `storefront/src/pages/Home.jsx` directly below `<HeroSlider />`, conditional on `!searchQuery` so it never appears alongside search results

**Decision:** Always render the banner (with a fallback), never conditionally hide it.
**Why:** Hiding the banner when no active sales exist wastes a high-visibility homepage slot. A graceful fallback (store-wide promo code + rolling timer) keeps the urgency alive without requiring a live database sale to be active, ensuring the page always looks rich and promotional.

---

## Phase 9 — Concurrency & Webhook Hardening

### ✅ Online Checkout Deadlock Elimination
**Completed:** 2026-05-26 · 11:12 UTC

**What was built:**
#### `api/orders.php`
- Integrated an item sorting routine (`usort`) before locking database rows in checkout.
- Cart items are now sorted numerically by product ID before entering the `FOR UPDATE` loop.
- **Why:** Guarantees a consistent lock acquisition order across all concurrent transactions, entirely preventing database deadlocks when multiple users attempt to checkout overlapping carts at the exact same millisecond.

---

### ✅ Webhook Processing Restructuring & Crash Resolution
**Completed:** 2026-05-26 · 11:28 UTC

**What was fixed:**
#### `api/paystack_webhook.php` & `api/cron_process_webhooks.php`
- Removed all redundant, nested transaction calls (`$pdo->beginTransaction()` and `$pdo->commit()`) from both the webhook handler and the retry background worker.
- **Why:** Downstream logic (such as `completeOrder`) already uses its own self-contained transaction layer. Attempting nested transactions on a single PDO connection triggered fatal `PDOException` crashes, failing 100% of inline checkouts and retry events.
- Added **Proactive DLQ Alerting**: Updated `api/cron_process_webhooks.php` to trigger an administrative dashboard alert (`logAdminNotification`) if a webhook event fails all 5 retries, instantly alerting staff to manually reconcile dead-lettered events.

---

### ✅ Payment Reconciliation Cron Implementation
**Completed:** 2026-05-26 · 11:13 UTC

**What was built:**
#### `api/cron_reconcile_payments.php` [NEW]
- Developed an automated background script to reconcile unpaid pending orders directly with Paystack's Transaction Verification API.
- Scans for `pending` orders created in the last 60 minutes with valid payment references, verifies status, and completes them using `completeOrder()`.
- **Why:** Acts as a bulletproof Dead Letter Queue (DLQ) / recovery mechanism. If the server goes offline during checkout and misses the Paystack webhook, this cron script recovers the order before `lazyCancelOrders()` auto-cancels it, protecting customer purchases from silent auto-cancellation.

---

## Phase 8 — Order Simulation & Component Refactoring

### ✅ Order Simulation Infrastructure (Temporary)
**Completed:** 2026-05-21 · (Testing Phase) — **Removed:** 2026-05-21

**What was built (and later removed):**
- `api/simulate_order.php` — Backend endpoint for testing order creation without Paystack payment verification
- `test_order_simulation.php` — CLI script for one-time order creation verification
- `TEST_MODE_NO_PAYSTACK` flag in `Checkout.jsx` — Temporary toggle to bypass Paystack for testing

**Why removed:** Testing completed, strict Paystack integration restored for production security.

---

### ✅ FilterPanel & Shop Component Refactoring
**Completed:** 2026-05-21

**What was built:**

#### `storefront/src/components/FilterPanel.jsx`
- Removed internal `localPrice` state
- Implemented controlled component pattern
- Accepts `priceValue` and `onPriceChange` props from parent

#### `storefront/src/pages/Shop.jsx`
- Added local state for price control
- Passes price state to `FilterPanel` as controlled props

**Decision:** Implement controlled component pattern.
**Why:** Fixed React `setState` in `useEffect` warnings by lifting state to parent component, ensuring proper React lifecycle management.

---

### ✅ Checkout Paystack Integration Cleanup
**Completed:** 2026-05-21

**What was built:**

#### `storefront/src/pages/Checkout.jsx`
- Removed `TEST_MODE_NO_PAYSTACK` constant and all test mode logic
- Removed `simulate_order.php` endpoint usage
- Enforced strict Paystack public key configuration requirement
- Fixed lint errors:
  - Removed unused `fullSubtotal` from destructuring
  - Changed `catch (err)` to `catch` to remove unused variable
  - Added `onSuccess` and `onClose` to useEffect dependencies
  - Wrapped `onSuccess` and `onClose` in `useCallback` hooks
  - Moved `useState` declaration before conditional return

**Decision:** Remove all test mode code for production security.
**Why:** Test mode bypasses payment gateway validation, which is unacceptable in production. Strict Paystack integration ensures all orders are properly authenticated and tracked.

---

### ✅ Bug Fixes
**Completed:** 2026-05-21

**What was fixed:**
- **"invalid token format" error**: Updated token retrieval to use `secureStorage` instead of `localStorage`
- **"no active transaction" error**: Removed nested transaction handling in `simulate_order.php`
- **Orders page breaking**: Wrapped cart clearing logic in try-catch to prevent errors from causing unexpected navigation
- **Date formatter compatibility**: Updated `formatDateTime` to support `dateStyle`/`timeStyle` options for newer Intl API

---

## Phase 7 — ProductModal UX Improvements & Admin Panel Enhancements

### ✅ ProductModal Conditional Rendering
**Completed:** 2026-05-22 · 08:35 UTC

**What was built:**

#### `storefront/src/components/ProductModal.jsx`
Added conditional rendering logic to hide unfilled form fields:
- **Documentation tab**: Only displays if `datasheet_url` or `directions` exists
- **Included Items tab**: Only displays if `included` array has items
- **Technical Specs tab**: Only displays if `product_code`, `specs`, or `directions` exists
- **Product description**: Now displays after rating section (if present)

**Decision:** Hide empty sections rather than showing placeholder content.
**Why:** Empty sections create visual noise and reduce user trust. Conditional rendering keeps the modal clean and only shows relevant information.

---

### ✅ Technical Specs Display Format
**Completed:** 2026-05-22 · 08:35 UTC

**What was built:**

#### `storefront/src/components/ProductModal.jsx`
Changed technical specs from a grid layout to comma-separated styled badges:
- Each spec displays as "key: value" in a styled badge
- Badges have background, border, and rounded corners
- Flex layout with wrapping for responsive display

**Decision:** Use badge-style display instead of grid.
**Why:** Badge layout is more compact, easier to scan, and matches the modern aesthetic of other UI elements. It also handles variable spec counts more gracefully.

---

### ✅ Admin Panel Product Editor Modal Width
**Completed:** 2026-05-22 · 08:29 UTC

**What was built:**

#### `admin-panel/src/pages/ProductManager.jsx`
Increased product editor modal width from 500px to 900px.

**Decision:** Increase modal width for better editing experience.
**Why:** The previous 500px width was too narrow for comfortable editing of product details, especially with the expanded form fields. 900px provides adequate space for all form elements while maintaining usability.

---

## Phase 6 — Comparison Panel, Stock Urgency Labels & Wishlist Sync

### ✅ D — Wishlist Server Sync
**Status:** Already complete (pre-existing) — `WishlistContext.jsx` calls `fetchWishlist`, `addToWishlist`, and `removeFromWishlist` from `api.js` on login and on every toggle. No changes required.

---

### ✅ E — Low Stock Urgency Labels on Product Cards
**Completed:** 2026-05-21 · 01:30 UTC

**What was built:**

#### `storefront/src/components/ProductCard.jsx`
Replaced the generic `"Available: N"` stock count with tiered urgency labels:

| Stock Level | Label | Style |
|---|---|---|
| 1–5 | `🔥 Only N left!` | `var(--danger)` + `stock-urgency-pulse` CSS flicker animation |
| 6–10 | `⚡ Selling fast` | `var(--warning)` amber |
| > 10 | `✓ In Stock` | `var(--success)` green, 80% opacity |
| 0 | SOLD OUT overlay | Pre-existing blur overlay — no change |

#### `storefront/src/style.css`
Added `@keyframes stock-urgency-flicker` (opacity 1 → 0.6 → 1 at 1.4s loop) bound to the `.stock-urgency-pulse` utility class.

---

### ✅ C — Product Comparison Panel
**Completed:** 2026-05-21 · 01:38 UTC

**What was built:**

#### `storefront/src/context/ComparisonContext.jsx` [NEW]
Global React context managing the comparison basket. Key behaviours:
- `compareList[]` — array of up to **3** product objects
- `addToCompare(product)` — no-op if already in list or list is full
- `removeFromCompare(id)`, `clearCompare()`
- `isInCompare(id)` — used by ProductCard for toggle state
- `isModalOpen` + `openModal` / `closeModal` — shared modal gate

#### `storefront/src/components/CompareBar.jsx` [NEW]
Sticky bottom panel that slides up when `compareList.length > 0`:
- 3 product slots (filled products show image + name + ×; empty slots show `+ Add product` ghost)
- Count badge `N / 3 selected`
- **Compare Now** button — disabled (opacity 50%) until ≥ 2 products selected
- Clear button with red hover border
- Animated entry via `compareBarSlideUp` CSS keyframe

#### `storefront/src/components/CompareModal.jsx` [NEW]
Bottom-sheet modal overlay with a scrollable comparison table:
- Rows: **Product**, **Price**, **Rating**, **Category**, **Availability**, **Discount**, **Action**
- Highlights winning cells: lowest price, highest rating, highest discount
- `🏆 BEST` badge pinned top-right of winning cells
- Stock column uses same tiered labels as ProductCard
- Per-column **Add to Cart** button using `CartContext`
- Dismisses on backdrop click or `×` button

#### `storefront/src/components/ProductCard.jsx`
Added a `<GitCompareArrows>` compare toggle button at `bottom: 12px, right: 12px` (above the existing wishlist/cart buttons). Blue fill when active, muted when not. Grayed out at 40% opacity when comparison list is full.

#### `storefront/src/App.jsx`
- Imported `ComparisonProvider`, `CompareBar`, `CompareModal`
- Wrapped `<CartProvider>` children with `<ComparisonProvider>`
- Rendered `<CompareBar />` and `<CompareModal />` globally before `<BackToTop />`

---

## Phase 4 — Order Tracking Timeline UX

### ✅ Inline Stepper Timeline on Orders Page
**Completed:** 2026-05-20 · 22:15 UTC

**What was built:**

#### `storefront/src/pages/Orders.jsx`
- **Steps Array:** Defined 4 canonical shipment stages (`Placed`, `Processing`, `Shipped`, `Delivered`) with matching Lucide icons, mirroring the full Order Tracking Modal.
- **`getStatusIndex(status)` helper:** Maps raw database status strings (`pending`, `processing`, `received`, `picking`, `picked`, `shipped`, `completed`, `delivered`) to a 0–3 index used to calculate connector width and determine the active node.
- **Inline `.card-timeline` stepper:** Rendered between order info and action buttons on every active order card. Features a relative-positioned track with an absolute progress fill bar (`width: index/(steps.length-1) * 100%`) and 4 circular icon nodes.
- **Active node styling:** The current step node receives the `.active-pulse` class, which triggers a CSS `@keyframes timeline-pulse` scale + opacity outline animation with a `var(--primary-blue)` border glow.
- **Mobile overrides:** `@media (max-width: 480px)` scales node containers to 28px, SVG icons to 12px, and label font-size to 8px to prevent clipping on small screens.

---

## Phase 3 — Push Alerts & Advanced Filtering

### ✅ C — Admin Push Notifications & Audio Chime Alerts
**Completed:** 2026-05-20 · 18:10 UTC

**What was built:**
- **`admin-panel/src/context/NotificationContext.jsx`** — Three improvements in one file:

  1. **10-second poll rate** (down from 45s) for near-real-time order detection.
  2. **Web Audio API chime synthesiser** — on each new notification, the browser builds and plays a dual-tone E5/G5 chord (`oscillatorType: 'sine'`) in memory. No MP3 or external audio files required. The chime fades out gracefully using a gain envelope.
  3. **Native Desktop Push Notifications** — `Notification.requestPermission()` is called when an admin mounts the context. If granted, a native OS notification fires for every new order with the notification title and body from the server.
  4. **Baseline filter** — a `useRef` (`maxSeenIdRef`) records the highest notification ID present on the very first poll. Only IDs greater than that baseline trigger audio + push. This prevents the entire notification history from becoming a wall of alert sounds on page load.

**Decision:** Use the Web Audio API rather than a static MP3.
**Why:** Hosting a sound file requires a build-step asset path, a CORS-safe server config, and browser autoplay exceptions. The Web Audio API synthesises the tone in one function call with zero dependencies, works across all modern browsers, and can be called from any user-interaction context (the first poll after login counts).

---

### ✅ D — Advanced Storefront Product Filtering
**Completed:** 2026-05-20 · 18:10 UTC

**What was built:**

#### `storefront/src/pages/Shop.jsx`
| Filter | Before | After |
|---|---|---|
| Category | Single string `'All'` | Array `[]` — empty = all |
| Price | Max price only | `minPrice` + `maxPrice` range |
| Stock | Not available | `inStockOnly` boolean |

Filter logic now checks: category in selected array **AND** price ≥ min **AND** price ≤ max **AND** rating ≥ minRating **AND** (stock > 0 if inStockOnly). The fallback "browse a category" buttons in the empty-state panel updated to set `categories: [cat]` (array) instead of the old `category: cat`.

#### `storefront/src/components/FilterPanel.jsx`
- **Categories** — Single-select pills replaced with **multi-select toggle pills**. Each pill flips its `categories[]` membership on click. Active pills show a `<Check>` icon from lucide-react.
- **Price Range** — Single "Max Price" row replaced with a **Min–Max dual-input** layout. Both inputs share the same 12px radius style. The range slider underneath still controls the Max field and commits on `mouseup`/`touchend`.
- **Availability** — New **"AVAILABILITY"** filter group with a native `<input type="checkbox">` labelled "Show In-Stock Only", styled with `accentColor: var(--primary-blue)`.
- **Reset** — Clears all five filter dimensions back to their default empty/zero state.

**Decision:** Keep categories as pills (not a dropdown) for discoverability.
**Why:** The storefront has a small, well-defined category list (< 15 items). Pills let a customer scan all options at a glance and toggle multiple in two taps. A dropdown would require an extra click to open, hide the full option set, and makes multi-select UX awkward on mobile.

---

## Partners Marquee Slider

### ✅ Phase 1 — Global Marquee & Admin Manager Integration
**Completed:** 2026-05-20 · 02:26 UTC

**What was built:**
- **Storefront Component:** Created a premium, CSS-powered infinite marquee slider (`PartnersMarquee.jsx`) for partner logos, featuring glassmorphism and hover-to-pause functionality.
- **Global Integration:** Injected the slider globally into `App.jsx` right above the `Footer`.
- **Admin Tabbed UI:** Enhanced `admin-panel/src/pages/SliderManager.jsx` with a tabbed interface to manage both Hero Slides and Partner Logos within the same view.
- **Backend & APIs:** Implemented `api/get_partners.php` and `api/admin_partners.php` with self-healing table initialization (`CREATE TABLE IF NOT EXISTS`) and base64 logo uploading logic.
- **Deprecation Cleanup:** Removed the legacy dedicated `/collaborators` page and associated links in `Footer.jsx` and `AboutUs.jsx`.

**Decision:** Rely entirely on pure CSS animations (`@keyframes`) for the infinite scroll rather than JavaScript libraries or timers.
**Why:** JavaScript intervals for scroll animations suffer from stuttering and main-thread blocking. A CSS-based transform guarantees buttery-smooth, hardware-accelerated 60fps rendering without taxing the client's processor.

---

## POS & Admin Refund System

### ✅ Security & Performance Audit Fixes
**Completed:** 2026-05-19 · 00:58 UTC

**What was built:**
1. **Double-Return Fraud Guard:** Added an aggressive lock and validation check to `admin_returns.php` POST handler. It now ensures `SUM(quantity_returned)` never exceeds `quantity_purchased` for any line item, preventing staff from over-returning and artificially inflating the refundable ceiling.
2. **POS Orders Visibility:** Fixed a hard `JOIN` in `admin_returns.php` GET handler that caused POS orders (which lack user accounts) to disappear from the `ReturnManager` history.
3. **Refund Linking:** Updated `admin_returns.php` to return the newly generated `return_id`, allowing the frontend to correctly bind the subsequent financial refund back to the specific physical return that authorized it.
4. **Server-Side Order Search:** Updated `admin_orders.php` to accept a `search` parameter, and updated `ReturnManager.jsx` to use it instead of fetching the entire database to memory and filtering client-side.
5. **Database Indexing:** Applied missing SQL migrations to create the `order_returns` and `refunds` tables, and injected an index on `gateway_ref` to optimize webhook lookup speed.
6. **Template Variable Patch:** Fixed an undefined `$brandName` warning in the `refund_failed.php` template.

---

### ✅ Phase 4 — Customer Refund Failure Notification (Option C)
**Completed:** 2026-05-19 · 00:28 UTC

**What was built:**
- `api/email/templates/refund_failed.php` — New HTML+text email template sent to the customer when a Paystack refund bounces.
- `api/paystack_webhook.php` — Extended the `refund.failed` event handler to:
  1. Fetch the customer's name, email, and original payment method from the order.
  2. Queue the `refund_failed` email via `EmailEngine` (routes through SMTP / Mailgun / SendGrid depending on config).
  3. Push a ⚠ in-app notification to all `admin` / `super` users with order reference and customer contact.

**Email content:**
- Warm reassurance: *"Your money is safe with us."*
- Clear explanation of why it failed (prepaid/expired card).
- Three actionable alternatives: MoMo number, Bank Transfer, Cash at Store.
- Reply-based flow — no new UI required from the customer.

**Decision made:** *Option C — Automatic refund, customer notified only on failure.*

**Why:**
- Option A (staff decides entirely) is manual and error-prone at scale.
- Option B (customer always chooses) adds unnecessary friction to the 95% of refunds that succeed back to the original card.
- Option C is the industry standard (Stripe, Flutterwave, Paystack itself all use this). The customer is only interrupted when there is actually a problem, keeping the happy path frictionless.

---

### ✅ Webhook Refund Lifecycle Handlers
**Completed:** 2026-05-19 · 00:21 UTC

**What was built:**
- `api/paystack_webhook.php` — Added handlers for three Paystack refund events:
  - `refund.pending` → sets `refunds.status = 'pending'`
  - `refund.processed` → sets `refunds.status = 'processed'`, stamps `processed_at`
  - `refund.failed` → sets `refunds.status = 'failed'`, triggers customer email + admin alert (see Phase 4)

**Matching logic:**
1. Primary: `refunds.gateway_ref` = Paystack's numeric refund ID (stored at issue time).
2. Fallback: JOIN `orders.payment_reference` to catch older event formats that omit the refund ID.

**Why this matters — the prepaid card problem:**
Paystack's refund API call always returns `success: true` synchronously (the refund was *submitted*). Whether the money actually reaches the customer is determined asynchronously by the card network. For prepaid cards that have been closed or expired since purchase, the network rejects the credit and sends the funds back to the merchant's Paystack balance. Without the webhook handler, this failure is invisible — the `refunds` table would show `processed` when the customer never received anything.

---

### ✅ Phase 3 — Admin `ReturnManager` Full Rewrite
**Completed:** 2026-05-18 · 23:55 UTC

**What was built:**
- `admin-panel/src/pages/ReturnManager.jsx` — Complete rewrite:
  - Replaced all `alert()` calls with `addToast()`.
  - Added **Step 3 Refund Panel** — appears automatically after a return is authorized.
  - Fetches live refund info via `fetchRefundInfo()` and pre-fills amount as `qty × price_at_purchase`.
  - Auto-selects `paystack` if order's `payment_method` is paystack, otherwise defaults to `cash`.
  - Shows a warning banner if Paystack selected but no `payment_reference` on order.
  - "Issue Refund" → `POST admin_refund.php` → Paystack API or cash record.
  - "Skip Refund" → return recorded, refund deferred for later.
  - Return history table gains a `status` badge column.

---

### ✅ Security Hardening — `admin_refund.php` Legitimacy & Amount Cap
**Completed:** 2026-05-19 · 00:07 UTC

**What was fixed:**

Before this change, `admin_refund.php` only validated:
```
amount ≤ order_total − already_refunded
```
This allowed a manager to issue a refund against any order with no return ever filed, and to refund up to the full order total regardless of what was actually returned.

**Four-layer validation chain now enforced:**

| Layer | Check |
|---|---|
| 1 | Order exists in the database |
| 2 | At least one `order_returns` row with `status IN ('processed', 'inspected')` must exist — proof goods were physically returned before money goes out |
| 3 | If `return_id` is provided, it must belong to this order AND be confirmed |
| 4 | `amount ≤ SUM(returned qty × price_at_purchase) − already_refunded` — ceiling is based on *what was returned*, not full order total |

**GET endpoint also updated:** `refundable` field uses the same returns-based ceiling. Response now includes `returns[]` and `returned_value_total`.

**Decision:** The time window (48h POS / admin policy) is enforced at the **return submission stage**, not the refund stage. The return record is the audit proof.

---

### ✅ Phase 2 — POS Interface Refund UI
**Completed:** 2026-05-18 · 23:53 UTC

**What was built:**
- `admin-panel/src/pages/POSInterface.jsx` — After a return is confirmed, the right panel transitions to a **Refund Step** instead of immediately resetting.
- Pre-fills amount = `SUM(returned qty × price_at_purchase)`.
- Auto-selects `paystack` if `order.payment_method === 'momo'`, else `cash`.
- Staff can edit the amount (partial refunds supported).
- "ISSUE REFUND" → `POST admin_refund.php`.
- "SKIP REFUND" → return recorded, refund deferred.

---

### ✅ Phase 1 — Database, Backend & API Service
**Completed:** 2026-05-17 · (previous session)

**What was built:**

**Database** — `api/migrations/0010_create_refunds_table.sql`
- `refunds` table: `order_id`, `return_id`, `amount`, `method` (cash|paystack), `gateway_ref`, `status` (pending|processed|failed), `approved_by`, `note`, `processed_at`.

**Backend** — `api/admin_refund.php`
- `GET ?order_id=X` → refund history + refundable balance + linked returns.
- `POST` → processes refund via Paystack API or records cash. Failed gateway calls persisted as `status='failed'`.
- Auth: `super` and `store_manager` only.

**Frontend service** — `admin-panel/src/services/api.js`
- `fetchRefundInfo(orderId)` and `issueRefund(payload)` added.

**Decision:** Use Paystack for refunds (not direct MTN MoMo API).

**Why:** Paystack already processes all payments on this platform (card, MoMo, USSD). The Paystack Refund API reverses any transaction it processed using only the `payment_reference`. One integration covers all payment types. Direct MTN MoMo API requires separate registration, sandbox credentials, and Ghana-specific compliance steps — significant overhead for redundant coverage.

---

## Registration UX

### ✅ Disabled Registration — Locked State UI
**Completed:** 2026-05-17 · (previous session)

**What was built:**
- `storefront/src/components/AuthModal.jsx` — When `canRegister` is false, the sign-up form is replaced with a professional locked card.

**Copywriting (user-specified):**
> *"We're temporarily pausing new account creations while we upgrade a few things behind the scenes. We'll be back open shortly! If you're already part of the family, you can* **[Sign In here]**."

Inline "Sign In here" link switches the modal view. Overlay panel updated with maintenance message.

**Decision:** Show a branded maintenance message instead of a generic disabled form.

**Why:** A dead/empty form is confusing — customers don't know if the site is broken or if registration is intentionally paused. A clear, warm message with an alternative action reduces support contacts and maintains trust.

---

## Case Studies & Design Conversations

> Real-world scenarios raised during development that shaped architectural decisions.
> Each entry records the question, what was found, and what code it triggered.

---

### 🔎 CS-1 — Partial Refunds: Refunding One Item, Not the Whole Order
**Raised:** 2026-05-19 · ~00:00 UTC

**The question:**
> *"What if a user wants to refund an item from an order and not the whole order, what do we do?"*

**What was found:**
The system already supported this. `order_returns` records link to a specific `product_id` + `quantity`, not the whole order. The refund amount field is pre-filled with `qty × price_at_purchase` for that item only and is editable. The backend validates against returned-item value, not the full order total.

**Example:**
- Order total: GH₵ 300 (5 items)
- Customer returns 1 item worth GH₵ 80
- Refund panel opens pre-filled with **GH₵ 80** — not GH₵ 300
- Staff can reduce to GH₵ 50 if the item was partially used

**Code triggered:** Confirmed partial refund support; conversation directly led to the security hardening in CS-3.

---

### 🔎 CS-2 — Combining Refunds to Reduce Paystack Costs
**Raised:** 2026-05-19 · ~00:03 UTC

**The question:**
> *"Can we combine the two to reduce Paystack's cost?"*

**What was found:**
Paystack does **not** charge per refund API call. Refunds proportionally reverse the original transaction fee. The real benefit of batching is:
- Fewer API calls (less failure surface)
- Cleaner audit trail (1 refund record vs 3)
- Less noise in the Paystack dashboard

The backend already supports batched refunds natively — the `refundable` balance accumulates across multiple returns. Staff can skip the refund after each item and issue one combined refund at the end covering all of them.

**Pending:** The UI does not yet make this workflow explicit (🔴 High priority backlog item).

---

### 🔎 CS-3 — Legitimacy: Proving the Order and Time Window Are Valid
**Raised:** 2026-05-19 · ~00:06 UTC

**The question:**
> *"If the refund is not product-based, how do you confirm that the order is legit and the time hasn't expired?"*

**What was found:**
The original `admin_refund.php` only checked `amount ≤ order_total − already_refunded`. A manager could refund any order with no return record at all, or for more than what was actually returned.

**Design principles settled:**
1. The **48-hour window** is enforced at the *return submission* stage (`pos_return.php`) — not at the refund stage. Accounting may process refunds days later; that is fine.
2. The `order_returns` row (`status = 'processed'`) is the **audit proof** that goods came back before money went out.
3. The **refundable ceiling** must be `SUM(returned qty × price_at_purchase)` — not the order total.

**Code triggered:** Full 4-layer security hardening of `admin_refund.php` (completed 2026-05-19 · 00:07 UTC).

---

### 🔎 CS-4 — Does the Admin Panel Cover Online Order Refunds?
**Raised:** 2026-05-19 · ~00:11 UTC

**The question:**
> *"Does the online system also have the refund? / Can admins refund the online returns?"*

**What was found:**
`admin_returns.php` and `admin_refund.php` are order-type agnostic — they work on any order regardless of POS or online origin.

| | POS Returns | Online Returns |
|---|---|---|
| Who triggers | Cashier in POSInterface | Admin/Manager in ReturnManager |
| Time limit | Hard 48h (pos_return.php) | Manager discretion |
| Paystack refund | Works (POS MoMo orders have `payment_reference`) | Works (all online Paystack orders have `payment_reference`) |

**Code triggered:** None — confirmed the architecture was already correct.

---

### 🔎 CS-5 — Prepaid Cards and the Silent Failure Problem
**Raised:** 2026-05-19 · ~00:16 UTC

**The questions:**
> *"But does card transfer also work?" / "What of prepaid cards?"*

**What was found:**
Paystack's Refund API accepts only the `payment_reference` and handles routing internally — it works for all instruments (debit, credit, MoMo, USSD). However, prepaid cards introduce a silent failure mode:

| Prepaid card state | Outcome |
|---|---|
| Active | ✅ Refund lands normally |
| Expired | ⚠ Card network usually routes to issuing bank — some issuers drop it |
| Closed / depleted | ❌ Network rejects — amount bounces to merchant Paystack balance |
| One-time-use virtual | ❌ Almost always rejected — card destroyed after use |

**Critical gap:** Paystack's synchronous API response only confirms the refund was *submitted*. The actual failure arrives asynchronously via webhook — and without a handler, the `refunds` table would silently show `processed` while the customer never received anything.

**Code triggered:** Full webhook refund lifecycle handlers (`refund.pending`, `refund.processed`, `refund.failed`) added to `paystack_webhook.php` (completed 2026-05-19 · 00:21 UTC).

---

### 🔎 CS-6 — Should Customers Choose Where They Receive Refunds?
**Raised:** 2026-05-19 · ~00:22 UTC

**The question:**
> *"Do users get to choose where they want to receive their refunds?"*

**Three options evaluated:**

| Option | Mechanism | Verdict |
|---|---|---|
| **A** | Staff picks method entirely in admin panel | ❌ Manual, error-prone at scale |
| **B** | Customer always specifies preference upfront | ❌ Friction on the 95% happy path |
| **C** | Auto-refund to original method; notify customer only if it fails | ✅ **Selected** |

**Why Option C:**
This is the model used by Stripe, Flutterwave, and Paystack itself. On the happy path, the customer never sees extra steps. The email + admin alert are only triggered by an actual failure, at which point the customer genuinely needs to act.

**Decision made by user:** 2026-05-19 · ~00:26 UTC

**Code triggered:** `refund_failed.php` email template + webhook notification block (Phase 4, completed 2026-05-19 · 00:28 UTC).

---

## Pending / Future Work

---

## POS & Admin Refund System

### ✅ Phase 4 — Customer Refund Failure Notification (Option C)
**Completed:** 2026-05-19 · 00:28 UTC

**What was built:**
- `api/email/templates/refund_failed.php` — New HTML+text email template sent to the customer when a Paystack refund bounces.
- `api/paystack_webhook.php` — Extended the `refund.failed` event handler to:
  1. Fetch the customer's name, email, and original payment method from the order.
  2. Queue the `refund_failed` email via `EmailEngine` (routes through SMTP / Mailgun / SendGrid depending on config).
  3. Push a ⚠ in-app notification to all `admin` / `super` users with order reference and customer contact.

**Email content:**
- Warm reassurance: *"Your money is safe with us."*
- Clear explanation of why it failed (prepaid/expired card).
- Three actionable alternatives: MoMo number, Bank Transfer, Cash at Store.
- Reply-based flow — no new UI required from the customer.

**Decision made:** *Option C — Automatic refund, customer notified only on failure.*

**Why:**
- Option A (staff decides entirely) is manual and error-prone at scale.
- Option B (customer always chooses) adds unnecessary friction to the 95% of refunds that succeed back to the original card.
- Option C is the industry standard (Stripe, Flutterwave, Paystack itself all use this). The customer is only interrupted when there is actually a problem, keeping the happy path frictionless.

---

### ✅ Webhook Refund Lifecycle Handlers
**Completed:** 2026-05-19 · 00:21 UTC

**What was built:**
- `api/paystack_webhook.php` — Added handlers for three Paystack refund events:
  - `refund.pending` → sets `refunds.status = 'pending'`
  - `refund.processed` → sets `refunds.status = 'processed'`, stamps `processed_at`
  - `refund.failed` → sets `refunds.status = 'failed'`, triggers customer email + admin alert (see Phase 4)

**Matching logic:**
1. Primary: `refunds.gateway_ref` = Paystack's numeric refund ID (stored at issue time).
2. Fallback: JOIN `orders.payment_reference` to catch older event formats that omit the refund ID.

**Why this matters — the prepaid card problem:**
Paystack's refund API call always returns `success: true` synchronously (the refund was *submitted*). Whether the money actually reaches the customer is determined asynchronously by the card network. For prepaid cards that have been closed or expired since purchase, the network rejects the credit and sends the funds back to the merchant's Paystack balance. Without the webhook handler, this failure is invisible — the `refunds` table would show `processed` when the customer never received anything.

---

### ✅ Phase 3 — Admin `ReturnManager` Full Rewrite
**Completed:** 2026-05-18 · 23:55 UTC

**What was built:**
- `admin-panel/src/pages/ReturnManager.jsx` — Complete rewrite:
  - Replaced all `alert()` calls with `addToast()`.
  - Added **Step 3 Refund Panel** — appears automatically after a return is authorized.
  - Fetches live refund info via `fetchRefundInfo()` and pre-fills amount as `qty × price_at_purchase`.
  - Auto-selects `paystack` if order's `payment_method` is paystack, otherwise defaults to `cash`.
  - Shows a warning banner if Paystack selected but no `payment_reference` on order.
  - "Issue Refund" → `POST admin_refund.php` → Paystack API or cash record.
  - "Skip Refund" → return recorded, refund deferred for later.
  - Return history table gains a `status` badge column.

---

### ✅ Security Hardening — `admin_refund.php` Legitimacy & Amount Cap
**Completed:** 2026-05-19 · 00:07 UTC

**What was fixed:**

Before this change, `admin_refund.php` only validated:
```
amount ≤ order_total − already_refunded
```
This allowed a manager to issue a refund against any order with no return ever filed, and to refund up to the full order total regardless of what was actually returned.

**Four-layer validation chain now enforced:**

| Layer | Check |
|---|---|
| 1 | Order exists in the database |
| 2 | At least one `order_returns` row with `status IN ('processed', 'inspected')` must exist — proof goods were physically returned before money goes out |
| 3 | If `return_id` is provided, it must belong to this order AND be confirmed |
| 4 | `amount ≤ SUM(returned qty × price_at_purchase) − already_refunded` — ceiling is based on *what was returned*, not full order total |

**GET endpoint also updated:** `refundable` field uses the same returns-based ceiling. Response now includes `returns[]` and `returned_value_total`.

**Decision:** The time window (48h POS / admin policy) is enforced at the **return submission stage**, not the refund stage. The return record is the audit proof.

---

### ✅ Phase 2 — POS Interface Refund UI
**Completed:** 2026-05-18 · 23:53 UTC

**What was built:**
- `admin-panel/src/pages/POSInterface.jsx` — After a return is confirmed, the right panel transitions to a **Refund Step** instead of immediately resetting.
- Pre-fills amount = `SUM(returned qty × price_at_purchase)`.
- Auto-selects `paystack` if `order.payment_method === 'momo'`, else `cash`.
- Staff can edit the amount (partial refunds supported).
- "ISSUE REFUND" → `POST admin_refund.php`.
- "SKIP REFUND" → return recorded, refund deferred.

---

### ✅ Phase 1 — Database, Backend & API Service
**Completed:** 2026-05-17 · (previous session)

**What was built:**

**Database** — `api/migrations/0010_create_refunds_table.sql`
- `refunds` table: `order_id`, `return_id`, `amount`, `method` (cash|paystack), `gateway_ref`, `status` (pending|processed|failed), `approved_by`, `note`, `processed_at`.

**Backend** — `api/admin_refund.php`
- `GET ?order_id=X` → refund history + refundable balance + linked returns.
- `POST` → processes refund via Paystack API or records cash. Failed gateway calls persisted as `status='failed'`.
- Auth: `super` and `store_manager` only.

**Frontend service** — `admin-panel/src/services/api.js`
- `fetchRefundInfo(orderId)` and `issueRefund(payload)` added.

**Decision:** Use Paystack for refunds (not direct MTN MoMo API).

**Why:** Paystack already processes all payments on this platform (card, MoMo, USSD). The Paystack Refund API reverses any transaction it processed using only the `payment_reference`. One integration covers all payment types. Direct MTN MoMo API requires separate registration, sandbox credentials, and Ghana-specific compliance steps — significant overhead for redundant coverage.

---

## Registration UX

### ✅ Disabled Registration — Locked State UI
**Completed:** 2026-05-17 · (previous session)

**What was built:**
- `storefront/src/components/AuthModal.jsx` — When `canRegister` is false, the sign-up form is replaced with a professional locked card.

**Copywriting (user-specified):**
> *"We're temporarily pausing new account creations while we upgrade a few things behind the scenes. We'll be back open shortly! If you're already part of the family, you can* **[Sign In here]**."

Inline "Sign In here" link switches the modal view. Overlay panel updated with maintenance message.

**Decision:** Show a branded maintenance message instead of a generic disabled form.

**Why:** A dead/empty form is confusing — customers don't know if the site is broken or if registration is intentionally paused. A clear, warm message with an alternative action reduces support contacts and maintains trust.

---

## Pending / Future Work

| Priority | Feature | Description |
|---|---|---|
| 🔴 High | Multi-item admin returns | Upgrade `admin_returns.php` to accept `items[]` array (matching POS flow) |
| 🔴 High | Combined Paystack refund | Queue multiple return refunds and issue a single Paystack call to reduce API calls |
| 🟡 Medium | Customer return request flow | "Request Return" button on `Orders.jsx` for delivered orders; admin approval queue in `ReturnManager` |
| 🟡 Medium | Refund status on customer Orders page | Show "Refunded / Pending Refund" badge on order cards in the storefront |
| 🟢 Low | Store credit option | Allow customer to opt for loyalty points / store credit instead of a cash/card refund |

---

## Decisions Index

| Date (UTC) | Decision | Rationale |
|---|---|---|
| 2026-05-26 | Sort cart items by ID before locking | Guarantees consistent lock acquisition sequence, eliminating transaction deadlocks under high checkout volumes. |
| 2026-05-26 | Delegate transaction handling to completeOrder() | Avoids fatal PHP PDO nested transaction crashes in the webhook handler while preserving atomic stock updates. |
| 2026-05-26 | Run background reconciliation cron for pending orders | Automatically recovers paid orders whose webhooks were missed, preventing their dynamic soft reservations from being auto-cancelled. |
| 2026-05-17 | Use Paystack for refunds, not direct MTN MoMo API | Single integration covers card + MoMo + USSD. No new credentials or compliance overhead. |
| 2026-05-17 | `refunds` table separate from `order_returns` | Returns = inventory event. Refunds = financial event. Separate concerns, separate tables. |
| 2026-05-18 | Refund panel appears *after* return confirmation | Can't issue a refund before goods are back. The return record is the legal proof that authorises the money movement. |
| 2026-05-19 | Refundable ceiling = returned item value, not order total | Prevents over-refunding. A customer returning one item from a 5-item order cannot receive the full order value. |
| 2026-05-19 | Time window enforced at return stage, not refund stage | Accounting may process refunds days after the return. The `order_returns.created_at` timestamp is the proof of legitimacy. |
| 2026-05-19 | Option C for failed refunds (auto-notify, no upfront preference) | Keeps the happy path frictionless. Only interrupts the customer when there is an actual problem. Industry standard used by Stripe, Flutterwave, and Paystack itself. |
| 2026-05-19 | Dual notification on refund failure (customer email + admin in-app alert) | Customer knows their money is safe and has a clear action. Admin has a visible task so the manual follow-up is not forgotten. |
