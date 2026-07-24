import React from 'react';
import { Twitter, Instagram, Facebook, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import TransitionLink from './TransitionLink';

export default function Footer() {
  const { siteSettings } = useSettings();
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-grid">

          {/* Company Info */}
          <div className="footer-column company-column">
            <div className="footer-logo word-logo" style={{ marginBottom: '20px', justifyContent: 'center' }}>
              <span className="word-logo-main">{siteSettings.siteName.split(' ')[0]}</span>
              <span className="word-logo-sub">{siteSettings.siteName.split(' ').slice(1).join(' ')}</span>
              <div className="logo-indicator"></div>
            </div>
            <p className="footer-description">Your trusted destination for premium electronics and cutting-edge technology.</p>
            <div className="footer-social">
              {siteSettings.socialTwitter && (
                <a href={siteSettings.socialTwitter} className="social-link" target="_blank" rel="noopener noreferrer" data-tooltip="Twitter" data-tooltip-pos="top" aria-label="Twitter Header Link">
                  <Twitter size={20} color="#1DA1F2" />
                </a>
              )}
              {siteSettings.socialInstagram && (
                <a href={siteSettings.socialInstagram} className="social-link" target="_blank" rel="noopener noreferrer" data-tooltip="Instagram" data-tooltip-pos="top" aria-label="Instagram Footer Link">
                  <Instagram size={20} color="#E1306C" />
                </a>
              )}
              {siteSettings.socialFacebook && (
                <a href={siteSettings.socialFacebook} className="social-link" target="_blank" rel="noopener noreferrer" data-tooltip="Facebook" data-tooltip-pos="top" aria-label="Facebook Footer Link">
                  <Facebook size={20} color="#1877F2" />
                </a>
              )}
              {siteSettings.socialYoutube && (
                <a href={siteSettings.socialYoutube} className="social-link" target="_blank" rel="noopener noreferrer" data-tooltip="YouTube" data-tooltip-pos="top" aria-label="YouTube Footer Link">
                  <Youtube size={20} color="#FF0000" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-column">
            <h4 className="footer-heading">Quick Links</h4>
            <ul className="footer-links">
              <li><TransitionLink to="/">Home</TransitionLink></li>
              <li><TransitionLink to="/shop">Shop</TransitionLink></li>
              <li><TransitionLink to="/favorites">Favorites</TransitionLink></li>
              <li><TransitionLink to="/transactions">Transactions</TransitionLink></li>
              <li><TransitionLink to="/returns">Return Policy</TransitionLink></li>
            </ul>
          </div>

          {/* Support */}
          <div className="footer-column">
            <h4 className="footer-heading">Support</h4>
            <ul className="footer-links">
              <li><TransitionLink to="/about">About Us</TransitionLink></li>
              <li><TransitionLink to="/shop">Shop Products</TransitionLink></li>
              <li><TransitionLink to="/faq">FAQ</TransitionLink></li>
              <li><TransitionLink to="/track">Track Order</TransitionLink></li>
              <li><TransitionLink to="/support">Contact Support</TransitionLink></li>
            </ul>
          </div>

        </div>

        {/* 3-Column Contact Row */}
        <div className="footer-contact-row">
            <div className="contact-item">
              <Mail size={24} />
              <div>
                <strong>Email Us</strong>
                <span>{siteSettings.siteEmail}</span>
              </div>
            </div>
            <div className="contact-item">
              <Phone size={24} />
              <div>
                <strong>Call Us</strong>
                <span>{siteSettings.phone1} / {siteSettings.phone2}</span>
              </div>
            </div>
            <div className="contact-item">
              <MapPin size={24} />
              <div>
                <strong>Visit Us</strong>
                <span>{siteSettings.storeAddress || 'Ghana'}</span>
                {siteSettings.businessHours && <div style={{ fontSize: '11px', opacity: 0.7 }}>{siteSettings.businessHours}</div>}
              </div>
            </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} {siteSettings.siteName}. All rights reserved.</p>
          <div className="footer-bottom-links">
            <TransitionLink to="/privacy-policy">Privacy Policy</TransitionLink>
            <span>•</span>
            <TransitionLink to="/terms-of-service">Terms of Service</TransitionLink>
            <span>•</span>
            <TransitionLink to="/cookie-policy">Cookie Policy</TransitionLink>
          </div>
        </div>

      </div>
    </footer>
  );
}
