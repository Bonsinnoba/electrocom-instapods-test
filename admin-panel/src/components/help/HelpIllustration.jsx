import React, { useState } from 'react';
import './HelpIllustration.css';

/**
 * Browser-style window chrome; shows optional screenshot from /help/*.png if present.
 */
export function HelpScreenshot({ file, title, urlBar, children }) {
  const src = file ? `/help/${file}` : null;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const showImage = src && loaded && !failed;
  const tryImage = Boolean(src);

  return (
    <figure className="help-illustration">
      <div className="help-browser">
        <div className="help-browser-titlebar">
          <span className="help-browser-dots" aria-hidden>
            <i /><i /><i />
          </span>
          <span className="help-browser-title">{title || 'ElectrCom Admin'}</span>
        </div>
        <div className="help-browser-chrome">
          <div className="help-browser-url">
            <span className="help-browser-lock" aria-hidden>🔒</span>
            <span className="help-browser-url-text">{urlBar || 'admin.yourstore.com'}</span>
          </div>
        </div>
        <div className="help-browser-body">
          {tryImage && (
            <img
              className={`help-screenshot-img${showImage ? ' is-visible' : ''}`}
              src={src}
              alt=""
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
            />
          )}
          <div className={`help-mock-wrap${showImage ? ' is-hidden' : ''}`}>{children}</div>
        </div>
      </div>
      {file && (
        <figcaption className="help-illustration-caption">
          {showImage
            ? 'Screenshot from your team (public/help folder).'
            : 'Illustrated preview — add ' + file + ' under public/help/ to use your own screenshot.'}
        </figcaption>
      )}
    </figure>
  );
}

export function MockSidebar({ activeLabel }) {
  const items = ['Dashboard', 'Inventory', 'Sales', 'POS', 'Customers', 'Marketing', 'Alerts', 'Settings'];
  return (
    <div className="help-mock-sidebar">
      <div className="help-mock-logo" />
      {items.map((label) => (
        <div
          key={label}
          className={`help-mock-nav${label === activeLabel ? ' is-active' : ''}`}
        >
          <span className="help-mock-nav-ic" />
          {label}
        </div>
      ))}
    </div>
  );
}

export function MockCard({ children, className = '' }) {
  return <div className={`help-mock-card ${className}`.trim()}>{children}</div>;
}

export function MockStatRow() {
  return (
    <div className="help-mock-stats">
      {[1, 2, 3].map((k) => (
        <div key={k} className="help-mock-stat">
          <div className="help-mock-stat-label" />
          <div className="help-mock-stat-value" />
        </div>
      ))}
    </div>
  );
}

export function MockTable({ rows = 4 }) {
  return (
    <div className="help-mock-table">
      <div className="help-mock-tr help-mock-th">
        <span>Item</span>
        <span>Qty</span>
        <span>Status</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="help-mock-tr">
          <span className="help-mock-pill" />
          <span className="help-mock-num" />
          <span className="help-mock-badge" />
        </div>
      ))}
    </div>
  );
}

export function MockTabs({ labels, activeIndex = 0 }) {
  return (
    <div className="help-mock-tabs">
      {labels.map((l, i) => (
        <span key={l} className={i === activeIndex ? 'is-active' : ''}>
          {l}
        </span>
      ))}
    </div>
  );
}

export function MockPOSCart() {
  return (
    <div className="help-mock-pos">
      <div className="help-mock-pos-search" />
      <MockTable rows={3} />
      <div className="help-mock-pos-total">
        <span>Total</span>
        <strong>GH₵ …</strong>
      </div>
      <div className="help-mock-btn-lg">Process payment</div>
    </div>
  );
}
