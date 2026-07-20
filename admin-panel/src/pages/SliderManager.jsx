import React, { useState, useEffect } from 'react';
import {
  fetchAdminSlides, createSlide, updateSlide, deleteSlide, formatImageUrl,
  fetchAdminPartners, createPartner, updatePartner, deletePartner,
  fetchFlashSaleBannerSettings, updateFlashSaleBannerSettings
} from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { compressImageAuto } from '../utils/imageCompression';

const isVideo = (url) => url && (url.match(/\.(mp4|webm)$/i) || url.startsWith('data:video'));

import { Plus, Edit2, Trash2, CheckCircle, XCircle, Upload, Shield } from 'lucide-react';

/**
 * Sanitize user input to prevent XSS attacks
 * Removes dangerous HTML tags and attributes
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove script tags and event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
};

/**
 * Validate and sanitize content blocks
 */
const sanitizeContentBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return [];
  
  return blocks.map(block => ({
    ...block,
    text: sanitizeInput(block.text || ''),
    link: sanitizeInput(block.link || ''),
    // Only allow safe CSS properties
    color: block.color && /^#[0-9A-Fa-f]{6}$/.test(block.color) ? block.color : '#ffffff',
    fontSize: block.fontSize || '16px',
    textAlign: ['left', 'center', 'right'].includes(block.textAlign) ? block.textAlign : 'center',
    type: ['paragraph', 'heading', 'subheading', 'cta'].includes(block.type) ? block.type : 'paragraph'
  }));
};

/**
 * Validate slider form data
 */
const validateSliderData = (formData) => {
  const errors = {};
  
  if (formData.title && formData.title.length > 255) {
    errors.title = 'Title must be less than 255 characters';
  }
  
  if (formData.subtitle && formData.subtitle.length > 500) {
    errors.subtitle = 'Subtitle must be less than 500 characters';
  }
  
  if (formData.button_text && formData.button_text.length > 100) {
    errors.button_text = 'Button text must be less than 100 characters';
  }
  
  if (formData.button_link && formData.button_link.length > 255) {
    errors.button_link = 'Button link must be less than 255 characters';
  }
  
  // Validate URL format for button_link
  if (formData.button_link && !formData.button_link.startsWith('/')) {
    try {
      new URL(formData.button_link);
    } catch {
      errors.button_link = 'Button link must be a valid URL or relative path';
    }
  }
  
  return errors;
};

const PREDEFINED_LINKS = [
  { value: '/shop', label: 'Shop Homepage' },
  { value: '/cart', label: 'Cart' },
  { value: '/favorites', label: 'Favorites' },
  { value: '/profile', label: 'User Profile' },
  { value: '/orders', label: 'Order History' },
  { value: '/about', label: 'About Us' },
  { value: '/support', label: 'Support & Help' },
  { value: '/track-order', label: 'Track Order' },
  { value: '/returns', label: 'Returns Policy' },
  { value: 'custom', label: 'Custom Path / URL...' }
];

export default function SliderManager() {
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();

  // Tab State
  const [activeTab, setActiveTab] = useState('hero');

  // Data States
  const [slides, setSlides] = useState([]);
  const [partners, setPartners] = useState([]);
  const [bannerSettings, setBannerSettings] = useState({
    is_enabled: 1,
    new_arrivals_enabled: 1,
    new_arrivals_days: 7,
    new_arrivals_title: 'Just Arrived',
    new_arrivals_subtitle: '{count} new products added this week',
    new_arrivals_cta: 'Explore New',
    low_stock_enabled: 1,
    low_stock_threshold: 5,
    low_stock_title: 'Low Stock Alert',
    low_stock_subtitle: '{count} items running low - grab them before they\'re gone',
    low_stock_cta: 'Shop Now',
    popular_enabled: 1,
    popular_title: 'Trending Now',
    popular_subtitle: 'Most popular items based on customer purchases',
    popular_cta: 'View Popular',
    promotion_enabled: 1,
    promotion_title: 'Free Shipping',
    promotion_subtitle: 'On orders over GHS 500',
    promotion_cta: 'Start Shopping',
    flash_sale_title: 'Limited Time Flash Sale',
    flash_sale_subtitle: 'Spotlight Deal: {product_name}',
    flash_sale_cta: 'Shop Deal'
  });
  const [loading, setLoading] = useState(true);

  // Modal & Edit States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);
  const [editingPartner, setEditingPartner] = useState(null);

  // Form States
  const [formData, setFormData] = useState({
    image_url: '',
    title: '',
    subtitle: '',
    button_text: 'Shop Now',
    button_link: '/shop',
    text_position: 'left',
    content_blocks: [],
    display_order: 1,
    is_active: 1
  });

  const [partnerFormData, setPartnerFormData] = useState({
    name: '',
    logo_url: '',
    display_order: 1,
    is_active: 1
  });

  const loadSlides = async () => {
    setLoading(true);
    const data = await fetchAdminSlides();
    setSlides(data);
    setLoading(false);
  };

  const loadPartners = async () => {
    setLoading(true);
    const data = await fetchAdminPartners();
    setPartners(data);
    setLoading(false);
  };

  const loadBannerSettings = async () => {
    setLoading(true);
    try {
      const response = await fetchFlashSaleBannerSettings();
      if (response.success) {
        setBannerSettings(response.data);
      } else {
        console.error('Failed to load banner settings:', response.message);
        addToast('Failed to load banner settings', 'error');
      }
    } catch (error) {
      console.error('Error loading banner settings:', error);
      addToast('Error loading banner settings', 'error');
    }
    setLoading(false);
  };

  const user = JSON.parse(localStorage.getItem('ehub_user') || '{}');
  const isAccountant = user.role === 'accountant';

  useEffect(() => {
    if (!isAccountant) {
      if (activeTab === 'hero') {
        loadSlides();
      } else if (activeTab === 'partners') {
        loadPartners();
      } else if (activeTab === 'flash_sale_banner') {
        loadBannerSettings();
      }
    }
  }, [activeTab]);

  if (isAccountant) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <Plus size={64} color="var(--danger)" style={{ marginBottom: '24px', transform: 'rotate(45deg)' }} />
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Access Denied</h1>
        <p style={{ color: 'var(--text-muted)' }}>Accounting roles do not have permission to manage store media and sliders.</p>
      </div>
    );
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const isVideoFile = file.type.startsWith('video/');
      const maxSizeMB = isVideoFile ? 15 : 5;
      
      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`${isVideoFile ? 'Video' : 'Image'} is too large. Max ${maxSizeMB}MB allowed.`);
        return;
      }
      
      if (isVideoFile) {
        // Don't compress videos
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({ ...formData, image_url: reader.result });
        };
        reader.readAsDataURL(file);
      } else {
        // Compress images
        try {
          addToast('Compressing image...', 'info');
          const compressedImage = await compressImageAuto(file);
          setFormData({ ...formData, image_url: compressedImage });
          addToast('Image compressed successfully', 'success');
        } catch (error) {
          console.error('Image compression failed:', error);
          addToast('Failed to compress image, using original', 'warning');
          // Fallback to original
          const reader = new FileReader();
          reader.onloadend = () => {
            setFormData({ ...formData, image_url: reader.result });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handlePartnerLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Logo is too large. Max 5MB');
        return;
      }
      try {
        addToast('Compressing logo...', 'info');
        const compressedImage = await compressImageAuto(file);
        setPartnerFormData({ ...partnerFormData, logo_url: compressedImage });
        addToast('Logo compressed successfully', 'success');
      } catch (error) {
        console.error('Image compression failed:', error);
        alert('Failed to compress image, using original');
        // Fallback to original
        const reader = new FileReader();
        reader.onloadend = () => {
          setPartnerFormData({ ...partnerFormData, logo_url: reader.result });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const openModal = (item = null) => {
    if (activeTab === 'hero') {
      if (item) {
        setEditingSlide(item);
        let blocks = [];
        try {
            blocks = typeof item.content_blocks === 'string' ? JSON.parse(item.content_blocks) : (item.content_blocks || []);
        } catch(e) { blocks = []; }
        
        setFormData({
          image_url: item.image_url,
          title: item.title,
          subtitle: item.subtitle,
          button_text: item.button_text,
          button_link: item.button_link,
          text_position: item.text_position || 'left',
          content_blocks: Array.isArray(blocks) ? blocks : [],
          display_order: item.display_order,
          is_active: item.is_active ? 1 : 0
        });
      } else {
        setEditingSlide(null);
        setFormData({
          image_url: '',
          title: '',
          subtitle: '',
          button_text: 'Shop Now',
          button_link: '/shop',
          text_position: 'left',
          content_blocks: [],
          display_order: slides.length + 1,
          is_active: 1
        });
      }
    } else {
      if (item) {
        setEditingPartner(item);
        setPartnerFormData({
          name: item.name,
          logo_url: item.logo_url,
          display_order: item.display_order,
          is_active: item.is_active ? 1 : 0
        });
      } else {
        setEditingPartner(null);
        setPartnerFormData({
          name: '',
          logo_url: '',
          display_order: partners.length + 1,
          is_active: 1
        });
      }
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSlide(null);
    setEditingPartner(null);
  };

  const addBlock = () => {
      setFormData(prev => ({
          ...prev,
          content_blocks: [...prev.content_blocks, { 
              text: '', 
              type: 'paragraph', 
              fontSize: '18px', 
              color: '#ffffff',
              top: '50', 
              left: '50', 
              textAlign: 'center',
              width: 'auto'
          }]
      }));
  };

  const removeBlock = (index) => {
      setFormData(prev => ({
          ...prev,
          content_blocks: prev.content_blocks.filter((_, i) => i !== index)
      }));
  };

  const updateBlock = (index, field, value) => {
      setFormData(prev => {
          const newBlocks = [...prev.content_blocks];
          newBlocks[index] = { ...newBlocks[index], [field]: value };
          return { ...prev, content_blocks: newBlocks };
      });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (activeTab === 'hero') {
      // Validate form data
      const validationErrors = validateSliderData(formData);
      if (Object.keys(validationErrors).length > 0) {
        Object.values(validationErrors).forEach(error => addToast(error, 'error'));
        return;
      }

      // Sanitize content blocks
      const sanitizedFormData = {
        ...formData,
        title: sanitizeInput(formData.title || ''),
        subtitle: sanitizeInput(formData.subtitle || ''),
        button_text: sanitizeInput(formData.button_text || ''),
        button_link: sanitizeInput(formData.button_link || ''),
        content_blocks: sanitizeContentBlocks(formData.content_blocks)
      };

      try {
        if (editingSlide) {
          await updateSlide(editingSlide.id, sanitizedFormData);
        } else {
          await createSlide(sanitizedFormData);
        }
        addToast(editingSlide ? 'Slide updated successfully' : 'Slide created successfully', 'success');
        closeModal();
        loadSlides();
      } catch (err) {
        addToast(err.message || 'Error saving slide', 'error');
      }
    } else {
      // Validate partner data
      if (partnerFormData.name && partnerFormData.name.length > 255) {
        addToast('Partner name must be less than 255 characters', 'error');
        return;
      }

      const sanitizedPartnerData = {
        ...partnerFormData,
        name: sanitizeInput(partnerFormData.name || '')
      };

      try {
        if (editingPartner) {
          await updatePartner(editingPartner.id, sanitizedPartnerData);
        } else {
          await createPartner(sanitizedPartnerData);
        }
        addToast(editingPartner ? 'Partner updated successfully' : 'Partner created successfully', 'success');
        closeModal();
        loadPartners();
      } catch (err) {
        addToast(err.message || 'Error saving partner', 'error');
      }
    }
  };

  const handleDelete = async (id) => {
    if (activeTab === 'hero') {
      if (await confirm('Are you sure you want to delete this slide?')) {
        try {
          await deleteSlide(id);
          loadSlides();
        } catch (error) {
          console.error("Delete error:", error);
          alert(error.message || 'Failed to delete slide');
        }
      }
    } else {
      if (await confirm('Are you sure you want to delete this partner?')) {
        try {
          await deletePartner(id);
          loadPartners();
        } catch (error) {
          console.error("Delete error:", error);
          alert(error.message || 'Failed to delete partner');
        }
      }
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
    }));
  };

  const handlePartnerChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPartnerFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
    }));
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
           <h1 className="page-title">{activeTab === 'hero' ? 'Hero Slider' : activeTab === 'partners' ? 'Partners Slider' : 'Flash Sale Banner'}</h1>
           <p className="page-subtitle">
             {activeTab === 'hero'
               ? 'Manage the promotional banner slides displayed at the top of your homepage.'
               : activeTab === 'partners'
               ? 'Manage the scrolling partner logo list shown at the bottom of the store.'
               : 'Configure the flash sale banner that appears on the homepage.'}
           </p>
        </div>
        {activeTab !== 'flash_sale_banner' && (
          <button onClick={() => openModal()} className="btn-primary">
            <Plus size={20} />
            {activeTab === 'hero' ? 'Add Slide' : 'Add Partner'}
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '32px',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '12px'
      }}>
        <button
          onClick={() => setActiveTab('hero')}
          style={{
            padding: '10px 24px',
            borderRadius: '12px',
            background: activeTab === 'hero' ? 'var(--primary-blue)' : 'transparent',
            color: activeTab === 'hero' ? '#white' : 'var(--text-muted)',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'hero' ? '0 4px 15px rgba(59, 130, 246, 0.2)' : 'none'
          }}
        >
          Hero Slides
        </button>
        <button
          onClick={() => setActiveTab('partners')}
          style={{
            padding: '10px 24px',
            borderRadius: '12px',
            background: activeTab === 'partners' ? 'var(--primary-blue)' : 'transparent',
            color: activeTab === 'partners' ? 'white' : 'var(--text-muted)',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'partners' ? '0 4px 15px rgba(59, 130, 246, 0.2)' : 'none'
          }}
        >
          Partner Logos
        </button>
        <button
          onClick={() => setActiveTab('flash_sale_banner')}
          style={{
            padding: '10px 24px',
            borderRadius: '12px',
            background: activeTab === 'flash_sale_banner' ? 'var(--primary-blue)' : 'transparent',
            color: activeTab === 'flash_sale_banner' ? 'white' : 'var(--text-muted)',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'flash_sale_banner' ? '0 4px 15px rgba(59, 130, 246, 0.2)' : 'none'
          }}
        >
          Flash Sale Banner
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading data...</div>
      ) : activeTab === 'flash_sale_banner' ? (
        /* FLASH SALE BANNER SETTINGS */
        <div className="card glass" style={{ padding: '32px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '24px', fontWeight: 800 }}>Flash Sale Banner Settings</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
            Configure the flash sale banner that appears on the homepage. Customize messages, thresholds, and enable/disable different content types.
          </p>

          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await updateFlashSaleBannerSettings(bannerSettings);
              addToast('Banner settings updated successfully', 'success');
            } catch (err) {
              addToast(err.message || 'Error updating settings', 'error');
            }
          }} style={{ display: 'grid', gap: '32px' }}>
              {/* General Settings */}
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', background: 'var(--bg-surface-secondary)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 800 }}>General Settings</h3>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={bannerSettings.is_enabled}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, is_enabled: e.target.checked ? 1 : 0 })}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <span style={{ fontWeight: 600 }}>Enable Flash Sale Banner</span>
                  </label>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px', marginLeft: '32px' }}>
                    When disabled, the banner will not show on the homepage
                  </p>
                </div>
              </div>

              {/* Flash Sale Settings */}
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', background: 'var(--bg-surface-secondary)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 800 }}>Flash Sale Content</h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      value={bannerSettings.flash_sale_title}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, flash_sale_title: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>Subtitle (use {'{product_name}'} for product name)</label>
                    <input
                      type="text"
                      value={bannerSettings.flash_sale_subtitle}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, flash_sale_subtitle: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>CTA Button Text</label>
                    <input
                      type="text"
                      value={bannerSettings.flash_sale_cta}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, flash_sale_cta: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* New Arrivals Settings */}
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', background: 'var(--bg-surface-secondary)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 800 }}>New Arrivals Fallback</h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={bannerSettings.new_arrivals_enabled}
                        onChange={(e) => setBannerSettings({ ...bannerSettings, new_arrivals_enabled: e.target.checked ? 1 : 0 })}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <span style={{ fontWeight: 600 }}>Enable New Arrivals</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Days Threshold (products added within X days)</label>
                    <input
                      type="number"
                      value={bannerSettings.new_arrivals_days}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, new_arrivals_days: parseInt(e.target.value) || 7 })}
                      className="input-field"
                      min="1"
                      max="30"
                    />
                  </div>
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      value={bannerSettings.new_arrivals_title}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, new_arrivals_title: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>Subtitle (use {'{count}'} for number of products)</label>
                    <input
                      type="text"
                      value={bannerSettings.new_arrivals_subtitle}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, new_arrivals_subtitle: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>CTA Button Text</label>
                    <input
                      type="text"
                      value={bannerSettings.new_arrivals_cta}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, new_arrivals_cta: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Low Stock Settings */}
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', background: 'var(--bg-surface-secondary)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 800 }}>Low Stock Alert Fallback</h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={bannerSettings.low_stock_enabled}
                        onChange={(e) => setBannerSettings({ ...bannerSettings, low_stock_enabled: e.target.checked ? 1 : 0 })}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <span style={{ fontWeight: 600 }}>Enable Low Stock Alerts</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Stock Threshold (show items with less than X in stock)</label>
                    <input
                      type="number"
                      value={bannerSettings.low_stock_threshold}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, low_stock_threshold: parseInt(e.target.value) || 5 })}
                      className="input-field"
                      min="1"
                      max="20"
                    />
                  </div>
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      value={bannerSettings.low_stock_title}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, low_stock_title: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>Subtitle (use {'{count}'} for number of items)</label>
                    <input
                      type="text"
                      value={bannerSettings.low_stock_subtitle}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, low_stock_subtitle: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>CTA Button Text</label>
                    <input
                      type="text"
                      value={bannerSettings.low_stock_cta}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, low_stock_cta: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Popular Products Settings */}
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', background: 'var(--bg-surface-secondary)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 800 }}>Trending Products Fallback</h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={bannerSettings.popular_enabled}
                        onChange={(e) => setBannerSettings({ ...bannerSettings, popular_enabled: e.target.checked ? 1 : 0 })}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <span style={{ fontWeight: 600 }}>Enable Trending Products</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      value={bannerSettings.popular_title}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, popular_title: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>Subtitle</label>
                    <input
                      type="text"
                      value={bannerSettings.popular_subtitle}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, popular_subtitle: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>CTA Button Text</label>
                    <input
                      type="text"
                      value={bannerSettings.popular_cta}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, popular_cta: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Promotion Settings */}
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', background: 'var(--bg-surface-secondary)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 800 }}>General Promotion Fallback</h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={bannerSettings.promotion_enabled}
                        onChange={(e) => setBannerSettings({ ...bannerSettings, promotion_enabled: e.target.checked ? 1 : 0 })}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <span style={{ fontWeight: 600 }}>Enable General Promotion</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      value={bannerSettings.promotion_title}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, promotion_title: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>Subtitle</label>
                    <input
                      type="text"
                      value={bannerSettings.promotion_subtitle}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, promotion_subtitle: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>CTA Button Text</label>
                    <input
                      type="text"
                      value={bannerSettings.promotion_cta}
                      onChange={(e) => setBannerSettings({ ...bannerSettings, promotion_cta: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" style={{ padding: '12px 32px', borderRadius: '12px', fontWeight: 800 }}>
                  Save Settings
                </button>
              </div>
            </form>
        </div>
      ) : activeTab === 'hero' ? (
        /* HERO SLIDES GRID */
        <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
          {slides.map(slide => (
            <div key={slide.id} className="card glass" style={{ overflow: 'hidden', padding: 0, position: 'relative' }}>
               <div style={{ height: '180px', overflow: 'hidden', position: 'relative' }}>
                  {isVideo(slide.image_url) ? (
                    <video src={formatImageUrl(slide.image_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted loop autoPlay playsInline />
                  ) : (
                    <img src={formatImageUrl(slide.image_url)} alt={slide.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    Order: {slide.display_order}
                  </div>
                  {!slide.is_active && (
                      <div style={{ position: 'absolute', top: 10, left: 10, background: 'var(--danger-bg)', color: 'var(--danger)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid var(--danger-bg)' }}>
                          Inactive
                      </div>
                  )}
               </div>
               <div style={{ padding: '16px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{slide.title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px', height: '40px', overflow: 'hidden' }}>{slide.subtitle}</p>
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={() => openModal(slide)} className="btn-secondary" style={{ flex: 1, padding: '8px' }}>
                      <Edit2 size={16} /> Edit
                    </button>
                    <button onClick={() => handleDelete(slide.id)} className="btn-danger" style={{ flex: 1, padding: '8px' }}>
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
               </div>
            </div>
          ))}
        </div>
      ) : (
        /* PARTNER LOGOS GRID */
        <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
          {partners.map(partner => (
            <div key={partner.id} className="card glass" style={{ overflow: 'hidden', padding: 0, position: 'relative' }}>
               <div style={{ 
                  height: '140px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderBottom: '1px solid var(--border-light)',
                  padding: '20px', 
                  position: 'relative' 
               }}>
                  <img src={formatImageUrl(partner.logo_url)} alt={partner.name} loading="lazy" style={{ maxHTMLWidth: '100%', maxHeight: '60px', objectFit: 'contain' }} />
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    Order: {partner.display_order}
                  </div>
                  {!partner.is_active && (
                      <div style={{ position: 'absolute', top: 10, left: 10, background: 'var(--danger-bg)', color: 'var(--danger)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid var(--danger-bg)' }}>
                          Inactive
                      </div>
                  )}
               </div>
               <div style={{ padding: '16px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, textAlign: 'center' }}>{partner.name}</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => openModal(partner)} className="btn-secondary" style={{ flex: 1, padding: '8px' }}>
                      <Edit2 size={16} /> Edit
                    </button>
                    <button onClick={() => handleDelete(partner.id)} className="btn-danger" style={{ flex: 1, padding: '8px' }}>
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
               </div>
            </div>
          ))}
          {partners.length === 0 && (
            <div className="glass card" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No partners configured. Click "Add Partner" to set up your partner marquee.
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content glass animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: activeTab === 'hero' ? '1100px' : '750px', maxWidth: '95%', padding: '32px', borderRadius: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <h2 style={{ marginTop: 0, marginBottom: '24px', fontWeight: 800 }}>
              {activeTab === 'hero' 
                ? (editingSlide ? 'Edit Slide' : 'Add New Slide') 
                : (editingPartner ? 'Edit Partner' : 'Add New Partner')}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '32px', alignItems: 'start' }}>
              
              {/* EDITING HERO SLIDE FORM */}
              {activeTab === 'hero' && (
                <>
                  <form onSubmit={handleSave} style={{ flex: '1 1 500px', display: 'grid', gap: '16px' }}>
                    <div className="form-group">
                      <label>Slide Image</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px',
                          padding: '32px', 
                          border: '2px dashed var(--border-light)', 
                          borderRadius: '8px', 
                          cursor: 'pointer',
                          background: 'var(--bg-surface-secondary)',
                          transition: 'all 0.2s',
                          position: 'relative',
                          overflow: 'hidden',
                          minHeight: '120px'
                        }}>
                          {formData.image_url ? (
                              <>
                                  <img src={formData.image_url.startsWith('data:') ? formData.image_url : formatImageUrl(formData.image_url)} alt="Preview" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
                                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px', color: 'white', fontWeight: 600 }}>
                                      <Upload size={18} /> Change Image
                                  </div>
                              </>
                          ) : (
                              <>
                                  <Upload size={20} />
                                  <span style={{ fontSize: '14px', fontWeight: 600 }}>Click to upload slide image</span>
                              </>
                          )}
                          <input 
                            type="file" 
                            accept="image/*,video/mp4,video/webm"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                        <input type="text" name="image_url" value={formData.image_url.startsWith('data:') ? 'Custom Upload' : formData.image_url} onChange={handleChange} className="input-field" placeholder="Or paste image URL here..." />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Title</label>
                      <input type="text" name="title" value={formData.title} onChange={handleChange} className="input-field" placeholder="Big Sale!" />
                    </div>

                    <div className="form-group">
                      <label>Subtitle</label>
                      <input type="text" name="subtitle" value={formData.subtitle} onChange={handleChange} className="input-field" placeholder="Get 50% off today" />
                    </div>

                    <div className="form-group">
                      <label>Text Content Position</label>
                      <select name="text_position" value={formData.text_position} onChange={handleChange} className="input-field">
                        <option value="left">Left (Default)</option>
                        <option value="right">Right</option>
                        <option value="center">Center</option>
                        <option value="top">Top Center</option>
                        <option value="bottom">Bottom Center</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ border: '1px solid var(--border-light)', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <label style={{ margin: 0, fontWeight: 700 }}>Additional Content Blocks</label>
                            <button type="button" onClick={addBlock} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }}>
                                <Plus size={14} /> Add Block
                            </button>
                        </div>
                        
                        <div style={{ display: 'grid', gap: '16px' }}>
                            {formData.content_blocks.map((block, index) => (
                                <div key={index} style={{ display: 'grid', gap: '12px', padding: '20px', background: 'var(--bg-surface-secondary)', borderRadius: '16px', border: '1px solid var(--border-light)', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Block #{index + 1}</span>
                                        <button type="button" onClick={() => removeBlock(index)} className="btn-danger" style={{ padding: '6px', borderRadius: '6px' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div className="form-group">
                                        <label style={{ fontSize: '11px' }}>Text Content</label>
                                        <input 
                                            type="text" 
                                            value={block.text} 
                                            onChange={(e) => updateBlock(index, 'text', e.target.value)} 
                                            className="input-field" 
                                            placeholder="What should this block say?" 
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                        <div className="form-group">
                                            <label style={{ fontSize: '11px' }}>Type</label>
                                            <select 
                                                value={block.type} 
                                                onChange={(e) => updateBlock(index, 'type', e.target.value)} 
                                                className="input-field"
                                                style={{ fontSize: '12px' }}
                                            >
                                                <option value="paragraph">Paragraph</option>
                                                <option value="heading">Heading</option>
                                                <option value="subheading">Sub-heading</option>
                                                <option value="cta">CTA Button</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '11px' }}>Font Size</label>
                                            <input 
                                                type="text" 
                                                value={block.fontSize} 
                                                onChange={(e) => updateBlock(index, 'fontSize', e.target.value)} 
                                                className="input-field" 
                                                placeholder="e.g. 24px"
                                                style={{ fontSize: '12px' }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '11px' }}>Color</label>
                                            <input 
                                                type="color" 
                                                value={block.color || '#ffffff'} 
                                                onChange={(e) => updateBlock(index, 'color', e.target.value)} 
                                                className="input-field"
                                                style={{ height: '38px', padding: '4px' }}
                                            />
                                        </div>
                                    </div>

                                    {block.type === 'cta' && (
                                      <div className="form-group">
                                          <label style={{ fontSize: '11px' }}>CTA Button Link</label>
                                          <div style={{ display: 'grid', gap: '8px' }}>
                                            <select 
                                              value={PREDEFINED_LINKS.some(opt => opt.value === block.link) ? block.link : 'custom'} 
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (val !== 'custom') {
                                                  updateBlock(index, 'link', val);
                                                } else {
                                                  updateBlock(index, 'link', '');
                                                }
                                              }}
                                              className="input-field"
                                              style={{ fontSize: '12px' }}
                                            >
                                              {PREDEFINED_LINKS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                              ))}
                                            </select>
                                            {(!PREDEFINED_LINKS.some(opt => opt.value === block.link) || block.link === 'custom') && (
                                              <input 
                                                type="text" 
                                                value={block.link === 'custom' ? '' : (block.link || '')} 
                                                onChange={(e) => updateBlock(index, 'link', e.target.value)} 
                                                className="input-field animate-fade-in" 
                                                placeholder="Enter custom path (e.g. /category/deals)..."
                                                style={{ fontSize: '12px' }}
                                              />
                                            )}
                                          </div>
                                      </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                                        <div className="form-group">
                                            <label style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                                              <span>Top (%)</span>
                                              <span style={{ fontWeight: 'bold' }}>{block.top || 50}%</span>
                                            </label>
                                            <input 
                                                type="range" 
                                                min="0"
                                                max="100"
                                                value={block.top || 50} 
                                                onChange={(e) => updateBlock(index, 'top', e.target.value)} 
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                                              <span>Left (%)</span>
                                              <span style={{ fontWeight: 'bold' }}>{block.left || 50}%</span>
                                            </label>
                                            <input 
                                                type="range" 
                                                min="0"
                                                max="100"
                                                value={block.left || 50} 
                                                onChange={(e) => updateBlock(index, 'left', e.target.value)} 
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '11px' }}>Alignment</label>
                                            <select 
                                                value={block.textAlign || 'center'} 
                                                onChange={(e) => updateBlock(index, 'textAlign', e.target.value)} 
                                                className="input-field"
                                                style={{ fontSize: '12px' }}
                                            >
                                                <option value="left">Left</option>
                                                <option value="center">Center</option>
                                                <option value="right">Right</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {formData.content_blocks.length === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', margin: '20px 0' }}>No custom text blocks. Only main Title/Subtitle will show.</p>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                          <label>Button Text</label>
                          <input type="text" name="button_text" value={formData.button_text} onChange={handleChange} className="input-field" />
                      </div>
                      <div className="form-group">
                          <label>Button Link</label>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            <select 
                              value={PREDEFINED_LINKS.some(opt => opt.value === formData.button_link) ? formData.button_link : 'custom'} 
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val !== 'custom') {
                                  setFormData(prev => ({ ...prev, button_link: val }));
                                } else {
                                  setFormData(prev => ({ ...prev, button_link: '' }));
                                }
                              }}
                              className="input-field"
                            >
                              {PREDEFINED_LINKS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            {(!PREDEFINED_LINKS.some(opt => opt.value === formData.button_link) || formData.button_link === 'custom') && (
                              <input 
                                type="text" 
                                name="button_link" 
                                value={formData.button_link === 'custom' ? '' : formData.button_link} 
                                onChange={handleChange} 
                                className="input-field animate-fade-in" 
                                placeholder="Enter custom path (e.g. /category/electronics)..." 
                              />
                            )}
                          </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                          <label>Display Order</label>
                          <input type="number" name="display_order" value={formData.display_order} onChange={handleChange} className="input-field" />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '30px' }}>
                          <input type="checkbox" name="is_active" checked={formData.is_active === 1} onChange={handleChange} id="active_check" style={{ width: '20px', height: '20px' }} />
                          <label htmlFor="active_check" style={{ margin: 0, cursor: 'pointer' }}>Active</label>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                      <button type="button" onClick={closeModal} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                      <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Slide</button>
                    </div>
                  </form>

                  {/* Visual Preview for Hero Slide */}
                  <div style={{ flex: '1 1 400px', display: 'grid', gap: '20px', position: 'sticky', top: '10px' }}>
                    <div style={{ background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)', borderRadius: '24px', padding: '24px' }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 800 }}>Live Visual Preview</h3>
                      
                      <div style={{ 
                        position: 'relative', 
                        width: '100%', 
                        aspectRatio: '16/9', 
                        borderRadius: '16px', 
                        overflow: 'hidden', 
                        backgroundImage: formData.image_url && !isVideo(formData.image_url) ? `url(${formData.image_url.startsWith('data:') ? formData.image_url : formatImageUrl(formData.image_url)})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundColor: '#1a1a2e',
                        border: '1px solid var(--border-light)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                        transition: 'all 0.3s'
                      }}>
                        {isVideo(formData.image_url) && (
                           <video 
                              src={formData.image_url.startsWith('data:') ? formData.image_url : formatImageUrl(formData.image_url)}
                              autoPlay loop muted playsInline
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
                           />
                        )}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          zIndex: 1,
                          width: '100%',
                          height: '100%',
                          background: (() => {
                            const pos = formData.text_position || 'left';
                            if (pos === 'left') return 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 100%)';
                            if (pos === 'right') return 'linear-gradient(to left, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 100%)';
                            if (pos === 'center') return 'radial-gradient(circle, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 80%)';
                            if (pos === 'top') return 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 100%)';
                            if (pos === 'bottom') return 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 100%)';
                            return 'rgba(0,0,0,0.4)';
                          })(),
                          display: 'flex',
                          justifyContent: (() => {
                            const pos = formData.text_position || 'left';
                            if (pos === 'left') return 'flex-start';
                            if (pos === 'right') return 'flex-end';
                            return 'center';
                          })(),
                          alignItems: (() => {
                            const pos = formData.text_position || 'left';
                            if (pos === 'top') return 'flex-start';
                            if (pos === 'bottom') return 'flex-end';
                            return 'center';
                          })(),
                          padding: '24px',
                          boxSizing: 'border-box'
                        }}>
                          <div style={{ 
                            maxWidth: '80%', 
                            color: 'white', 
                            textAlign: (() => {
                              const pos = formData.text_position || 'left';
                              if (pos === 'left') return 'left';
                              if (pos === 'right') return 'right';
                              return 'center';
                            })()
                          }}>
                            {formData.title && (
                              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px 0', lineHeight: 1.1 }}>
                                {formData.title}
                              </h2>
                            )}
                            {formData.subtitle && (
                              <p style={{ fontSize: '11px', margin: '0 0 10px 0', opacity: 0.9 }}>
                                {formData.subtitle}
                              </p>
                            )}
                            {formData.button_text && (
                              <span className="btn-primary" style={{ padding: '4px 12px', fontSize: '10px', display: 'inline-block', cursor: 'default', pointerEvents: 'none' }}>
                                {formData.button_text}
                              </span>
                            )}
                          </div>

                          {formData.content_blocks.map((block, i) => {
                            const top = parseFloat(block.top) || 50;
                            const left = parseFloat(block.left) || 50;
                            const blockStyle = {
                              position: 'absolute',
                              top: `${top}%`,
                              left: `${left}%`,
                              transform: 'translate(-50%, -50%)',
                              fontSize: block.fontSize ? `calc(${block.fontSize} * 0.7)` : '11px',
                              color: block.color || '#ffffff',
                              textAlign: block.textAlign || 'center',
                              fontWeight: block.type === 'heading' ? 800 : (block.type === 'subheading' ? 600 : 400),
                              lineHeight: 1.3,
                              maxWidth: '90%',
                              zIndex: 5,
                              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                              pointerEvents: 'none',
                              whiteSpace: 'nowrap'
                            };
                            if (block.type === 'cta') {
                              return (
                                <span key={i} className="btn-primary" style={{ ...blockStyle, padding: '3px 10px', fontSize: '9px' }}>
                                  {block.text || 'Learn More'}
                                </span>
                              );
                            }
                            return <span key={i} style={blockStyle}>{block.text || `Block #${i+1}`}</span>;
                          })}
                        </div>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: '12px 0 0 0' }}>
                        💡 Slide coordinates are live! Drag top/left sliders to instantly reposition.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* EDITING PARTNER LOGO FORM */}
              {activeTab === 'partners' && (
                <>
                  <form onSubmit={handleSave} style={{ flex: '1 1 400px', display: 'grid', gap: '16px' }}>
                    <div className="form-group">
                      <label>Partner Logo</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px',
                          padding: '32px', 
                          border: '2px dashed var(--border-light)', 
                          borderRadius: '8px', 
                          cursor: 'pointer',
                          background: 'var(--bg-surface-secondary)',
                          transition: 'all 0.2s',
                          position: 'relative',
                          overflow: 'hidden',
                          minHeight: '120px'
                        }}>
                          {partnerFormData.logo_url ? (
                              <>
                                  <img src={partnerFormData.logo_url.startsWith('data:') ? partnerFormData.logo_url : formatImageUrl(partnerFormData.logo_url)} alt="Logo Preview" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.3 }} />
                                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px', color: 'white', fontWeight: 600 }}>
                                      <Upload size={18} /> Change Logo
                                  </div>
                              </>
                          ) : (
                              <>
                                  <Upload size={20} />
                                  <span style={{ fontSize: '14px', fontWeight: 600 }}>Click to upload partner logo</span>
                              </>
                          )}
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handlePartnerLogoUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                        <input type="text" name="logo_url" value={partnerFormData.logo_url.startsWith('data:') ? 'Custom Upload' : partnerFormData.logo_url} onChange={handlePartnerChange} className="input-field" placeholder="Or paste logo URL here..." />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Partner Name</label>
                      <input type="text" name="name" value={partnerFormData.name} onChange={handlePartnerChange} className="input-field" placeholder="e.g. SecurePay Africa" required />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                          <label>Display Order</label>
                          <input type="number" name="display_order" value={partnerFormData.display_order} onChange={handlePartnerChange} className="input-field" />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '30px' }}>
                          <input type="checkbox" name="is_active" checked={partnerFormData.is_active === 1} onChange={handlePartnerChange} id="partner_active_check" style={{ width: '20px', height: '20px' }} />
                          <label htmlFor="partner_active_check" style={{ margin: 0, cursor: 'pointer' }}>Active</label>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                      <button type="button" onClick={closeModal} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                      <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Partner</button>
                    </div>
                  </form>

                  {/* Visual Preview for Partner Logo */}
                  <div style={{ flex: '1 1 250px', display: 'grid', gap: '20px', position: 'sticky', top: '10px' }}>
                    <div style={{ background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)', borderRadius: '24px', padding: '24px' }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 800 }}>Logo Marquee Preview</h3>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        padding: '30px 20px', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        borderRadius: '16px', 
                        border: '1px solid var(--border-light)', 
                        minHeight: '120px',
                        backdropFilter: 'blur(10px)',
                        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)'
                      }}>
                        {partnerFormData.logo_url ? (
                          <img 
                            src={partnerFormData.logo_url.startsWith('data:') ? partnerFormData.logo_url : formatImageUrl(partnerFormData.logo_url)} 
                            alt="Preview" 
                            style={{ maxHeight: '55px', maxWidth: '100%', objectFit: 'contain' }} 
                          />
                        ) : (
                          <span style={{ 
                            fontSize: '18px', 
                            fontWeight: 800, 
                            color: 'var(--text-muted)',
                            opacity: 0.6
                          }}>
                            {partnerFormData.name || 'Partner Logo'}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: '12px 0 0 0' }}>
                        This is how the logo will render on the storefront partner glass band.
                      </p>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
