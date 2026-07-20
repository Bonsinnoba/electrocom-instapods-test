import React from 'react';
import { Cookie, Info, Settings, MousePointerClick } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function CookiePolicy() {
  const { siteSettings } = useSettings();
  const siteName = siteSettings.siteName || 'This store';

  return (
    <div className="cookie-policy-page" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '64px', 
          height: '64px', 
          background: 'rgba(59, 130, 246, 0.1)', 
          borderRadius: '20px', 
          color: 'var(--primary-blue)',
          marginBottom: '20px'
        }}>
          <Cookie size={32} />
        </div>
        <h1 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-1px' }}>Cookie Policy</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '18px' }}>Last updated: February 14, 2026</p>
      </div>

      <div className="glass" style={{ padding: '40px', borderRadius: '32px', marginBottom: '40px' }}>
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
            <Info size={24} className="text-primary" /> 1. What Are Cookies
          </h2>
          <p style={{ lineHeight: '1.8', color: 'var(--text-main)', opacity: 0.9 }}>
            Cookies are small pieces of text sent to your web browser by a website you visit. A cookie file is stored in your web browser and allows the Service or a third-party to recognize you and make your next visit easier and the Service more useful to you.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
            <Cookie size={24} className="text-primary" /> {`2. How ${siteName} Uses Cookies`}
          </h2>
          <p style={{ lineHeight: '1.8', color: 'var(--text-main)', opacity: 0.9 }}>
            When you use and access the Service, we may place a number of cookies files in your web browser. We use cookies for the following purposes:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '16px', lineHeight: '1.8', display: 'grid', gap: '10px' }}>
            <li><strong>Essential Cookies:</strong> We use essential cookies to authenticate users and prevent fraudulent use of user accounts.</li>
            <li><strong>Preferences Cookies:</strong> We use preference cookies to remember information that changes the way the service behaves or looks, such as a user's language preference.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
            <MousePointerClick size={24} className="text-primary" /> 3. Third-party Cookies
          </h2>
          <p style={{ lineHeight: '1.8', color: 'var(--text-main)', opacity: 0.9 }}>
            In addition to our own cookies, we may also use various third-parties cookies to report usage statistics of the Service and so on.
          </p>
        </section>

        <section>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
            <Settings size={24} className="text-primary" /> 4. What are your choices regarding cookies
          </h2>
          <p style={{ lineHeight: '1.8', color: 'var(--text-main)', opacity: 0.9 }}>
            If you'd like to delete cookies or instruct your web browser to delete or refuse cookies, please visit the help pages of your web browser.
          </p>
        </section>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        <p>EssentialHub uses cookies to ensure you get the best experience on our website.</p>
      </div>
    </div>
  );
}
