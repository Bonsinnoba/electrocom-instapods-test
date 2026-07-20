import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle, MessageCircle, Phone, Mail, ChevronDown,
  Headphones, Heart, Search, Clock, Zap, Shield,
  ArrowRight, CheckCircle, Send, User, FileText
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function Support({ searchQuery = '' }) {
  const [openIndex, setOpenIndex] = useState(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [formState, setFormState] = useState({ name: '', email: '', subject: '', message: '' });
  const [formSent, setFormSent] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const { siteSettings } = useSettings();

  const categories = [
    { id: 'all', label: 'All Topics' },
    { id: 'orders', label: 'Orders & Shipping' },
    { id: 'products', label: 'Products' },
    { id: 'returns', label: 'Returns & Refunds' },
    { id: 'account', label: 'Account' },
  ];

  const faqs = [
    { cat: 'orders', q: "How can I track my order?", a: "You can track your order in the Orders section of your dashboard. A tracking number is also sent via SMS or email once your package is dispatched." },
    { cat: 'products', q: "Are the electronic components genuine?", a: "Yes. All components are sourced from verified suppliers. Datasheets are available on request for ICs, transistors, and modules. Dead-on-arrival (DOA) items are replaced free of charge." },
    { cat: 'products', q: "Do you offer bulk pricing for schools or businesses?", a: `Yes! Email us at ${siteSettings.siteEmail} with your parts list and quantities. We offer competitive bulk discounts for institutions, universities, and engineering firms.` },
    { cat: 'returns', q: "What is your return policy for components?", a: "We accept returns for DOA or damaged-on-arrival components and unopened STEM kits within 14 days. You can easily select and request returns for multiple items from the same order at once directly through your dashboard's Return Manager. Opened component packs and ESD-damaged items are not eligible for return." },
    { cat: 'returns', q: "How do refunds work if I return multiple items?", a: "To optimize your audit trail and keep your statement clean, the platform consolidates refunds for multi-item returns. We process all returned items together and issue a single consolidated refund back to your original payment method (Paystack) or via cash." },
    { cat: 'products', q: "Do you provide datasheets or documentation?", a: "Yes. For most ICs, sensors, and modules we can provide the manufacturer datasheet on request. Contact us with the part number and we'll send it within 24 hours." },
    { cat: 'orders', q: "How do I cancel my order?", a: "Orders can be cancelled within 1 hour of placement by contacting our support team immediately. Orders already in processing cannot be cancelled." },
    { cat: 'products', q: "How do I compare products before buying?", a: "Click the 'Compare' button on any product card to add it to your comparison bar. You can compare up to 4 products side-by-side, viewing their specifications, prices, and features in a unified table." },
    { cat: 'products', q: "What do 'Only 3 left!' and 'Selling fast' mean?", a: "'Only X left!' indicates limited remaining stock, while 'Selling fast' shows items with high recent demand. Both labels help you make timely purchasing decisions." },
    { cat: 'orders', q: "How do I use a promo code?", a: "During checkout, you'll find a promo code field in the order summary section. Enter your flash sale code and click 'Apply'. The discount will be instantly reflected in your total." },
    { cat: 'orders', q: "Can I track my order in real time?", a: "Yes! Visit the Orders page in your dashboard to see a live timeline of your order status, with real-time updates as your order progresses through fulfillment." },
    { cat: 'account', q: "How do I update my account information?", a: "Go to the Profile section from the sidebar to update your personal details, delivery addresses, and notification preferences at any time." },
  ];

  const effectiveSearch = localSearch || searchQuery;

  const filteredFaqs = faqs.filter(f => {
    const matchCat = activeCategory === 'all' || f.cat === activeCategory;
    const matchSearch = !effectiveSearch ||
      f.q.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      f.a.toLowerCase().includes(effectiveSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormSent(true);
    setTimeout(() => setFormSent(false), 4000);
    setFormState({ name: '', email: '', subject: '', message: '' });
  };

  const stats = [
    { icon: <Clock size={20} />, label: 'Avg. Response', value: '< 2 hrs' },
    { icon: <Zap size={20} />, label: 'Satisfaction Rate', value: '98%' },
    { icon: <Shield size={20} />, label: 'Days DOA Coverage', value: '14' },
    { icon: <CheckCircle size={20} />, label: 'Issues Resolved', value: '2,400+' },
  ];

  return (
    <div className="support-page">

      {/* ── Hero Banner ── */}
      <div className="support-hero">
        <div className="support-hero-glow" />
        <div className="support-hero-content">
          <div className="support-hero-badge">
            <Headphones size={14} />
            <span>Support Center</span>
          </div>
          <h1 className="support-hero-title">How can we help?</h1>
          <p className="support-hero-sub">
            Dedicated support for {siteSettings.siteName} — get answers, reach our team, or send us a message.
          </p>

          {/* Inline search */}
          <div className="support-search-wrap">
            <Search size={18} className="support-search-icon" />
            <input
              id="support-search"
              type="text"
              className="support-search-input"
              placeholder="Search FAQs…"
              value={localSearch}
              onChange={e => { setLocalSearch(e.target.value); setOpenIndex(null); }}
            />
            {localSearch && (
              <button
                className="support-search-clear"
                onClick={() => setLocalSearch('')}
                aria-label="Clear search"
              >×</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="support-stats-strip">
        {stats.map((s, i) => (
          <div key={i} className="support-stat">
            <div className="support-stat-icon">{s.icon}</div>
            <div>
              <div className="support-stat-value">{s.value}</div>
              <div className="support-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FAQ Section ── */}
      <section className="support-section">
        <div className="support-section-header">
          <div className="support-section-icon-wrap" style={{ background: 'var(--info-bg)', color: 'var(--primary-blue)' }}>
            <HelpCircle size={22} />
          </div>
          <div>
            <h2 className="support-section-title">Frequently Asked Questions</h2>
            <p className="support-section-sub">Quick answers to common questions</p>
          </div>
        </div>

        {/* Category pills */}
        <div className="support-category-pills">
          {categories.map(c => (
            <button
              key={c.id}
              className={`support-pill ${activeCategory === c.id ? 'active' : ''}`}
              onClick={() => { setActiveCategory(c.id); setOpenIndex(null); }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* FAQ list */}
        <div className="support-faq-list">
          {filteredFaqs.length > 0 ? filteredFaqs.map((item, i) => (
            <FAQItem
              key={`${item.cat}-${i}`}
              item={item}
              index={i}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          )) : (
            <div className="support-empty">
              <HelpCircle size={40} />
              <p>No results for <strong>"{effectiveSearch}"</strong></p>
              <button className="support-pill active" onClick={() => { setLocalSearch(''); setActiveCategory('all'); }}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Contact Channels + Message Form ── */}
      <section className="support-section">
        <div className="support-section-header">
          <div className="support-section-icon-wrap" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <MessageCircle size={22} />
          </div>
          <div>
            <h2 className="support-section-title">Get in Touch</h2>
            <p className="support-section-sub">Choose the channel that works best for you</p>
          </div>
        </div>

        <div className="support-contact-grid">

          {/* ── Contact cards column ── */}
          <div className="support-contact-cards">
            {/* Phone */}
            <ContactCard
              iconBg="var(--info-bg)"
              iconColor="var(--primary-blue)"
              icon={<Phone size={24} />}
              title="Call Us"
              desc="Voice support available Mon–Sat, 9 am – 6 pm"
              badge="Live"
              badgeColor="success"
            >
              <a href={`tel:${siteSettings.phone1}`} className="support-cta-link" id="support-call-1">
                <Phone size={15} /> {siteSettings.phone1}
              </a>
              {siteSettings.phone2 && (
                <a href={`tel:${siteSettings.phone2}`} className="support-cta-link secondary" id="support-call-2">
                  <Phone size={15} /> {siteSettings.phone2}
                </a>
              )}
            </ContactCard>

            {/* WhatsApp */}
            <ContactCard
              iconBg="var(--success-bg)"
              iconColor="var(--success)"
              icon={<MessageCircle size={24} />}
              title="WhatsApp"
              desc="Fast replies and image sharing for component questions"
              badge="Fastest"
              badgeColor="success"
            >
              <a
                href={`https://wa.me/${siteSettings.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="support-cta-link whatsapp"
                id="support-whatsapp"
              >
                <MessageCircle size={15} /> Chat on WhatsApp <ArrowRight size={14} />
              </a>
            </ContactCard>

            {/* Email */}
            <ContactCard
              iconBg="var(--danger-bg)"
              iconColor="var(--danger)"
              icon={<Mail size={24} />}
              title="Email"
              desc="For detailed queries, bulk orders, or documentation requests"
              badge="24 hr"
              badgeColor="warning"
            >
              <a href={`mailto:${siteSettings.siteEmail}`} className="support-cta-link" id="support-email">
                <Mail size={15} /> {siteSettings.siteEmail}
              </a>
            </ContactCard>
          </div>

          {/* ── Message form ── */}
          <div className="support-form-wrap glass">
            <div className="support-form-header">
              <div className="support-section-icon-wrap" style={{ background: 'var(--info-bg)', color: 'var(--primary-blue)', width: 40, height: 40 }}>
                <Send size={18} />
              </div>
              <div>
                <h3 className="support-form-title">Send a Message</h3>
                <p className="support-form-sub">We'll reply within 2 business hours</p>
              </div>
            </div>

            {formSent ? (
              <div className="support-form-success">
                <div className="support-form-success-icon">
                  <CheckCircle size={36} />
                </div>
                <strong>Message sent!</strong>
                <p>Our team will get back to you shortly.</p>
              </div>
            ) : (
              <form className="support-form" onSubmit={handleFormSubmit} id="support-contact-form">
                <div className="support-form-row">
                  <div className="support-form-field">
                    <label htmlFor="sf-name"><User size={13} /> Your Name</label>
                    <input
                      id="sf-name"
                      type="text"
                      placeholder="John Adeyemi"
                      required
                      value={formState.name}
                      onChange={e => setFormState(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="support-form-field">
                    <label htmlFor="sf-email"><Mail size={13} /> Email Address</label>
                    <input
                      id="sf-email"
                      type="email"
                      placeholder="john@example.com"
                      required
                      value={formState.email}
                      onChange={e => setFormState(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="support-form-field">
                  <label htmlFor="sf-subject"><FileText size={13} /> Subject</label>
                  <input
                    id="sf-subject"
                    type="text"
                    placeholder="Order #1234 — missing item"
                    required
                    value={formState.subject}
                    onChange={e => setFormState(p => ({ ...p, subject: e.target.value }))}
                  />
                </div>
                <div className="support-form-field">
                  <label htmlFor="sf-message"><MessageCircle size={13} /> Message</label>
                  <textarea
                    id="sf-message"
                    rows={5}
                    placeholder="Describe your issue in detail…"
                    required
                    value={formState.message}
                    onChange={e => setFormState(p => ({ ...p, message: e.target.value }))}
                  />
                </div>
                <button type="submit" className="support-form-submit" id="support-form-submit-btn">
                  <Send size={16} /> Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer love note ── */}
      <div className="support-footer-note">
        <Heart size={18} fill="var(--primary-blue)" color="var(--primary-blue)" />
        <p>
          <strong>We're here for you.</strong> {siteSettings.siteName} is community-driven and always ready to help our makers, engineers, and educators succeed.
        </p>
      </div>
    </div>
  );
}

/* ── FAQ Item Component ── */
function FAQItem({ item, index, isOpen, onToggle }) {
  const bodyRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (bodyRef.current) {
      setHeight(isOpen ? bodyRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div
      className={`support-faq-item ${isOpen ? 'open' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      id={`faq-item-${index}`}
      aria-expanded={isOpen}
    >
      <div className="support-faq-question">
        <span>{item.q}</span>
        <div className={`support-faq-chevron ${isOpen ? 'open' : ''}`}>
          <ChevronDown size={18} />
        </div>
      </div>
      <div
        className="support-faq-body"
        style={{ maxHeight: height }}
        ref={bodyRef}
        aria-hidden={!isOpen}
      >
        <p className="support-faq-answer">{item.a}</p>
      </div>
    </div>
  );
}

/* ── Contact Card Component ── */
function ContactCard({ icon, iconBg, iconColor, title, desc, badge, badgeColor, children }) {
  return (
    <div className="support-contact-card glass">
      <div className="support-contact-card-top">
        <div className="support-contact-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div className="support-contact-title-row">
            <span className="support-contact-title">{title}</span>
            {badge && (
              <span className={`support-contact-badge ${badgeColor}`}>{badge}</span>
            )}
          </div>
          <p className="support-contact-desc">{desc}</p>
        </div>
      </div>
      <div className="support-contact-actions">
        {children}
      </div>
    </div>
  );
}
