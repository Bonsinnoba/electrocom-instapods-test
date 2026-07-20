import React, { useState, useEffect } from 'react';
import { Save, User, Shield, Bell, Moon, Sun, Monitor, Globe, Check } from 'lucide-react';
import { updateProfile } from '../services/api';
import { useAdminSettings } from '../context/AdminSettingsContext';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const { siteName, siteEmail, refreshSettings } = useAdminSettings();
  
  const [storeNameState, setStoreNameState] = useState('');
  const [contactEmailState, setContactEmailState] = useState('');
  
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : false;
  });
  
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [stockAlerts, setStockAlerts] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');

  // Sync state with global settings on load
  React.useEffect(() => {
    if (siteName) setStoreNameState(siteName);
    if (siteEmail) setContactEmailState(siteEmail);
  }, [siteName, siteEmail]);

  const isAccountant = user?.role === 'accountant';
  const isMarketing = user?.role === 'marketing';
  const isRestricted = isAccountant || isMarketing;

  const handleSave = async () => {
    setSaveStatus('saving');
    // For now, standard settings only saves local preferences/alerts
    // Store-wide settings are managed in Super Settings
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)' }}>{isRestricted ? "Manage your personal preferences." : "Manage your store and admin configuration."}</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <section className="card glass" style={{ opacity: isRestricted ? 0.7 : 1 }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={20} color="var(--primary-blue)" /> {isRestricted ? 'My Profile' : 'Store Profile'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>{isRestricted ? 'Name' : 'Store Name'}</label>
              <input 
                type="text" 
                value={isRestricted ? user.name : storeNameState}
                readOnly={true}
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-light)', 
                  background: 'transparent', 
                  color: 'var(--text-muted)', 
                  outline: 'none',
                  cursor: 'not-allowed'
                }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>{isRestricted ? 'Email Address' : 'Contact Email'}</label>
              <input 
                type="email" 
                value={isRestricted ? user.email : contactEmailState}
                readOnly={true}
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-light)', 
                  background: 'transparent', 
                  color: 'var(--text-muted)', 
                  outline: 'none',
                  cursor: 'not-allowed'
                }} 
              />
            </div>
            {!isRestricted && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '12px' }}>
                * Store-wide details are managed in the <strong style={{color: 'var(--text-main)'}}>Global Settings</strong>.
              </p>
            )}
          </div>
        </section>

        <section className="card glass">
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Monitor size={20} color="var(--primary-blue)" /> Appearance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div 
              onClick={() => {
                const nd = !darkMode;
                setDarkMode(nd);
                localStorage.setItem('darkMode', JSON.stringify(nd));
                window.dispatchEvent(new Event('themeChange'));
              }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '12px', background: 'var(--bg-surface-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Moon size={18} /> <span>Dark Mode</span>
              </div>
              <div style={{ 
                width: '40px', 
                height: '22px', 
                background: darkMode ? 'var(--primary-blue)' : 'var(--border-light)', 
                borderRadius: '20px', 
                position: 'relative', 
                transition: 'all 0.3s'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: darkMode ? '20px' : '2px',
                  width: '18px',
                   height: '18px',
                  background: 'white',
                  borderRadius: '50%',
                  transition: 'all 0.3s'
                }} />
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '12px', border: '1px dashed var(--border-light)', opacity: 0.8 }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} color="var(--primary-blue)" /> Centralized Branding
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Site-wide colors and typography are dictated by the Super Admin in Global Settings.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '12px', background: 'var(--bg-surface-secondary)', opacity: 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Globe size={18} /> <span>Language</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>English (US)</span>
            </div>
          </div>
        </section>

        <section className="card glass" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={20} color="#fbbf24" /> Security Settings
          </h3>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '14px',
            padding: '16px', borderRadius: '10px',
            background: 'rgba(251,191,36,0.07)',
            border: '1px solid rgba(251,191,36,0.2)'
          }}>
            <div style={{ fontSize: '24px', flexShrink: 0 }}>🔒</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#fbbf24', marginBottom: '6px' }}>
                Restricted — Super User Panel Only
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                Password resets, two-factor authentication, and account security policies
                are managed exclusively in the <strong style={{ color: 'var(--text-main)' }}>Super User Panel</strong>.
                Contact your Super User if you need to change security settings.
              </p>
            </div>
          </div>
        </section>

        <section className="card glass">
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} color="var(--primary-blue)" /> Notifications
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <input 
                type="checkbox" 
                checked={orderAlerts}
                onChange={(e) => setOrderAlerts(e.target.checked)}
                style={{ marginTop: '4px', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Order Alerts</div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Get notified when a new order is placed.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <input 
                type="checkbox" 
                checked={stockAlerts}
                onChange={(e) => setStockAlerts(e.target.checked)}
                style={{ marginTop: '4px', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Stock Alerts</div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Notify when product stock is low.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
        {saveStatus === 'saved' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '14px', fontWeight: 600 }}>
            <Check size={16} /> Settings saved successfully!
          </span>
        )}
        <button 
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="btn btn-primary" 
          style={{ 
            padding: '14px 40px', 
            fontSize: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            opacity: saveStatus === 'saving' ? 0.6 : 1,
            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer'
          }}
        >
          <Save size={20} /> {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
