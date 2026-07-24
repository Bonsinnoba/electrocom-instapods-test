import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { updateProfile, formatImageUrl, fetchHomepageBoot } from '../services/api';
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
  const hasFetchedSiteSettings = useRef(false);
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
  const [homepageBoot, setHomepageBoot] = useState({
    slides: [],
    partners: [],
    flashSaleBannerSettings: null
  });

  useEffect(() => {
    const loadHomepageBoot = async () => {
      try {
        const data = await fetchHomepageBoot();

        if (data.csrf_token) {
          sessionStorage.setItem('csrf_token', data.csrf_token);
        }

        if (data.site_settings) {
          const cleanedData = {};
          Object.keys(data.site_settings).forEach(key => {
            const val = data.site_settings[key];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              cleanedData[key] = val;
            }
          });

          if (cleanedData.siteLogoUrl) cleanedData.siteLogoUrl = formatImageUrl(cleanedData.siteLogoUrl);
          if (cleanedData.faviconUrl) cleanedData.faviconUrl = formatImageUrl(cleanedData.faviconUrl);
          setSiteSettings(prev => ({ ...prev, ...cleanedData }));
        }

        setHomepageBoot({
          slides: Array.isArray(data.slides)
            ? data.slides.map(slide => ({ ...slide, image_url: formatImageUrl(slide.image_url) }))
            : [],
          partners: Array.isArray(data.partners)
            ? data.partners.map(partner => ({ ...partner, logo_url: formatImageUrl(partner.logo_url) }))
            : [],
          flashSaleBannerSettings: data.flash_sale_banner_settings || null
        });
        return;
      } catch (error) {
        console.error('Failed loading homepage boot payload:', error);
      }

      // Fallback to legacy site settings endpoint if boot fails
      try {
        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const response = await fetch(`${base}/get_site_settings.php`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        let result;
        try { result = JSON.parse(text); } catch { throw new Error('Invalid JSON from settings endpoint'); }
        if (result.success && result.data) {
          const data = result.data;
          const cleanedData = {};
          Object.keys(data).forEach(key => {
            const val = data[key];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              cleanedData[key] = val;
            }
          });
          if (cleanedData.siteLogoUrl) cleanedData.siteLogoUrl = formatImageUrl(cleanedData.siteLogoUrl);
          if (cleanedData.faviconUrl) cleanedData.faviconUrl = formatImageUrl(cleanedData.faviconUrl);
          setSiteSettings(prev => ({ ...prev, ...cleanedData }));
        }
      } catch (error) {
        console.error('Error loading site settings fallback:', error);
      }
    };

    if (!hasFetchedSiteSettings.current) {
      hasFetchedSiteSettings.current = true;
      loadHomepageBoot();
    }
  }, []);

  // Helper to calculate hover colors from base colors
  const calculateHoverColors = (primary, accent, header) => {
    const darken = (hex, percent) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.max((num >> 16) - amt, 0);
      const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
      const B = Math.max((num & 0x0000FF) - amt, 0);
      return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    };
    const lighten = (hex, percent) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.min((num >> 16) + amt, 255);
      const G = Math.min((num >> 8 & 0x00FF) + amt, 255);
      const B = Math.min((num & 0x0000FF) + amt, 255);
      return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    };
    return {
      buttonPrimaryHover: darken(primary, 15),
      buttonSecondaryHover: '#475569',
      buttonAccentHover: darken(accent, 15),
      linkHover: lighten(primary, 20),
      cardHover: header,
    };
  };

  // Apply theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const hoverColors = calculateHoverColors(
      siteSettings.primaryColor || '#3B82F6',
      siteSettings.accentColor || '#f59e0b',
      siteSettings.headerBg || '#0f172a'
    );
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
    root.style.setProperty('--button-primary-hover', hoverColors.buttonPrimaryHover);
    root.style.setProperty('--button-secondary-hover', hoverColors.buttonSecondaryHover);
    root.style.setProperty('--button-accent-hover', hoverColors.buttonAccentHover);
    root.style.setProperty('--link-hover', hoverColors.linkHover);
    root.style.setProperty('--card-hover', hoverColors.cardHover);
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
    <SettingsContext.Provider value={{ siteSettings, settings, updateSetting, homepageBoot, formatImageUrl }}>
      {children}
    </SettingsContext.Provider>
  );
};
