import React, { createContext, useContext, useState, useEffect } from 'react';
import { updateProfile, formatImageUrl } from '../services/api';
import { useUser } from './UserContext';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const { user, updateUser } = useUser();
  const [siteSettings, setSiteSettings] = useState({
    // Identity (overridden by get_site_settings.php)
    siteName:     'ElectroCom',
    siteEmail:    'support@electrocom.gh',
    siteTagline:  'Shop quality electronics online',
    metaDescription: 'Shop quality products online with secure checkout and support.',
    phone1:       '0536683393',
    phone2:       '0506408074',
    whatsapp:     '+233536683393',
    maintenanceMode: false,
    // Assets
    siteLogoUrl:  '',
    faviconUrl:   '',
    // Location
    storeAddress: 'Accra, Ghana',
    businessHours:'Mon–Fri, 8:30am–6pm',
    // Social
    socialInstagram: 'https://www.instagram.com/',
    socialTwitter:   '',
    socialFacebook:  'https://web.facebook.com/profile.php?id=100089794533062',
    socialTikTok:    'https://www.tiktok.com/en/',
    socialYoutube:   'https://www.youtube.com/incrediblemotors.o',
    // Branding
    primaryColor:      '#3B82F6',
    accentColor:       '#f59e0b',
    headerBg:          '#0f172a',
    fontFamily:        'Inter',
    // Hover colors
    buttonPrimaryHover:   '#2563eb',
    buttonSecondaryHover: '#475569',
    buttonAccentHover:    '#d97706',
    linkHover:            '#60a5fa',
    cardHover:            '#1e293b',
    heroBannerTagline: '',
    heroBannerSubtext: '',
    heroCTAText:       'Explore Now',
    heroCTAUrl:        '/products',
    // Storefront behaviour
    defaultItemsPerPage:      12,
    homepageSectionTitle:     'New Arrivals',
    homepageFeaturedCategory: 'Featured Products',
    vatRate:                  0,
    allowDoorToDoorDelivery:  false,
  });

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('ehub_settings_v2');
      return saved ? JSON.parse(saved) : {
        email_notif: true,
        push_notif: true,
        sms_tracking: true,
        currency: 'GHS',
        language: 'English (UK)',
        currencySymbol: '₵',
        currencyRate: 1
      };
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when loading settings');
      }
      return {
        email_notif: true,
        push_notif: true,
        sms_tracking: true,
        currency: 'GHS',
        language: 'English (UK)',
        currencySymbol: '₵',
        currencyRate: 1
      };
    }
  });

  // Fetch site settings from backend
  useEffect(() => {
    const loadSiteSettings = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const response = await fetch(`${base}/get_site_settings.php?_t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        let result;
        try { result = JSON.parse(text); } catch { throw new Error('Invalid JSON from settings endpoint'); }
        if (result.success && result.data) {
          const data = result.data;

          // Clean empty/null/undefined values to allow fallback to local defaults
          const cleanedData = {};
          Object.keys(data).forEach(key => {
            const val = data[key];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              cleanedData[key] = val;
            }
          });

          // Ensure branding URLs are absolute
          if (cleanedData.siteLogoUrl) cleanedData.siteLogoUrl = formatImageUrl(cleanedData.siteLogoUrl);
          if (cleanedData.faviconUrl)  cleanedData.faviconUrl  = formatImageUrl(cleanedData.faviconUrl);

          setSiteSettings(prev => ({ ...prev, ...cleanedData }));
        }
      } catch (error) {
        console.error('Error loading site settings:', error);
      }
    };
    loadSiteSettings();
  }, []);

  // Apply theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (siteSettings.primaryColor) {
      root.style.setProperty('--primary-blue', siteSettings.primaryColor);
      // Calculate RGB value for rgba usage
      const hex = siteSettings.primaryColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      root.style.setProperty('--primary-blue-rgb', `${r}, ${g}, ${b}`);
    }
    if (siteSettings.accentColor) {
      root.style.setProperty('--accent-blue', siteSettings.accentColor);
    }
    if (siteSettings.headerBg) {
      root.style.setProperty('--header-bg', siteSettings.headerBg);
    }
    if (siteSettings.buttonPrimaryHover) {
      root.style.setProperty('--button-primary-hover', siteSettings.buttonPrimaryHover);
    }
    if (siteSettings.buttonSecondaryHover) {
      root.style.setProperty('--button-secondary-hover', siteSettings.buttonSecondaryHover);
    }
    if (siteSettings.buttonAccentHover) {
      root.style.setProperty('--button-accent-hover', siteSettings.buttonAccentHover);
    }
    if (siteSettings.linkHover) {
      root.style.setProperty('--link-hover', siteSettings.linkHover);
    }
    if (siteSettings.cardHover) {
      root.style.setProperty('--card-hover', siteSettings.cardHover);
    }
    if (siteSettings.fontFamily) {
      root.style.setProperty('--font-family', siteSettings.fontFamily);
    }
  }, [siteSettings]);

  // Sync with user object on load/change
  useEffect(() => {
    if (user) {
      setSettings(prev => ({
        ...prev,
        email_notif: user.email_notif ?? prev.email_notif,
        push_notif: user.push_notif ?? prev.push_notif,
        sms_tracking: user.sms_tracking ?? prev.sms_tracking
      }));
    }
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem('ehub_settings_v2', JSON.stringify(settings));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when saving settings');
      }
    }
  }, [settings]);

  const updateSetting = async (key, value) => {
    const prevValue = settings[key];
    setSettings(prev => ({ ...prev, [key]: value }));

    // Persist to backend if a user is logged in and it's a preference field
    const persistentKeys = ['email_notif', 'push_notif', 'sms_tracking'];
    if (user && persistentKeys.includes(key)) {
      try {
        const result = await updateProfile({ [key]: value });
        if (result.success) {
          updateUser({ ...user, [key]: value });
        } else {
          // Revert on failure
          setSettings(prev => ({ ...prev, [key]: prevValue }));
        }
      } catch (error) {
        setSettings(prev => ({ ...prev, [key]: prevValue }));
      }
    }
  };

  const updateCurrency = (currency) => {
    // Only GHS is supported now
    setSettings(prev => ({
      ...prev,
      currency: 'GHS',
      currencySymbol: '₵',
      currencyRate: 1
    }));
  };

  const formatPrice = (price) => {
    const amount = Number(price) || 0;
    return `₵${amount.toFixed(2)}`;
  };

  return (
    <SettingsContext.Provider value={{ settings, siteSettings, updateSetting, updateCurrency, formatPrice }}>
      {children}
    </SettingsContext.Provider>
  );
};
