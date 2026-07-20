import React, { useState, useEffect } from 'react';
import {
  Settings, Globe, Shield, Bell, Database, Palette,
  Save, RefreshCw, AlertTriangle, CheckCircle,
  Lock, Server, Instagram, Twitter, Facebook, Youtube,
  Image, Clock, MapPin, Link, Percent, Package, Mail,
  Type, Smartphone, Eye, ToggleLeft
} from 'lucide-react';
import { 
  fetchSuperSettings as getSettings, 
  saveSuperSettings as saveSettings, 
  uploadBrandingAsset, 
  formatImageUrl,
  fetchBatch
} from '../../services/api';
import { useAdminSettings } from '../../context/AdminSettingsContext';
import { useConfirm } from '../../context/ConfirmContext';

// ── File Upload Helper ────────────────────────────────────────────────────────
function FileUploadField({ label, description, icon, value, type, onChange, oldPath }) {
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await uploadBrandingAsset(file, type, oldPath);
      if (res.success) {
        onChange(res.url);
      } else {
        alert(res.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Network error during upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Field label={label} description={description} icon={icon}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            readOnly 
            value={value || ''} 
            placeholder="No file selected"
            style={{ ...inputStyle, flex: 1, cursor: 'default', background: 'rgba(255,255,255,0.03)' }} 
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '0 16px', borderRadius: '10px', background: 'var(--primary-gold)',
              color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
            }}
          >
            {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Link size={14} />}
            {uploading ? 'Uploading...' : 'Browse'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            style={{ display: 'none' }} 
            accept={type === 'favicon' ? '.ico,.png,.svg' : 'image/*'}
          />
        </div>

        {value && (
          <div style={{ position: 'relative' }}>
            <img 
              src={formatImageUrl(value)} 
              alt="Preview" 
              style={{ 
                height: type === 'favicon' ? '32px' : '40px', 
                width: type === 'favicon' ? '32px' : 'auto',
                maxWidth: '120px', objectFit: 'contain', borderRadius: '8px', 
                border: '1px solid var(--border-light)', padding: '4px', 
                background: 'var(--bg-surface-secondary)' 
              }} 
            />
            <button
              onClick={() => onChange('')}
              style={{
                position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px',
                borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none',
                fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </Field>
  );
}

// ── Reusable UI components ────────────────────────────────────────────────────
function Toggle({ value, onChange, label, description }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '14px' }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: '48px', height: '26px', borderRadius: '13px', border: 'none',
          background: value ? 'var(--primary-gold)' : 'rgba(255,255,255,0.1)',
          position: 'relative', cursor: 'pointer', transition: 'background 0.25s', flexShrink: 0
        }}
      >
        <div style={{
          position: 'absolute', top: '3px', left: value ? '25px' : '3px',
          width: '20px', height: '20px', borderRadius: '50%', background: value ? '#000' : '#94a3b8',
          transition: 'left 0.25s'
        }} />
      </button>
    </div>
  );
}

function Field({ label, description, icon, children }) {
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
        {icon && <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>}
        {label}
      </div>
      {description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>{description}</div>}
      {children}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase',
      color: 'var(--text-muted)', paddingTop: '24px', paddingBottom: '8px',
      borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '4px'
    }}>
      {title}
    </div>
  );
}

const inputStyle = {
  width: '100%', maxWidth: '420px', padding: '10px 14px', borderRadius: '10px',
  background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)',
  color: 'var(--text-main)', fontSize: '14px', fontWeight: 600, outline: 'none'
};

const textareaStyle = {
  ...inputStyle, maxWidth: '100%', minHeight: '80px', resize: 'vertical', lineHeight: '1.5'
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

const narrowInput = { ...inputStyle, maxWidth: '180px' };

// ── Color picker row ──────────────────────────────────────────────────────────
function ColorField({ label, description, value, onChange }) {
  return (
    <Field label={label} description={description} icon={<Palette size={14} />}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="color"
            value={value || '#000000'}
            onChange={e => onChange(e.target.value)}
            style={{
              width: '48px', height: '40px', borderRadius: '10px', border: '2px solid var(--border-light)',
              cursor: 'pointer', background: 'none', padding: '2px', outline: 'none'
            }}
          />
        </div>
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          style={{ ...narrowInput, maxWidth: '140px', fontFamily: 'monospace', textTransform: 'uppercase' }}
        />
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: value || '#000000',
          border: '2px solid var(--border-light)',
          flexShrink: 0
        }} />
      </div>
    </Field>
  );
}

// ── Social link row ───────────────────────────────────────────────────────────
function SocialField({ label, icon, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: '13px', width: '100px', flexShrink: 0 }}>{label}</div>
      <input
        type="url"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, maxWidth: 'none', flex: 1 }}
      />
    </div>
  );
}

// ── Theme selector component ───────────────────────────────────────────────────
function ThemeSelector({ value, onChange, presets }) {
  const displayPresets = presets;
  const displayKeys = Object.keys(displayPresets);
  
  return (
    <Field label="Theme Preset" description="Choose a pre-designed color scheme or customize colors individually below." icon={<Palette size={14} />}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {displayKeys.map((key) => {
          const theme = displayPresets[key];
          return (
            <div
              key={key}
              onClick={() => onChange(key)}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: `2px solid ${value === key ? 'var(--primary-gold)' : 'var(--border-light)'}`,
                background: 'var(--bg-surface-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '10px' }}>{theme.name}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: theme.primaryColor, border: '1px solid rgba(255,255,255,0.2)' }} />
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: theme.accentColor, border: '1px solid rgba(255,255,255,0.2)' }} />
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: theme.headerBg, border: '1px solid rgba(255,255,255,0.2)' }} />
              </div>
              {value === key && (
                <div style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--primary-gold)' }}>
                  <CheckCircle size={16} />
                </div>
              )}
            </div>
          );
        })}
        <div
          onClick={() => onChange('custom')}
          style={{
            padding: '16px',
            borderRadius: '12px',
            border: `2px solid ${value === 'custom' ? 'var(--primary-gold)' : 'var(--border-light)'}`,
            background: 'var(--bg-surface-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70px'
          }}
        >
          <Palette size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-muted)' }}>Custom</div>
          {value === 'custom' && (
            <div style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--primary-gold)' }}>
              <CheckCircle size={16} />
            </div>
          )}
        </div>
      </div>
    </Field>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GlobalSettings() {
  const { refreshSettings } = useAdminSettings();
  const { confirm } = useConfirm();
  const [settings, setSettings] = useState({});
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const [tab, setTab]           = useState('general');
  const [themePresets, setThemePresets] = useState({});
  const [selectedPreset, setSelectedPreset] = useState('iconic_blue');

  useEffect(() => {
    const load = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        
        // Try to load settings via batch endpoint first
        let settingsData = null;
        try {
          settingsData = await fetchBatch(['settings']);
        } catch (batchError) {
          // Fallback to direct API call if batch fails
          const response = await fetch(`${apiUrl}/get_site_settings.php?_t=${Date.now()}`);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          settingsData = { settings: result.data };
        }
        
        // Load theme presets
        const presetsResponse = await fetch(`${apiUrl}/get_theme_presets.php`);
        
        if (!presetsResponse.ok) {
          throw new Error(`HTTP ${presetsResponse.status}: ${presetsResponse.statusText}`);
        }
        
        const presetsData = await presetsResponse.json();
        
        if (settingsData?.settings) {
          setSettings(settingsData.settings);
          setLastSynced(new Date());
        }
        if (presetsData.success && presetsData.data) {
          setThemePresets(presetsData.data);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
        setSettings({});
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Auto-save for toggles
  const set = (key) => async (val) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    try {
      await saveSettings(updated);
      setLastSynced(new Date());
      await refreshSettings(); // Sync global UI state (colors, name, etc.)
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  };

  const setVal = (key) => (e) => setSettings(prev => ({ ...prev, [key]: e.target.value }));
  const setNum = (key) => (e) => setSettings(prev => ({ ...prev, [key]: Number(e.target.value) }));
  const setColor = (key) => async (val) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    setSelectedPreset('custom'); // Switch to custom when manually changing colors
    try {
      await saveSettings(updated);
      setLastSynced(new Date());
      await refreshSettings(); // Sync global UI state (colors, name, etc.)
    } catch (e) {
      console.error('Color save failed:', e);
    }
  };

  const applyThemePreset = async (presetKey) => {
    if (presetKey === 'custom') {
      setSelectedPreset('custom');
      return;
    }
    
    const preset = themePresets[presetKey];
    
    if (!preset) {
      return;
    }
    
    const updated = {
      ...settings,
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
      headerBg: preset.headerBg,
      buttonPrimaryHover: preset.buttonPrimaryHover,
      buttonSecondaryHover: preset.buttonSecondaryHover,
      buttonAccentHover: preset.buttonAccentHover,
      linkHover: preset.linkHover,
      cardHover: preset.cardHover,
    };
    setSettings(updated);
    setSelectedPreset(presetKey);
    try {
      await saveSettings(updated);
      setLastSynced(new Date());
      await refreshSettings();
    } catch (e) {
      console.error('Theme preset application failed:', e);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      setLastSynced(new Date());
      setSaved(true);
      await refreshSettings(); // Sync global UI state
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Save error:', e);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: 'general',       label: 'General',       icon: <Globe size={15} /> },
    { id: 'branding',      label: 'Branding',       icon: <Palette size={15} /> },
    { id: 'security',      label: 'Security',       icon: <Shield size={15} /> },
    { id: 'notifications', label: 'Notifications',  icon: <Bell size={15} /> },
    { id: 'system',        label: 'System',         icon: <Server size={15} /> },
  ];

  const FONTS = ['Inter', 'Poppins', 'Roboto', 'Outfit', 'Nunito', 'Lato', 'Montserrat', 'Raleway', 'DM Sans'];

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
      <Settings size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
      <p>Loading settings from server...</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '34px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Settings size={30} color="var(--primary-gold)" />
            Global Settings
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
            Configure site-wide preferences, branding, security policies, and system behaviour.
          </p>
          {lastSynced && (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle size={12} color="#22c55e" /> Synced from server at {lastSynced.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
        >
          {saving ? <RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </header>

      {/* Maintenance Banner */}
      {settings.maintenanceMode && (
        <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
          <AlertTriangle size={20} color="#f59e0b" />
          <div>
            <div style={{ fontWeight: 800, color: '#f59e0b' }}>Maintenance Mode Active</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>The storefront is currently offline for all customers.</div>
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 18px', borderRadius: '10px 10px 0 0', border: 'none',
              background: tab === t.id ? 'var(--bg-surface)' : 'transparent',
              color: tab === t.id ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              borderBottom: tab === t.id ? '2px solid var(--primary-gold)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="card glass">

        {/* ── GENERAL ─────────────────────────────────────────────────────── */}
        {tab === 'general' && (
          <>
            <SectionHeader title="Identity" />
            <Field label="Site Name" description="Displayed in the browser tab and email communications." icon={<Globe size={14} />}>
              <input style={inputStyle} value={settings.siteName || ''} onChange={setVal('siteName')} />
            </Field>
            <Field label="Contact Email" description="System notifications and alerts are sent from this address." icon={<Mail size={14} />}>
              <input style={inputStyle} type="email" value={settings.siteEmail || ''} onChange={setVal('siteEmail')} />
            </Field>
            <Field label="Site tagline" description="Shown after the site name in the browser tab (e.g. “My Store | Shop online”)." icon={<Type size={14} />}>
              <input style={inputStyle} value={settings.siteTagline || ''} onChange={setVal('siteTagline')} placeholder="e.g. Shop online" />
            </Field>
            <Field label="Meta description (SEO)" description="Short summary for search engines; applied to the storefront on load." icon={<Globe size={14} />}>
              <textarea style={textareaStyle} rows={2} value={settings.metaDescription || ''} onChange={setVal('metaDescription')} placeholder="A brief description of your store for search results." />
            </Field>
            <Field label="Phone Number 1" description="Primary contact number shown on the storefront." icon={<Smartphone size={14} />}>
              <input style={inputStyle} value={settings.phone1 || ''} onChange={setVal('phone1')} />
            </Field>
            <Field label="Phone Number 2" description="Secondary contact number." icon={<Smartphone size={14} />}>
              <input style={inputStyle} value={settings.phone2 || ''} onChange={setVal('phone2')} />
            </Field>
            <Field label="WhatsApp Number" description="Use international format, e.g. 233536683393." icon={<Smartphone size={14} />}>
              <input style={inputStyle} value={settings.whatsapp || ''} onChange={setVal('whatsapp')} />
            </Field>

            <SectionHeader title="Assets" />
            <FileUploadField 
              label="Site Logo" 
              description="Upload your official logo. Displayed in header and emails." 
              icon={<Image size={14} />}
              type="logo"
              value={settings.siteLogoUrl}
              oldPath={settings.siteLogoUrl}
              onChange={set('siteLogoUrl')}
            />
            <FileUploadField 
              label="Favicon" 
              description="Browser tab icon. Recommended: 32x32 .ico or .png" 
              icon={<Eye size={14} />}
              type="favicon"
              value={settings.faviconUrl}
              oldPath={settings.faviconUrl}
              onChange={set('faviconUrl')}
            />

            <SectionHeader title="Location & Hours" />
            <Field label="Store Address" description="Physical address shown in the footer and contact page." icon={<MapPin size={14} />}>
              <textarea style={textareaStyle} value={settings.storeAddress || ''} onChange={setVal('storeAddress')} placeholder="e.g. 12 Independence Ave, Accra, Ghana" />
            </Field>
            <Field label="Business Hours" description="Opening hours shown on the contact page and footer." icon={<Clock size={14} />}>
              <input style={inputStyle} value={settings.businessHours || ''} onChange={setVal('businessHours')} placeholder="e.g. Mon–Fri, 8am–6pm" />
            </Field>

            <SectionHeader title="Social Media" />
            <SocialField label="Instagram" icon={<Instagram size={16} />} value={settings.socialInstagram} onChange={v => setSettings(p => ({ ...p, socialInstagram: v }))} placeholder="https://instagram.com/yourpage" />
            <SocialField label="Twitter / X" icon={<Twitter size={16} />} value={settings.socialTwitter} onChange={v => setSettings(p => ({ ...p, socialTwitter: v }))} placeholder="https://x.com/yourpage" />
            <SocialField label="Facebook" icon={<Facebook size={16} />} value={settings.socialFacebook} onChange={v => setSettings(p => ({ ...p, socialFacebook: v }))} placeholder="https://facebook.com/yourpage" />
            <SocialField label="TikTok" icon={<Link size={16} />} value={settings.socialTikTok} onChange={v => setSettings(p => ({ ...p, socialTikTok: v }))} placeholder="https://tiktok.com/@yourpage" />
            <SocialField label="YouTube" icon={<Youtube size={16} />} value={settings.socialYoutube} onChange={v => setSettings(p => ({ ...p, socialYoutube: v }))} placeholder="https://youtube.com/@yourchannel" />

            <SectionHeader title="Availability" />
            <Toggle value={settings.maintenanceMode} onChange={set('maintenanceMode')}
              label="Maintenance Mode"
              description="Temporarily closes the storefront to all non-super-user traffic."
            />
            <Toggle value={settings.allowRegistration} onChange={set('allowRegistration')}
              label="Allow New Registrations"
              description="When disabled, the sign-up page will return a 403 error."
            />
            <Toggle value={settings.allowDoorToDoorDelivery} onChange={set('allowDoorToDoorDelivery')}
              label="Enable Door to Door Delivery"
              description="When disabled, checkout will only allow pickup locations."
            />
            {settings.allowDoorToDoorDelivery && (
              <div className="form-group animate-slide-in">
                <label className="input-label">Door to Door Min. Threshold (GHS)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input-premium"
                    value={settings.doorToDoorThreshold || 0}
                    onChange={(e) => setSettings(s => ({ ...s, doorToDoorThreshold: Math.max(0, parseInt(e.target.value) || 0) }))}
                    style={{ flex: 1 }}
                  />
                </div>
                <p className="input-description">Minimum order subtotal required to qualify for door-to-door delivery. Set to 0 to disable the minimum requirement.</p>
              </div>
            )}
            <Toggle value={settings.allowCardPayment} onChange={set('allowCardPayment')}
              label="Enable Card Payment"
              description="When disabled, checkout will not offer card payment as an option."
            />
          </>
        )}

        {/* ── BRANDING ────────────────────────────────────────────────────── */}
        {tab === 'branding' && (
          <>
            <SectionHeader title="Theme Presets" />
            <ThemeSelector 
              value={selectedPreset} 
              onChange={applyThemePreset} 
              presets={themePresets} 
            />
            <SectionHeader title="Custom Colours" />
            <ColorField
              label="Primary Colour"
              description="Main brand colour used for buttons, links, and highlights across the storefront."
              value={settings.primaryColor}
              onChange={setColor('primaryColor')}
            />
            <ColorField
              label="Accent / Gold Colour"
              description="Secondary highlight colour, used for badges, sale labels, and icons."
              value={settings.accentColor}
              onChange={setColor('accentColor')}
            />
            <ColorField
              label="Header Background"
              description="Background colour of the storefront navigation bar."
              value={settings.headerBg}
              onChange={setColor('headerBg')}
            />

            <SectionHeader title="Hover Colours (Storefront)" />
            <ColorField
              label="Primary Button Hover"
              description="Colour when hovering over primary action buttons."
              value={settings.buttonPrimaryHover}
              onChange={setColor('buttonPrimaryHover')}
            />
            <ColorField
              label="Secondary Button Hover"
              description="Colour when hovering over secondary buttons."
              value={settings.buttonSecondaryHover}
              onChange={setColor('buttonSecondaryHover')}
            />
            <ColorField
              label="Accent Button Hover"
              description="Colour when hovering over accent/gold buttons."
              value={settings.buttonAccentHover}
              onChange={setColor('buttonAccentHover')}
            />
            <ColorField
              label="Link Hover"
              description="Colour when hovering over links."
              value={settings.linkHover}
              onChange={setColor('linkHover')}
            />
            <ColorField
              label="Card Hover"
              description="Background colour when hovering over product cards."
              value={settings.cardHover}
              onChange={setColor('cardHover')}
            />

            <SectionHeader title="Typography" />
            <Field label="Font Family" description="Primary typeface applied site-wide. Google Fonts are loaded automatically." icon={<Type size={14} />}>
              <select style={{ ...selectStyle, maxWidth: '280px' }} value={settings.fontFamily || 'Inter'} onChange={setVal('fontFamily')}>
                {['Inter', 'Poppins', 'Roboto', 'Outfit', 'Nunito', 'Lato', 'Montserrat', 'Raleway', 'DM Sans'].map(f => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </select>
              <div style={{ marginTop: '10px', padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)', maxWidth: '420px' }}>
                <span style={{ fontFamily: settings.fontFamily || 'Inter', fontSize: '16px' }}>
                  The quick brown fox jumps over the lazy dog.
                </span>
              </div>
            </Field>

            <SectionHeader title="Homepage Hero Banner" />
            <Field label="Hero Tagline" description="Large headline text displayed on the homepage hero section." icon={<Type size={14} />}>
              <input style={inputStyle} value={settings.heroBannerTagline || ''} onChange={setVal('heroBannerTagline')} placeholder="e.g. Your Tech, Delivered Fast" />
            </Field>
            <Field label="Hero Sub-text" description="Smaller supporting text below the tagline." icon={<Type size={14} />}>
              <input style={inputStyle} value={settings.heroBannerSubtext || ''} onChange={setVal('heroBannerSubtext')} placeholder="e.g. Ghana's #1 electronics destination" />
            </Field>
            <Field label="CTA Button Text" description="Text on the hero call-to-action button." icon={<Link size={14} />}>
              <input style={inputStyle} value={settings.heroCTAText || ''} onChange={setVal('heroCTAText')} placeholder="e.g. Shop Now" />
            </Field>
            <Field label="CTA Button URL" description="Where the hero button links to (relative path or full URL)." icon={<Link size={14} />}>
              <input style={inputStyle} value={settings.heroCTAUrl || ''} onChange={setVal('heroCTAUrl')} placeholder="/products" />
            </Field>

            <SectionHeader title="Flash Sale Banner" />
            <Field label="Enable Flash Sale Banner" description="Show or hide the flash sale banner on the homepage." icon={<ToggleLeft size={14} />}>
              <Toggle
                checked={!!settings.flashSaleBannerEnabled}
                onChange={set('flashSaleBannerEnabled')}
              />
            </Field>

            <SectionHeader title="Typography" />
            <Field label="Font Family" description="Primary typeface applied site-wide. Google Fonts are loaded automatically." icon={<Type size={14} />}>
              <select style={{ ...selectStyle, maxWidth: '280px' }} value={settings.fontFamily || 'Inter'} onChange={setVal('fontFamily')}>
                {['Inter', 'Poppins', 'Roboto', 'Outfit', 'Nunito', 'Lato', 'Montserrat', 'Raleway', 'DM Sans'].map(f => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </select>
              <div style={{ marginTop: '10px', padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)', maxWidth: '420px' }}>
                <span style={{ fontFamily: settings.fontFamily || 'Inter', fontSize: '16px' }}>
                  The quick brown fox jumps over the lazy dog.
                </span>
              </div>
            </Field>
          </>
        )}

        {/* ── SECURITY ────────────────────────────────────────────────────── */}
        {tab === 'security' && (
          <>
            <SectionHeader title="Login Policy" />
            <Field label="Max Login Attempts" description="Accounts are locked after this many consecutive failed attempts." icon={<Lock size={14} />}>
              <input style={narrowInput} type="number" min={1} max={20} value={settings.maxLoginAttempts} onChange={setNum('maxLoginAttempts')} />
            </Field>
            <Field label="Account Lockout Duration (mins)" description="How long an account stays locked after reaching the max failed attempts." icon={<Lock size={14} />}>
              <input style={narrowInput} type="number" min={1} max={1440} value={settings.lockoutDuration} onChange={setNum('lockoutDuration')} />
            </Field>
            <Field label="Session Timeout (minutes)" description="Admin sessions are automatically invalidated after this period of inactivity." icon={<Clock size={14} />}>
              <input style={narrowInput} type="number" min={5} max={480} value={settings.sessionTimeout} onChange={setNum('sessionTimeout')} />
            </Field>

            <SectionHeader title="Password Rules" />
            <Field label="Minimum Password Length" description="Minimum number of characters required when setting a password." icon={<Lock size={14} />}>
              <input style={narrowInput} type="number" min={6} max={32} value={settings.passwordMinLength} onChange={setNum('passwordMinLength')} />
            </Field>
            <Toggle value={settings.requireNumberInPassword} onChange={set('requireNumberInPassword')}
              label="Require Number in Password"
              description="Passwords must contain at least one numeric digit."
            />

            <SectionHeader title="Account Verification" />
            <Toggle value={settings.requireEmailVerification} onChange={set('requireEmailVerification')}
              label="Require Email Verification"
              description="New accounts cannot log in until their email address is confirmed."
            />
            <Toggle value={settings.twoFactorAdmin} onChange={set('twoFactorAdmin')}
              label="Two-Factor Auth for Admins"
              description="Require OTP verification for all admin logins."
            />
          </>
        )}

        {/* ── NOTIFICATIONS ───────────────────────────────────────────────── */}
        {tab === 'notifications' && (
          <>
            <SectionHeader title="Customer Emails" />
            <Toggle value={settings.emailNotify} onChange={set('emailNotify')}
              label="Order Email Notifications"
              description="Send order confirmation and shipping updates to customers."
            />

            <SectionHeader title="Admin Alerts" />
            <Toggle value={settings.securityAlerts} onChange={set('securityAlerts')}
              label="Security Alert Emails"
              description="Immediately notify the super-user on suspicious login attempts."
            />
            <Field label="Low Stock Alert Threshold" description="Notify admin when a product's stock drops to or below this quantity." icon={<Package size={14} />}>
              <input style={narrowInput} type="number" min={0} max={1000} value={settings.lowStockThreshold} onChange={setNum('lowStockThreshold')} />
            </Field>
            <Field label="Low Stock Alert Email" description="Email address that receives low stock warnings." icon={<Mail size={14} />}>
              <input style={inputStyle} type="email" value={settings.lowStockAlertEmail || ''} onChange={setVal('lowStockAlertEmail')} />
            </Field>
          </>
        )}

        {/* ── SYSTEM ──────────────────────────────────────────────────────── */}
        {tab === 'system' && (
          <>
            <SectionHeader title="Storefront Behaviour" />
            <Field label="Default Items Per Page" description="How many products appear per page in the storefront catalogue." icon={<Package size={14} />}>
              <select style={{ ...selectStyle, maxWidth: '200px' }} value={settings.defaultItemsPerPage} onChange={setNum('defaultItemsPerPage')}>
                {[6, 9, 12, 15, 18, 21, 24, 30, 36, 48].map(n => <option key={n} value={n}>{n} items</option>)}
              </select>
            </Field>
            <Field label="VAT / Tax Rate (%)" description="Applied during checkout. Set to 0 to disable tax." icon={<Percent size={14} />}>
              <input style={narrowInput} type="number" min={0} max={100} step={0.1} value={settings.vatRate} onChange={setNum('vatRate')} />
            </Field>

            <SectionHeader title="Homepage Content" />
            <Field label="Products Section Title" description="Heading shown above the featured products grid on the homepage." icon={<Type size={14} />}>
              <input style={inputStyle} value={settings.homepageSectionTitle || ''} onChange={setVal('homepageSectionTitle')} placeholder="e.g. New Arrivals" />
            </Field>
            <Field label="Featured Category" description="Slug or ID of the category whose products populate the homepage grid." icon={<Package size={14} />}>
              <input style={inputStyle} value={settings.homepageFeaturedCategory || ''} onChange={setVal('homepageFeaturedCategory')} placeholder="e.g. smartphones" />
            </Field>

            <SectionHeader title="Loyalty & Rewards" />
            <Field label="Integrity Points Threshold" description="Number of integrity points required to unlock the automatic storefront discount." icon={<Shield size={14} />}>
              <input style={narrowInput} type="number" min={0} value={settings.integrityDiscountThreshold} onChange={setNum('integrityDiscountThreshold')} />
            </Field>
            <Field label="Integrity Discount (%)" description="Percentage discount automatically applied to subtotal for qualifying customers." icon={<Percent size={14} />}>
              <input style={narrowInput} type="number" min={0} max={100} step={1} value={settings.integrityDiscountPct} onChange={setNum('integrityDiscountPct')} />
            </Field>

            <SectionHeader title="Orders" />
            <Field label="Order Receipt Footer Note" description="Custom message printed at the bottom of every order receipt." icon={<Type size={14} />}>
              <textarea style={textareaStyle} value={settings.orderReceiptFooterNote || ''} onChange={setVal('orderReceiptFooterNote')} placeholder="e.g. Thank you for shopping with us!" />
            </Field>

            <SectionHeader title="Infrastructure" />
            <Field label="API Rate Limit (req/min)" description="Maximum API requests per IP per minute. 0 = unlimited." icon={<Server size={14} />}>
              <input style={narrowInput} type="number" min={0} value={settings.apiRateLimit} onChange={setNum('apiRateLimit')} />
            </Field>
            <Field label="Database Backup Frequency" description="How often automated database snapshots are created." icon={<Database size={14} />}>
              <select style={{ ...selectStyle, maxWidth: '240px' }} value={settings.backupFrequency} onChange={setVal('backupFrequency')}>
                <option value="hourly">Every Hour</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="manual">Manual Only</option>
              </select>
            </Field>
            <Toggle value={settings.debugMode} onChange={set('debugMode')}
              label="Debug Mode"
              description="Enables verbose error output. Never enable this in production."
            />

            <SectionHeader title="Strategic Insights Model" />
            <Field label="Shipping Warning Hours" description="Average dispatch time above this gets a warning penalty." icon={<Clock size={14} />}>
              <input style={narrowInput} type="number" min={1} max={240} value={settings.insightsShipWarnHours} onChange={setNum('insightsShipWarnHours')} />
            </Field>
            <Field label="Shipping Critical Hours" description="Average dispatch time above this gets a critical penalty." icon={<Clock size={14} />}>
              <input style={narrowInput} type="number" min={1} max={480} value={settings.insightsShipCriticalHours} onChange={setNum('insightsShipCriticalHours')} />
            </Field>
            <Field label="Low Stock Warning Count" description="Number of low-stock products that triggers a warning penalty." icon={<Package size={14} />}>
              <input style={narrowInput} type="number" min={0} max={1000} value={settings.insightsLowStockWarnCount} onChange={setNum('insightsLowStockWarnCount')} />
            </Field>
            <Field label="Low Stock Critical Count" description="Number of low-stock products that triggers a critical penalty." icon={<Package size={14} />}>
              <input style={narrowInput} type="number" min={1} max={2000} value={settings.insightsLowStockCriticalCount} onChange={setNum('insightsLowStockCriticalCount')} />
            </Field>
            <Field label="Minimum Online Revenue Share (%)" description="If online revenue share falls below this, health score is penalized." icon={<Percent size={14} />}>
              <input style={narrowInput} type="number" min={0} max={100} step={1} value={settings.insightsOnlineRevenueMinPct} onChange={setNum('insightsOnlineRevenueMinPct')} />
            </Field>
            <Field label="Minimum Repeat Order Ratio" description="Minimum orders-per-customer target before retention penalty applies." icon={<Percent size={14} />}>
              <input style={narrowInput} type="number" min={0.5} max={10} step={0.1} value={settings.insightsRepeatOrderMin} onChange={setNum('insightsRepeatOrderMin')} />
            </Field>

            <SectionHeader title="Health Score Weights" />
            <Field label="Shipping Weight" description="Penalty weight for poor fulfillment speed (0-100)." icon={<Shield size={14} />}>
              <input style={narrowInput} type="number" min={0} max={100} value={settings.insightsWeightShip} onChange={setNum('insightsWeightShip')} />
            </Field>
            <Field label="Stock Weight" description="Penalty weight for low stock pressure (0-100)." icon={<Shield size={14} />}>
              <input style={narrowInput} type="number" min={0} max={100} value={settings.insightsWeightStock} onChange={setNum('insightsWeightStock')} />
            </Field>
            <Field label="Online Revenue Weight" description="Penalty weight for weak online share (0-100)." icon={<Shield size={14} />}>
              <input style={narrowInput} type="number" min={0} max={100} value={settings.insightsWeightOnline} onChange={setNum('insightsWeightOnline')} />
            </Field>
            <Field label="Repeat Purchase Weight" description="Penalty weight for low repeat ratio (0-100)." icon={<Shield size={14} />}>
              <input style={narrowInput} type="number" min={0} max={100} value={settings.insightsWeightRepeat} onChange={setNum('insightsWeightRepeat')} />
            </Field>

            <div style={{ marginTop: '32px', padding: '24px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '12px' }}>
                <AlertTriangle size={20} />
                <span style={{ fontWeight: 800, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>Danger Zone</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Performing a Factory Reset will permanently delete all <strong>Products</strong> and <strong>Slider Images</strong>. This action cannot be undone.
              </p>
              <button
                onClick={async () => {
                  if (await confirm('🚨 WARNING: This will WIPE all products and slider images. Are you absolutely sure?', { title: 'Factory Reset' })) {
                    try {
                      const res = await (await import('../../services/api')).wipeDemoData();
                      if (res.success) alert(res.message);
                      else alert(res.message || 'Cleanup failed.');
                    } catch (e) {
                      alert('Error during cleanup: ' + e.message);
                    }
                  }
                }}
                className="btn-danger"
                style={{ width: '100%', padding: '12px', fontWeight: 800 }}
              >
                Factory Reset (Wipe All Demo Data)
              </button>
            </div>
          </>
        )}

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
