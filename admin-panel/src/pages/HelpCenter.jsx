import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Zap,
  Users,
  Megaphone,
  Bell,
  Settings,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  MessageSquare,
  Mail,
  FileText,
} from 'lucide-react';
import {
  HelpScreenshot,
  MockSidebar,
  MockCard,
  MockStatRow,
  MockTable,
  MockTabs,
  MockPOSCart,
} from '../components/help/HelpIllustration';

function StepList({ items }) {
  return (
    <ol className="help-steps">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ol>
  );
}

const CALLOUT_STYLES = {
  tip:     { bg: 'rgba(34,197,94,0.08)',  border: 'var(--success)',      icon: '💡', label: 'Tip' },
  warning: { bg: 'rgba(239,68,68,0.08)',   border: 'var(--danger)',       icon: '⚠️', label: 'Important' },
  note:    { bg: 'rgba(59,130,246,0.08)',  border: 'var(--primary-blue)', icon: 'ℹ️', label: 'Note' },
};

function Callout({ type = 'note', children }) {
  const s = CALLOUT_STYLES[type];
  return (
    <div style={{
      margin: '14px 0',
      padding: '14px 18px',
      borderRadius: 12,
      background: s.bg,
      borderLeft: `4px solid ${s.border}`,
      fontSize: 13,
      lineHeight: 1.65,
      color: 'var(--text-main)',
    }}>
      <span style={{ fontWeight: 800, marginRight: 6 }}>{s.icon} {s.label}:</span>{children}
    </div>
  );
}

function Section({ id, icon, title, children }) {
  return (
    <section id={id} className="help-section card glass" style={{ padding: '28px 32px' }}>
      <h2 className="help-section-title">
        <span className="help-section-icon">{icon}</span>
        {title}
      </h2>
      <div className="help-section-body">{children}</div>
    </section>
  );
}

function JumpLink({ to, children }) {
  return (
    <Link to={to} className="help-jump-link">
      {children}
      <ChevronRight size={14} />
    </Link>
  );
}

export default function HelpCenter() {
  const { user } = useAuth();
  const role = user?.role || 'store_manager';
  const isSuper = role === 'super';
  const isAccountant = role === 'accountant';
  const isPicker = role === 'picker';
  const isMarketing = role === 'marketing';
  const isManager = role === 'store_manager' || role === 'super';

  const toc = [
    { id: 'start', label: 'First steps' },
    ...(!isPicker && !isAccountant ? [{ id: 'dashboard', label: 'Dashboard' }] : []),
    ...(!isAccountant && !isPicker ? [{ id: 'inventory', label: 'Inventory' }] : []),
    ...(!isMarketing ? [{ id: 'sales', label: 'Sales & fulfillment' }] : []),
    ...(!isMarketing && !isAccountant && !isPicker ? [{ id: 'pos', label: 'POS & returns' }] : []),
    ...(isMarketing ? [{ id: 'marketing', label: 'Marketing' }] : []),
    ...(!isMarketing && !isPicker ? [{ id: 'customers', label: 'Customers' }] : []),
    ...(!isAccountant ? [{ id: 'staffhub', label: 'Staff Hub' }] : []),
    ...(isManager ? [{ id: 'cms', label: 'Content Management' }] : []),
    { id: 'alerts', label: 'Alerts' },
    ...(!isMarketing ? [{ id: 'settings', label: 'Settings' }] : []),
    ...(isSuper ? [{ id: 'super', label: 'Super admin' }] : []),
    { id: 'new-features', label: 'New Features (Phases 3-6)' },
  ];

  // ── Scrollspy: track which section is in view ─────────────────────────────
  const [activeId, setActiveId] = useState(toc[0]?.id ?? 'start');
  const observerRef = useRef(null);

  useEffect(() => {
    const ids = toc.map((t) => t.id);
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean);

    // Use a small negative top margin so the section is considered "active"
    // slightly before it reaches the very top of the viewport.
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find all entries currently intersecting and pick the one
        // closest to the top of the viewport.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-10% 0px -70% 0px',
        threshold: 0,
      }
    );

    elements.forEach((el) => observerRef.current.observe(el));
    return () => observerRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <div className="help-page animate-fade-in">
      <header className="help-hero card glass" style={{ padding: '32px 36px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'rgba(var(--accent-blue-rgb), 0.12)',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen size={28} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Admin help &amp; how-to
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, maxWidth: 720 }}>
              Task-based guides for your role. Each topic includes a <strong>window-style illustration</strong> (and will show your
              own screenshot if you add images under <code style={{ fontSize: 13 }}>public/help/</code> — see the README there).
            </p>
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--info-bg)',
                border: '1px solid var(--border-light)',
                fontSize: 13,
                color: 'var(--text-main)',
              }}
            >
              <Lightbulb size={18} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
              <span>
                Signed in as <strong>{role}</strong>. Sections below match what you can usually access; links open the real screen in this app.
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="help-layout">
        <nav className="help-toc card glass" aria-label="On this page">
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
            On this page
          </div>
          <ul>
            {toc.map((item) => {
              const isActive = item.id === activeId;
              return (
                <li key={item.id} style={{ position: 'relative' }}>
                  {/* Active accent bar */}
                  {isActive && (
                    <span
                      style={{
                        position: 'absolute',
                        left: -12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 3,
                        height: '70%',
                        borderRadius: 4,
                        background: 'var(--primary-blue)',
                        transition: 'all 0.25s ease',
                      }}
                    />
                  )}
                  <a
                    href={`#${item.id}`}
                    style={{
                      display: 'block',
                      padding: '5px 10px',
                      borderRadius: 8,
                      fontSize: isActive ? 13 : 13,
                      fontWeight: isActive ? 800 : 500,
                      color: isActive ? 'var(--primary-blue)' : 'var(--text-muted)',
                      background: isActive ? 'rgba(var(--primary-blue-rgb, 30,58,138), 0.08)' : 'transparent',
                      transition: 'all 0.2s ease',
                      textDecoration: 'none',
                      letterSpacing: isActive ? '-0.01em' : 'normal',
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveId(item.id);
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="help-articles">
          <Section id="start" icon={<BookOpen size={22} />} title="First steps">
            <p className="help-lead">
              Use the <strong>left sidebar</strong> to move between areas of the admin panel. The items visible to you depend on your role — hidden items are not a bug, they are intentional access controls.
            </p>
            <StepList
              items={[
                'Log in with your assigned staff email and password. Super users land on the Global Overview; all other roles land on their role-specific home screen.',
                'Keep one browser tab on the admin URL. If you need to verify what customers see on the storefront, open it in a separate tab — changes you save reflect in real time.',
                'The session will automatically expire after a period of inactivity (configured by your super admin). You will be logged out and shown a message; simply log back in.',
                'If a page fails to load or shows an error, check System Alerts first — it often contains the relevant warning or event that explains the failure.',
                ...(isAccountant
                  ? ['Your home screen is the Finance Dashboard — revenue cards, expense summaries, and data exports are all accessible from there.']
                  : []),
                ...(isPicker
                  ? ['As a picker, your workflow runs through Picker Hub (home) and Sales & Fulfillment. Inventory catalog and POS are hidden from your sidebar by design.']
                  : []),
              ]}
            />
            <Callout type="tip">
              Bookmark the admin URL directly in your browser. Use your browser's tab pinning feature to keep it always accessible without accidentally closing it during a busy shift.
            </Callout>
            <Callout type="note">
              If you see fewer sidebar items than a colleague, your roles differ. Speak to your super admin if you believe a section has been hidden incorrectly.
            </Callout>
            <HelpScreenshot title="ElectrCom Admin" urlBar="admin.example.com / Dashboard">
              <MockSidebar activeLabel="Dashboard" />
              <div className="help-mock-main">
                <div className="help-mock-h1" />
                <div className="help-mock-sub" />
                <MockCard>
                  <MockStatRow />
                </MockCard>
              </div>
            </HelpScreenshot>
          </Section>

          {!isPicker && !isAccountant && (
            <Section id="dashboard" icon={<LayoutDashboard size={22} />} title="Dashboard & analytics">
              <p className="help-lead">
                The dashboard gives a real-time summary of store health — revenue, orders, and actionable suggestions — all on one screen. Charts load asynchronously so the page is usable immediately while data is fetched in the background.
              </p>
              <JumpLink to="/">Open Dashboard</JumpLink>
              <StepList
                items={[
                  'Review the stat cards at the top row: today\'s revenue, total orders, pending orders, and low-stock count give a fast health check.',
                  'Use the chart range toggles (7d / 30d / 90d / 1y) to change the revenue and orders graph window without reloading the page.',
                  'The Suggested Actions panel highlights items that need attention — low stock items, pending orders awaiting processing, and marketing opportunities.',
                  'Click any suggested action card to navigate directly to the relevant module (e.g. clicking a low-stock card opens Inventory Hub pre-filtered).',
                  'The Revenue chart plots gross sales by day. Hover over any data point to see the exact figure for that date.',
                ]}
              />
              <Callout type="tip">
                Switch to the 90d view at the start of each month to spot seasonal revenue trends. If a period shows a sharp dip, cross-reference it with System Alerts from that date — maintenance events or provider outages often explain anomalies.
              </Callout>
              <Callout type="note">
                Charts are loaded after the initial page render to keep the dashboard fast. If a chart appears empty, wait 2–3 seconds or do a soft refresh — a blank chart on first load is normal, not an error.
              </Callout>
              <HelpScreenshot file="dashboard.png" title="Dashboard — ElectrCom" urlBar="…/ (home)">
                <MockSidebar activeLabel="Dashboard" />
                <div className="help-mock-main">
                  <div className="help-mock-h1" />
                  <div className="help-mock-sub" />
                  <MockCard>
                    <MockStatRow />
                  </MockCard>
                  <MockCard style={{ minHeight: 80 }}>
                    <div style={{ height: 48, borderRadius: 8, background: 'rgba(var(--accent-blue-rgb), 0.12)' }} />
                  </MockCard>
                </div>
              </HelpScreenshot>
            </Section>
          )}

          {!isAccountant && !isPicker && (
            <Section id="inventory" icon={<Package size={22} />} title="Inventory & products">
              <p className="help-lead">
                <strong>Product Catalog</strong> is your master list of every SKU the store sells. It handles pricing,
                images, stock levels, and physical shelving locations. The <strong>Bulk Shelving</strong> tab lets you
                update Aisle / Rack / Bin for dozens of SKUs in a single operation.
              </p>
              <JumpLink to="/catalog">Open Inventory Hub</JumpLink>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Adding &amp; editing products</h3>
              <StepList
                items={[
                  'Click Add Product (top-right) to open the product form. Fill in Name, Category, Price, and initial Stock quantity.',
                  'Product Code is optional but strongly recommended for barcode scanning at the POS — when you scan a code the POS adds the item with zero clicks.',
                  'Product codes must be globally unique. The API will reject a duplicate and return a clear error.',
                  'Upload a product image (up to 4 MB, any common format). Images are resized server-side; the storefront always serves the optimised version.',
                  'The Description field supports plain text and displays on the storefront product detail page.',
                  'Shelving fields (Aisle, Rack, Bin) help pickers locate items on the warehouse floor. Use the free-text Location field for any overflow notes.',
                  'Save — stock and pricing sync to the POS terminal and storefront immediately, with no cache to clear.',
                ]}
              />
              <Callout type="warning">
                Avoid deleting products that have open, processing, or fulfilment-pending orders. Those order lines will appear as "missing item" and
                break the picker workflow. Instead set stock to 0 so the item is blocked at checkout, then deactivate or hide it from the storefront.
              </Callout>
              <Callout type="tip">
                Use the search and category filter at the top of the Catalog to find a product quickly before editing. Sorting by Stock helps spot items
                that are running low before they hit zero.
              </Callout>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Bulk shelving</h3>
              <StepList
                items={[
                  'Switch to the Bulk Shelving tab inside Inventory Hub.',
                  'Use the Category dropdown to narrow the product list, or manually check individual rows.',
                  'Enter target values for Aisle, Rack, and Bin — you can set any combination; fields left blank are left unchanged on those rows.',
                  'Click Apply. Only selected rows are updated; all other products remain as-is.',
                  'Verify results by switching back to the Catalog tab and sorting by Aisle.',
                ]}
              />
              <Callout type="tip">
                Run bulk shelving per-category (e.g. "Beverages", then "Dairy") to avoid accidentally overwriting locations in unrelated aisles.
                It is faster and safer than selecting the entire catalog at once.
              </Callout>
              <HelpScreenshot file="inventory-catalog.png" title="Inventory Hub — Product Catalog" urlBar="…/catalog">
                <MockSidebar activeLabel="Inventory" />
                <div className="help-mock-main">
                  <div className="help-mock-h1" />
                  <MockTabs labels={['Product Catalog', 'Bulk shelving']} activeIndex={0} />
                  <MockCard>
                    <MockTable rows={4} />
                  </MockCard>
                </div>
              </HelpScreenshot>
              <HelpScreenshot file="inventory-bulk.png" title="Inventory Hub — Bulk shelving" urlBar="…/catalog (Bulk tab)">
                <MockSidebar activeLabel="Inventory" />
                <div className="help-mock-main">
                  <MockTabs labels={['Product Catalog', 'Bulk shelving']} activeIndex={1} />
                  <MockCard>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div style={{ height: 28, borderRadius: 8, background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)' }} />
                      <div style={{ height: 28, borderRadius: 8, background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)' }} />
                      <div style={{ height: 28, borderRadius: 8, background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)' }} />
                    </div>
                    <MockTable rows={3} />
                  </MockCard>
                </div>
              </HelpScreenshot>
            </Section>
          )}

          {!isMarketing && (
            <Section id="sales" icon={<ShoppingCart size={22} />} title="Sales & fulfillment">
              <p className="help-lead">
                Sales &amp; Fulfillment is the nerve centre for everything that happens after a customer clicks <em>Buy</em>.
                It covers online <strong>order management</strong>, <strong>online returns</strong>, and the <strong>abandoned cart</strong> recovery list.
                Pickers see a focused queue showing only their relevant tasks.
              </p>
              <JumpLink to="/sales">Open Sales &amp; Fulfillment</JumpLink>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Order lifecycle</h3>
              <StepList
                items={[
                  'New orders arrive with status Pending. Move them to Processing once picking and packing begins.',
                  'When packed and ready, set status to Shipped (delivery) or Ready for Pickup depending on how the customer chose to receive it.',
                  'For pickup orders, confirm collection by marking the order Completed — inventory was already reserved at purchase time.',
                  'If a customer cancels before shipping, use Cancel Order — the reserved inventory is released back to stock automatically.',
                  'Filter by status, date range, or customer name to manage high-volume queues efficiently.',
                  'Order notes entered by the customer (e.g. delivery instructions) appear on the order detail row.',
                ]}
              />
              <Callout type="note">
                Pickers only see orders in Pending or Processing states and can only update fulfillment status. They cannot edit financial data, customer details, or cancel orders.
              </Callout>
              <Callout type="tip">
                Process orders in batches by status: work through all Pending → Processing first, then all Processing → Shipped. This keeps the queue clean and reduces context-switching.
              </Callout>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Online returns</h3>
              <StepList
                items={[
                  'Open the Returns tab. Search by order ID (e.g. ORD-128) or by customer email.',
                  'Select the order. The panel displays all line items in a multi-item returns table showing purchased quantities and what has already been returned.',
                  'Check the box next to each item you want to return, and specify the exact return quantity (bounded by the max returnable limit). You can select and process multiple different items in a single action.',
                  'Provide a return reason (e.g. "Wrong item", "Defective") — this is saved in the audit log and is useful for supplier claims.',
                  'Click Process Return. The product stock counts for all selected items increase immediately, a transaction-safe database update processes the batch, and return events are logged.',
                  'Once the return is processed, issue a consolidated refund (either through Paystack or Cash) using the calculated total return value. The system bundles multiple returns to issue one clean refund, preventing extra gateway transaction fees and customer statement clutter.',
                ]}
              />
              <Callout type="warning">
                Online returns (Sales → Returns) and POS in-store returns (POS → Return 48h) are completely separate flows with different inventory reconciliation logic. Never process an in-store POS receipt through the online returns tab — use the POS mode instead.
              </Callout>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Abandoned carts</h3>
              <StepList
                items={[
                  'The Abandoned tab shows carts where the customer added items but never completed checkout.',
                  'Review the cart contents and customer contact info. Use this data to plan targeted marketing follow-ups.',
                  'Recovered carts (customer later completed the same order) are marked with a distinct status so you can track recovery rate over time.',
                ]}
              />
              <Callout type="tip">
                Pair the abandoned cart list with a targeted coupon broadcast in Marketing &amp; Growth — send a short-lived discount code to customers with abandoned carts from the past 7 days for a quick recovery boost.
              </Callout>
              <HelpScreenshot file="sales-orders.png" title="Sales — Orders" urlBar="…/sales">
                <MockSidebar activeLabel="Sales" />
                <div className="help-mock-main">
                  <MockTabs labels={['Active Orders', 'Returns', 'Abandoned']} activeIndex={0} />
                  <MockCard>
                    <MockTable rows={5} />
                  </MockCard>
                </div>
              </HelpScreenshot>
              <HelpScreenshot file="sales-returns.png" title="Sales — Returns" urlBar="…/sales (Returns)">
                <MockSidebar activeLabel="Sales" />
                <div className="help-mock-main">
                  <MockTabs labels={['Active Orders', 'Returns', 'Abandoned']} activeIndex={1} />
                  <MockCard>
                    <div style={{ height: 36, borderRadius: 8, background: 'var(--bg-surface-secondary)', marginBottom: 10 }} />
                    <MockTable rows={3} />
                  </MockCard>
                </div>
              </HelpScreenshot>
            </Section>
          )}

          {!isMarketing && !isAccountant && !isPicker && (
            <Section id="pos" icon={<Zap size={22} />} title="POS checkout & in-store returns">
              <p className="help-lead">
                The POS terminal is designed for speed — walk-in transactions from search to receipt in under 30 seconds.
                It runs in two modes: <strong>Sale</strong> (ringing up new walk-in purchases) and{' '}
                <strong>Return&nbsp;(48h)</strong> (reversing a POS sale within the 48-hour return window).
              </p>
              <JumpLink to="/pos">Open POS</JumpLink>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Running a sale</h3>
              <StepList
                items={[
                  'The search bar receives focus automatically on page load. Start typing a product name or scan a barcode — exact barcode matches auto-add the item to the cart instantly with no click needed.',
                  'Click any search result to add it. Use the + / − buttons to adjust quantity; the POS will not allow you to exceed the current stock level.',
                  'If a product appears in search results but has stock = 0, it is blocked from being added. Restock it through Inventory Hub first.',
                  'Choose payment method: Cash or MoMo (Mobile Money). This is recorded on the receipt and the order record.',
                  'Customer email is optional. Entering it lets you email a digital receipt after payment — useful for warranty and future return reference.',
                  'Press Process Payment. The system creates an order record, decrements stock, and shows the Transaction Complete screen.',
                  'From the success screen: click Print to send to a connected receipt printer via the browser print dialog, or click Email to dispatch an email receipt on the spot.',
                ]}
              />
              <Callout type="tip">
                Connect a USB barcode scanner to the workstation running the admin panel. When the scanner fires, it types the product code into the search field
                and the POS auto-adds the matching item — zero mouse interaction needed for any standard SKU with a code set in the catalog.
              </Callout>
              <Callout type="note">
                The POS shows a live READY indicator while the inventory feed is loaded. If it shows a yellow or red state, reload the page — the cart will not accept items until the feed is healthy.
              </Callout>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>In-store returns (48-hour window)</h3>
              <StepList
                items={[
                  'Click the Return (48h) tab in the top-right mode switcher.',
                  'Enter the order number printed on the customer receipt (e.g. ORD-128 or just 128) and click Load.',
                  'The system fetches every line item from that POS order and shows: product name, units sold, units already returned, and the maximum returnable quantity.',
                  'The remaining time in the 48-hour window is displayed prominently (e.g. "~36.4h left"). If it has expired, the Load fails with a clear message — escalate to management for a manual adjustment.',
                  'Enter return quantities for each line. Partial returns are allowed — returning 1 of 3 units on a single line is valid; the remaining 2 units stay on the original order.',
                  'Optionally enter a return reason (e.g. "Wrong item", "Defective") — stored in the audit log and attached to the return record.',
                  'Click Confirm Return & Restock. Stock increases immediately, the return is logged, and the cash/MoMo refund should be processed at the counter.',
                ]}
              />
              <Callout type="warning">
                The 48-hour clock starts from the original <em>transaction time</em>, not the date of purchase. A sale completed at 23:00 can only be
                reversed at the POS until 23:00 two days later, regardless of when the store opens the next morning.
              </Callout>
              <Callout type="warning">
                Online orders placed through the storefront are <strong>not</strong> eligible for POS returns. Use Sales → Returns for those — the workflow,
                refund logic, and inventory reconciliation are entirely different.
              </Callout>
              <HelpScreenshot file="pos-sale.png" title="POS — Sale mode" urlBar="…/pos">
                <MockSidebar activeLabel="POS" />
                <div className="help-mock-main">
                  <div className="help-mock-tabs" style={{ marginBottom: 8 }}>
                    <span className="is-active">Sale</span>
                    <span>Return (48h)</span>
                  </div>
                  <MockCard>
                    <MockPOSCart />
                  </MockCard>
                </div>
              </HelpScreenshot>
              <HelpScreenshot file="pos-return.png" title="POS — Return mode" urlBar="…/pos">
                <MockSidebar activeLabel="POS" />
                <div className="help-mock-main">
                  <div className="help-mock-tabs" style={{ marginBottom: 8 }}>
                    <span>Sale</span>
                    <span className="is-active">Return (48h)</span>
                  </div>
                  <MockCard>
                    <div style={{ height: 32, borderRadius: 8, background: 'var(--bg-surface-secondary)', marginBottom: 10 }} />
                    <MockTable rows={3} />
                  </MockCard>
                </div>
              </HelpScreenshot>
            </Section>
          )}

          {!isPicker && (!isAccountant || !isMarketing) && (
            <Section id="marketing" icon={<Megaphone size={22} />} title="Marketing & growth">
              <p className="help-lead">
                Marketing &amp; Growth groups all customer-facing promotional tools: <strong>Coupons</strong>,
                the storefront <strong>Hero Slider</strong>, product <strong>Reviews</strong> moderation,
                mass <strong>Broadcasts</strong> via email and/or SMS, and a <strong>Delivery Analytics</strong> tab for monitoring those sends.
              </p>
              <JumpLink to="/marketing">Open Marketing &amp; Growth</JumpLink>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Coupons</h3>
              <StepList
                items={[
                  'Create a coupon with a unique code, discount type (percentage off the order total, or a fixed GH₵ amount), and an optional minimum order value threshold.',
                  'Set start and end dates to automatically activate and expire the coupon — no manual toggle needed at midnight.',
                  'Usage limit caps how many orders can redeem the code across all customers — ideal for flash sales with a fixed reward budget.',
                  'Enable One-time use per customer to prevent a single customer from stacking the discount on repeat orders.',
                  'Toggle Active to deactivate a coupon instantly. Any live checkout referencing that code will be blocked the moment it is deactivated.',
                ]}
              />
              <Callout type="tip">
                Pair an abandoned cart review (Sales → Abandoned tab) with a short-lifespan coupon (e.g. 24-hour validity, 10% off) sent via SMS broadcast to those customers. This combination is one of the most effective cart recovery strategies.
              </Callout>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Broadcasts</h3>
              <StepList
                items={[
                  'Open the Broadcasts tab. Write a subject line (used for email only) and the message body.',
                  'Select your channel: Email, SMS, or both simultaneously. Both channels are dispatched in the same send action.',
                  'Choose your audience by role segment (e.g. all store customers, all staff, or a specific role like "marketing").',
                  'Click Send Broadcast. Small lists send immediately; large audiences are queued in the background so the page does not time out.',
                  'Switch to the Delivery Analytics tab to track the send — you will see totals for sent, failed, and pending jobs broken down by channel and role.',
                  'Admins and super users can retry individual failed jobs or bulk-retry all failures from within Delivery Analytics.',
                ]}
              />
              <Callout type="warning">
                SMS messages carry a per-unit cost billed through your provider. Always double-check the audience segment before hitting Send — a mistargeted mass SMS cannot be recalled.
              </Callout>
              <Callout type="note">
                Broadcast emails share the same delivery queue as transactional emails (order confirmations, receipts). If a broadcast appears stuck, open the Email Engine dashboard to check queue health and retry any failed jobs.
              </Callout>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Hero Slider &amp; Reviews</h3>
              <StepList
                items={[
                  'Hero Slider: add, reorder, or remove the promotional banner slides shown at the top of the storefront homepage. All changes go live immediately — no deploy required.',
                  'Each slide supports a title, subtitle, call-to-action link, and a background image. The recommended image ratio is 16:9 at a minimum of 1200 px wide for sharp rendering on all screens.',
                  'Drag-and-drop the slide order to control which banner appears first. The slider auto-advances through slides in order.',
                  'Reviews: view customer reviews for all products. Approve reviews to publish them on the storefront, or hide/flag reviews that violate store policy — hidden reviews remain in the admin for audit purposes.',
                ]}
              />
              <Callout type="tip">
                Coordinate new slider banners with your broadcast calendar. Launch the banner first so customers who click through the SMS/email link land on a page that already matches the campaign creative.
              </Callout>
              <HelpScreenshot file="marketing-broadcast.png" title="Marketing — Broadcasts" urlBar="…/marketing">
                <MockSidebar activeLabel="Marketing" />
                <div className="help-mock-main">
                  <MockTabs labels={['Coupons', 'Broadcasts', 'Delivery analytics']} activeIndex={1} />
                  <MockCard>
                    <div style={{ height: 64, borderRadius: 8, background: 'var(--bg-surface-secondary)', marginBottom: 8 }} />
                    <div className="help-mock-btn-lg" style={{ opacity: 0.6 }}>Send broadcast</div>
                  </MockCard>
                </div>
              </HelpScreenshot>
              <HelpScreenshot file="marketing-analytics.png" title="Marketing — Delivery analytics" urlBar="…/marketing">
                <MockSidebar activeLabel="Marketing" />
                <div className="help-mock-main">
                  <MockTabs labels={['Coupons', 'Broadcasts', 'Delivery analytics']} activeIndex={2} />
                  <MockCard>
                    <MockTable rows={4} />
                  </MockCard>
                </div>
              </HelpScreenshot>
            </Section>
          )}

          {!isMarketing && !isPicker && (
            <Section id="customers" icon={<Users size={22} />} title="Customers">
              <p className="help-lead">
                The Customers section gives you a full view of every registered storefront account. Search by name or
                email, review account details, and manage roles where your permission level allows.
              </p>
              <JumpLink to="/customers">Open Customers</JumpLink>
              <StepList
                items={[
                  'Use the search bar at the top to filter by customer name or email address — results update as you type.',
                  'Click a customer row to expand their profile: registration date, order history summary, and current account status.',
                  'Admins and super users can change a customer account role or mark an account as inactive if needed.',
                  'Accountants see this list as a Billing List — useful for cross-referencing order totals against customer profiles.',
                  'Role changes take effect immediately on next login for the affected user.',
                ]}
              />
              <Callout type="warning">
                Role changes are irreversible without a second change. Double-check before promoting any account — especially to admin or store manager level, as those roles unlock sensitive data and bulk operations.
              </Callout>
              <Callout type="tip">
                Use the customer list as a sanity check when investigating a reported order issue — search by email to pull up the exact account and confirm the order is associated correctly.
              </Callout>
              <HelpScreenshot file="customers.png" title="Customers" urlBar="…/customers">
                <MockSidebar activeLabel="Customers" />
                <div className="help-mock-main">
                  <div className="help-mock-h1" />
                  <MockCard>
                    <MockTable rows={5} />
                  </MockCard>
                </div>
              </HelpScreenshot>
            </Section>
          )}

          {!isAccountant && (
            <Section id="staffhub" icon={<MessageSquare size={22} />} title="Staff Hub">
              <p className="help-lead">
                <strong>Staff Hub</strong> is the internal real-time communication tool for your team. It has a shared
                <strong> Global Staff Channel</strong> (visible to everyone) and private{' '}
                <strong>one-to-one direct message threads</strong> with any individual colleague.
              </p>
              <JumpLink to="/staff-chat">Open Staff Hub</JumpLink>
              <StepList
                items={[
                  'The left-side panel lists the Global Channel at the top, followed by all staff members. Click any name to open a private DM thread.',
                  'Type your message in the input bar and press Enter (or Shift+Enter for a new line without sending).',
                  'Attach images, PDFs, or Word documents (max 5 MB) using the paperclip icon — a preview appears above the input bar before you send.',
                  'Reply to any specific message by hovering over it and clicking the Reply button. The quoted message context appears in your input so recipients know exactly what is being addressed.',
                  'Admins and managers can pin messages in the Global Channel — pinned messages are always visible in the highlighted announcement banner at the top of the channel.',
                  'To unpin, click the Unpin button on the pinned message in the banner (admin/manager only).',
                  'Before sending to the Global Channel, admins/managers can toggle Pin this message, Send via email, or Send via SMS to simultaneously cross-post the announcement.',
                  'Super admins can open the Maintenance panel (top-right settings icon) to view message volume statistics and run cleanup operations on old messages.',
                ]}
              />
              <Callout type="tip">
                Use pinned Global Channel messages for shift-critical announcements — e.g. "POS system slow: use manual entry today" or "New product line added to catalog". All staff see it the moment they open Staff Hub.
              </Callout>
              <Callout type="note">
                Staff Hub polls for new messages every 5 seconds while the tab is active. If a colleague says they sent a message you are not seeing, do a manual refresh of the page to force an immediate sync.
              </Callout>
              <Callout type="warning">
                Messages sent via email or SMS cross-post from the Global Channel incur provider costs (for SMS) and cannot be recalled once sent. Use those options deliberately, not as a default.
              </Callout>
              <HelpScreenshot file="staffhub.png" title="Staff Hub" urlBar="…/staff-chat">
                <MockSidebar activeLabel="Staff Hub" />
                <div className="help-mock-main">
                  <div style={{ display: 'flex', gap: 8, height: '100%' }}>
                    <div style={{ width: 100, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[1, 2, 3, 4].map((k) => (
                        <div key={k} style={{ height: 24, borderRadius: 8, background: k === 1 ? 'rgba(var(--accent-blue-rgb),0.18)' : 'var(--bg-surface-secondary)' }} />
                      ))}
                    </div>
                    <MockCard style={{ flex: 1 }}>
                      <MockTable rows={4} />
                      <div style={{ height: 32, borderRadius: 10, background: 'var(--bg-surface-secondary)', marginTop: 8 }} />
                    </MockCard>
                  </div>
                </div>
              </HelpScreenshot>
            </Section>
          )}

          {isManager && (
            <Section id="cms" icon={<FileText size={22} />} title="Content Management (CMS)">
              <p className="help-lead">
                <strong>Content Management</strong> gives you control over the storefront's legal policies, About Us page, and FAQs. It uses a "Smart Parser" that automatically turns your edited text into premium, grid-based layout cards on the storefront.
              </p>
              <JumpLink to="/cms">Open Content Manager</JumpLink>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Managing policies & pages</h3>
              <StepList
                items={[
                  'Select a page from the dropdown menu (e.g., Privacy Policy, About Us, FAQ).',
                  'Use the rich-text editor to modify content. To create a new "Card" on the storefront, simply use a Level 2 Header (H2) for the title.',
                  'The system automatically detects your headers and splits the content into separate, beautifully styled grid cards.',
                  'Icons are automatically mapped based on your titles (e.g., a section called "Shipping" will automatically get a Truck icon).',
                  'Click Save Changes. Updates reflect on the storefront immediately across all policy-related routes.',
                ]}
              />
              <Callout type="tip">
                Always use standard headers (H2) for your section titles. This ensures the storefront can correctly segment your content into the premium "Frosted Glass" grid layout. If you don't use headers, all text will be lumped into a single large card.
              </Callout>
              <Callout type="note">
                The **About Us** and **FAQ** pages are now fully dynamic. Any changes you make here will instantly update the storefront navigation and content, allowing for zero-code site updates.
              </Callout>
              <HelpScreenshot file="cms-manager.png" title="Content Management" urlBar="…/cms">
                <MockSidebar activeLabel="Content Manager" />
                <div className="help-mock-main">
                  <div className="help-mock-h1" />
                  <MockCard>
                    <div style={{ height: 32, borderRadius: 8, background: 'var(--bg-surface-secondary)', marginBottom: 12 }} />
                    <div style={{ height: 120, borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-main)' }} />
                  </MockCard>
                </div>
              </HelpScreenshot>
            </Section>
          )}


          <Section id="alerts" icon={<Bell size={22} />} title="System alerts">
            <p className="help-lead">
              System Alerts is the centralised notification feed for the entire admin panel. It captures security events,
              low-stock triggers, POS activity, order status changes, and any background job warnings.
            </p>
            <JumpLink to="/notifications">Open System Alerts</JumpLink>
            <StepList
              items={[
                'Unread alerts are highlighted — work through them top-to-bottom at the start of each shift to catch overnight issues quickly.',
                'Use the type filter to narrow by category: security, inventory, sales, system, or marketing.',
                'Click Mark as read on each alert after you have triaged it — this keeps the feed clean for other admins.',
                'Low-stock alerts fire when a product stock level drops below its configured threshold — follow up in Inventory Hub to restock or hide the item.',
                'POS events (completed sales, POS returns) create entries here for admins as an audit trail.',
                'Security alerts (e.g. repeated failed logins, unusual access patterns) should be escalated to your super admin immediately.',
              ]}
            />
            <Callout type="tip">
              Make reviewing System Alerts the first task of every shift, before processing orders or managing inventory. An unread low-stock or security alert can affect decisions across every other area of the panel.
            </Callout>
            <Callout type="warning">
              Security-type alerts are time-sensitive. If you see repeated failed login attempts for a staff account, notify your super admin to review and potentially disable that account in Admin Control.
            </Callout>
          </Section>

          {!isMarketing && (
            <Section id="settings" icon={<Settings size={22} />} title="Settings">
              <p className="help-lead">
                Settings controls the admin panel's own appearance and session behaviour. Changes here affect your current
                admin instance — for store-wide branding and storefront configuration, see Super Settings under Root Control.
              </p>
              <JumpLink to="/settings">Open Settings</JumpLink>
              <StepList
                items={[
                  'Appearance: toggle Dark Mode on or off to switch the entire panel between light and dark themes — preference is saved to your browser.',
                  'Primary Colour: choose a custom accent colour for buttons and highlights. The preview updates in real time before you save.',
                  'Font Family: select a preferred typeface for the panel UI. Changes apply immediately across all pages.',
                  'Session Timeout: set how many minutes of inactivity before you are automatically logged out. Shorter timeouts improve security on shared workstations.',
                  'Save your changes using the Save Settings button — unsaved changes are lost if you navigate away.',
                ]}
              />
              <Callout type="note">
                Settings here apply to your admin panel only, not the storefront. To change the storefront logo, site name, or customer-facing colours, go to Super Settings (super admin access required).
              </Callout>
              <Callout type="tip">
                On shared or public workstations, set the session timeout to 5–10 minutes. On dedicated personal machines, 60 minutes is a comfortable default that avoids constant re-logins during a shift.
              </Callout>
              <HelpScreenshot file="settings.png" title="Settings" urlBar="…/settings">
                <MockSidebar activeLabel="Settings" />
                <div className="help-mock-main">
                  <MockCard>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[1, 2, 3, 4].map((k) => (
                        <div key={k} style={{ height: 36, borderRadius: 8, background: 'var(--bg-surface-secondary)' }} />
                      ))}
                    </div>
                  </MockCard>
                </div>
              </HelpScreenshot>
            </Section>
          )}

          {isSuper && (
            <Section id="super" icon={<ShieldAlert size={22} />} title="Super admin (Root Control)">
              <p className="help-lead">
                Root Control is the super admin command centre. Every change here affects the <strong>entire store and all users</strong>.
                It covers the global analytics overview, staff account management, pickup location configuration, system logs, traffic monitoring, and site-wide settings.
              </p>
              <JumpLink to="/super/dashboard">Open Global Overview</JumpLink>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Root Control modules</h3>
              <StepList
                items={[
                  'Global Overview: a high-level dashboard showing store-wide revenue, order volume, user counts, and system health — the first stop for any morning review.',
                  'Admin Control: create new staff accounts, assign roles, reset passwords, or deactivate accounts for former staff. Role assignment takes effect immediately.',
                  'Pickup Locations: add, edit, or remove physical pickup points that customers can choose during checkout — changes reflect instantly on the storefront.',
                  'System Logs: a timestamped audit trail of all admin actions, API errors, and backend events. Use it to trace who changed what and when.',
                  'Traffic Control: monitor live request patterns, identify unusual spikes (potential scraping or DDoS), and manage IP-level blocks if needed.',
                  'Super Settings: configure storefront branding (logo, site name, primary colour), email provider credentials (SMTP/API keys), maintenance mode, and session policies.',
                ]}
              />
              <Callout type="warning">
                Enabling Maintenance Mode in Super Settings immediately locks out all non-super users from the admin panel and shows a maintenance message on the storefront. Always notify your team before activating it, and deactivate it as soon as the work is done.
              </Callout>
              <Callout type="warning">
                Disabling a staff account in Admin Control logs them out of all active sessions within minutes. Confirm with the relevant manager before deactivating any account that is mid-shift.
              </Callout>
              <Callout type="tip">
                Review System Logs weekly, not just during incidents. Catching an unusual pattern of 404 errors or repeated failed auth attempts early is far easier to address than investigating an incident retrospectively.
              </Callout>
              <HelpScreenshot file="super-root.png" title="Super — Global Overview" urlBar="…/super/dashboard">
                <MockSidebar activeLabel="Dashboard" />
                <div className="help-mock-main">
                  <div className="help-mock-h1" />
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-gold)', marginBottom: 8 }}>ROOT CONTROL</div>
                  <MockCard>
                    <MockStatRow />
                  </MockCard>
                </div>
              </HelpScreenshot>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
                <ExternalLink size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                For server health JSON, your team can use the API <code>status.php</code> (document separately for DevOps).
              </p>
            </Section>
          )}

          <Section id="new-features" icon={<Lightbulb size={22} />} title="New Features (Phases 3-6)">
            <p className="help-lead">
              Recent development phases have added powerful new features to both the admin panel and storefront. This section documents the key additions from Phases 3–6.
            </p>

            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Flash Sale Banner (Phase 5)</h3>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-main)' }}>
              Flash Sale Banners allow you to create time-limited promotional offers with live countdown timers on product cards. When a product has a <code>discount_percent</code> and <code>sale_ends_at</code> set, customers see an animated countdown badge showing how much time remains.
            </p>
            <StepList
              items={[
                'In Product Manager, set a discount percentage (e.g., 20 for 20% off) in the "Discount %" field.',
                'Set the "Sale Ends At" date and time. This is when the flash sale expires.',
                'Save the product. The storefront will automatically display a countdown badge on the product card.',
                'The countdown updates in real-time and disappears when the sale ends.',
                'Products with active flash sales are highlighted in the storefront with a special badge and urgency styling.',
              ]}
            />
            <Callout type="tip">
              Flash sales work best for limited-time promotions, clearance items, or seasonal offers. Set the end time strategically (e.g., midnight) to create urgency.
            </Callout>

            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Product Comparison (Phase 6)</h3>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-main)' }}>
              Product Comparison is a customer-facing feature that allows shoppers to compare up to 4 products side-by-side. Customers can add products to a comparison bar and view specs, prices, and features in a unified table.
            </p>
            <Callout type="note">
              This is a customer-facing feature with no admin configuration required. It is automatically available on the storefront for all products.
            </Callout>
            <StepList
              items={[
                'Customers click "Compare" on product cards to add them to the comparison bar (max 4 products).',
                'The comparison bar appears at the bottom of the screen, showing selected products.',
                'Clicking "Compare Now" opens a comparison modal with specs, prices, and features side-by-side.',
                'Customers can remove products from the comparison or clear all selections.',
                'The comparison feature helps customers make informed purchasing decisions.',
              ]}
            />

            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Push Notification Chime (Phase 3C)</h3>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-main)' }}>
              Push Notification Chime provides audio and desktop notifications for important events. When enabled, the browser plays a chime sound and shows a desktop notification for new orders, low-stock alerts, and other critical updates.
            </p>
            <StepList
              items={[
                'In your browser settings, grant permission for the site to send notifications.',
                'The admin panel will play a subtle chime sound when new orders arrive or low-stock alerts trigger.',
                'Desktop notifications appear even when the admin panel is in a background tab.',
                'Audio chime can be toggled on/off in Settings if needed.',
                'Notifications help staff stay aware of important events without constantly refreshing the page.',
              ]}
            />
            <Callout type="warning">
              Desktop notifications require browser permission. If users block notifications, the audio chime will still play, but desktop popups will not appear.
            </Callout>

            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-main)' }}>Advanced Filtering (Phase 3D)</h3>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-main)' }}>
              Advanced Filtering enhances the storefront product grid with powerful filtering options. Customers can filter by multiple categories simultaneously, set min/max price ranges, and toggle "In Stock Only" to see only available products.
            </p>
            <StepList
              items={[
                'Category filter: Customers can select multiple categories (e.g., "Optics" AND "Connectors") to see products matching all selections.',
                'Price range: Min and max price sliders allow customers to filter by budget.',
                'In Stock Only: Toggle shows only products with available stock, hiding out-of-stock items.',
                'Filters work together — customers can combine category, price, and stock filters simultaneously.',
                'Filter state persists during navigation, making it easy to refine searches.',
              ]}
            />
            <Callout type="tip">
              If customers call asking how to find specific products, guide them to use the Advanced Filtering panel. It's much more powerful than the basic search bar.
            </Callout>
          </Section>

        </div>
      </div>
    </div>
  );
}
