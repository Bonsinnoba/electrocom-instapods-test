import React, { useState } from 'react';
import { X, Cookie, Check, Shield, Info } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'ehub_cookie_consent';

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      return !consent;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when loading cookie consent');
      }
      return true;
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      return consent ? JSON.parse(consent) : {
        necessary: true,
        analytics: false,
        marketing: false,
        functional: false
      };
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when loading cookie preferences');
      }
      return {
        necessary: true,
        analytics: false,
        marketing: false,
        functional: false
      };
    }
  });

  const handleAcceptAll = () => {
    const newPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true
    };
    setPreferences(newPreferences);
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(newPreferences));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when saving cookie consent');
      }
    }
    setShowBanner(false);
    applyConsent(newPreferences);
  };

  const handleRejectAll = () => {
    const newPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    };
    setPreferences(newPreferences);
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(newPreferences));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when saving cookie consent');
      }
    }
    setShowBanner(false);
    applyConsent(newPreferences);
  };

  const handleSavePreferences = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preferences));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when saving cookie preferences');
      }
    }
    setShowBanner(false);
    setShowSettings(false);
    applyConsent(preferences);
  };

  const handleTogglePreference = (key) => {
    if (key === 'necessary') return; // Necessary cookies cannot be disabled
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const applyConsent = (prefs) => {
    // Dispatch custom event for other components to react to consent changes
    window.dispatchEvent(new CustomEvent('cookieConsent', { detail: prefs }));
    
    // Here you would typically:
    // - Enable/disable analytics tracking based on preferences.analytics
    // - Enable/disable marketing cookies based on preferences.marketing
    // - Enable/disable functional cookies based on preferences.functional
  };

  if (!showBanner) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      right: '20px',
      zIndex: 9999,
      maxWidth: '600px',
      marginLeft: 'auto',
      marginRight: 'auto'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        {!showSettings ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'var(--primary-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Cookie size={24} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>
                  Cookie Preferences
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
                  We use cookies to enhance your experience, analyze site traffic, and for marketing purposes. 
                  You can customize your cookie preferences below.
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-blue)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Info size={14} /> Customize preferences
                </button>
              </div>
              <button
                onClick={() => setShowBanner(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={handleRejectAll}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-surface-secondary)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface-secondary)'}
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary-blue)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Accept All
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                Customize Cookie Preferences
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              <CookieOption
                title="Necessary Cookies"
                description="Required for the site to function properly. Cannot be disabled."
                icon={<Shield size={18} />}
                checked={preferences.necessary}
                disabled={true}
                onToggle={() => {}}
              />
              <CookieOption
                title="Analytics Cookies"
                description="Help us understand how visitors use our site by collecting anonymous data."
                icon={<Info size={18} />}
                checked={preferences.analytics}
                disabled={false}
                onToggle={() => handleTogglePreference('analytics')}
              />
              <CookieOption
                title="Marketing Cookies"
                description="Used to deliver personalized advertisements and track marketing campaigns."
                icon={<Cookie size={18} />}
                checked={preferences.marketing}
                disabled={false}
                onToggle={() => handleTogglePreference('marketing')}
              />
              <CookieOption
                title="Functional Cookies"
                description="Enable enhanced features and personalization based on your preferences."
                icon={<Check size={18} />}
                checked={preferences.functional}
                disabled={false}
                onToggle={() => handleTogglePreference('functional')}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSavePreferences}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary-blue)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Save Preferences
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const CookieOption = ({ title, description, icon, checked, disabled, onToggle }) => (
  <div style={{
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-surface-secondary)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
  }}>
    <div style={{
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      background: checked ? 'var(--primary-blue)' : 'var(--bg-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: checked ? 'white' : 'var(--text-muted)',
      flexShrink: 0
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
          {title}
        </span>
        <button
          onClick={onToggle}
          disabled={disabled}
          style={{
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            background: checked ? 'var(--primary-blue)' : 'var(--border-light)',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            position: 'relative',
            transition: 'all 0.2s',
            opacity: disabled ? 0.5 : 1
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'white',
            position: 'absolute',
            top: '2px',
            left: checked ? '22px' : '2px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }} />
        </button>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        {description}
      </p>
    </div>
  </div>
);

export default CookieConsent;
