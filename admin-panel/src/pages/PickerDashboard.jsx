import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Package, Bell, ArrowRight } from 'lucide-react';
import { useAdminSettings } from '../context/AdminSettingsContext';

export default function PickerDashboard() {
  const { siteName } = useAdminSettings();
  const navigate = useNavigate();

  const tiles = [
    {
      title: 'Picker queue',
      detail: 'Open orders ready for picking and packing.',
      icon: <ClipboardList size={28} />,
      path: '/sales',
    },
    {
      title: 'System alerts',
      detail: 'Low stock and fulfillment notices.',
      icon: <Bell size={28} />,
      path: '/notifications',
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <header>
        <h1 style={{ fontSize: '34px', fontWeight: 900 }}>{siteName || 'Warehouse'}</h1>
        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
          Picker workspace — focused on fulfillment, not catalog or finance.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        {tiles.map((t) => (
          <button
            key={t.title}
            type="button"
            className="card glass"
            onClick={() => navigate(t.path)}
            style={{
              padding: '24px',
              textAlign: 'left',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ color: 'var(--primary-blue)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {t.icon}
              <ArrowRight size={18} color="var(--text-muted)" />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>{t.title}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.detail}</div>
          </button>
        ))}
      </div>

      <div className="card glass" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--text-muted)' }}>
        <Package size={22} color="var(--accent-gold)" />
        <div style={{ fontSize: '14px' }}>
          Product catalog and POS are hidden for your role. Use <strong style={{ color: 'var(--text-main)' }}>Sales &amp; Fulfillment</strong> for day-to-day picking.
        </div>
      </div>
    </div>
  );
}
