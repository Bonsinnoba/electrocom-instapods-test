import React, { useState, useEffect, useRef } from 'react';
import { Menu, Search, Map, ShoppingCart, Moon, Sun, X, ExternalLink, ArrowRight, Bell } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';
import { useSettings } from '../context/SettingsContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatImageUrl } from '../services/api';
import {
  applySynonymsToQuery,
  normalizeSearchText,
  isFuzzyPartMatch,
  rememberSearch,
  getRecentSearches,
} from '../utils/searchUtils';


export default function Navbar({
  onLoginClick,
  onMapClick,
  onMenuClick,
  onThemeToggle,
  onProductClick,
  onNotificationsClick,
  isDarkMode,
  searchQuery = '',
  setSearchQuery,
  products = []
}) {
  const { siteSettings } = useSettings();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { unreadCount } = useNotifications();
  const { user } = useUser();

  const pages = [
    { name: 'Shop All Products', path: '/shop', icon: '🛍️' },
    { name: 'My Orders & History', path: '/orders', icon: '📦' },
    { name: 'Transactions & Billing', path: '/transactions', icon: '🧾' },
    { name: 'My Favorites', path: '/favorites', icon: '❤️' },
    { name: 'Settings & Privacy', path: '/settings', icon: '⚙️' },
    { name: 'Customer Support', path: '/support', icon: '🎧' },
    { name: 'User Profile', path: '/profile', icon: '👤' },
  ];

  const productPages = ['/', '/shop', '/favorites', '/cart', '/checkout', '/transactions', '/orders'];
  const isProductPage = productPages.includes(location.pathname);

  const results = React.useMemo(() => {
    if (!searchQuery?.trim()) return { pages: [], products: [] };
    const effective = applySynonymsToQuery(searchQuery).toLowerCase().trim();
    const q = effective;
    const normalizedQuery = normalizeSearchText(q);

    return {
      pages: pages.filter((p) => p.name.toLowerCase().includes(q)),
      products: products
        .filter((p) => {
          const name = (p.name || '').toLowerCase();
          const code = (p.product_code || '').toLowerCase();
          const exact = name.includes(q) || (code && code.includes(q));
          const fuzzy =
            !exact &&
            (isFuzzyPartMatch(normalizedQuery, name) ||
              isFuzzyPartMatch(normalizedQuery, code));
          return exact || fuzzy;
        })
        .slice(0, 5),
    };
  }, [searchQuery, products]);

  const recentSearches = React.useMemo(() => (isProductPage ? getRecentSearches() : []), [isProductPage, searchQuery]);

  const hasResults = results.pages.length > 0 || results.products.length > 0;
  const showRecentRow = isProductPage && isFocused && !String(searchQuery || '').trim() && recentSearches.length > 0;
  const showSearchDropdown = isFocused && (hasResults || showRecentRow);
  const searchPlaceholder = isProductPage ? "Search for products..." : "Search settings & notifications...";

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
        setIsFocused(false);
      }
    }

    if (isSearchOpen || isFocused) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen, isFocused]);

  return (
    <nav className="top-nav" aria-label="Main Navigation">
      <div className="sidebar-icon btn" id="toggle-menu" style={{ margin: 0 }} onClick={onMenuClick} role="button" aria-label="Toggle Side Menu" tabIndex={0}>
        <Menu size={20} />
      </div>
      
      <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
        {siteSettings.siteLogoUrl ? (
          <img
            src={formatImageUrl(siteSettings.siteLogoUrl)}
            className={`nav-logo ${isSearchOpen ? 'hidden-mobile' : ''}`}
            alt={siteSettings.siteName}
            width="120"
            height="40"
            style={{ maxHeight: '40px', objectFit: 'contain', aspectRatio: '3/1' }}
          />
        ) : (
          <div className={`nav-logo-text ${isSearchOpen ? 'hidden-mobile' : ''}`} style={{ fontWeight: 900, fontSize: '20px', color: 'var(--primary-blue)' }}>
            {siteSettings.siteName}
          </div>
        )}
      </Link>
      
      <div ref={searchRef} className={`search-container ${isSearchOpen ? 'active' : ''}`}>
        <Search className="search-icon" size={18} />
        <input 
          type="text" 
          id="search-input" 
          placeholder={searchPlaceholder} 
          aria-label="Search products and sections"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && String(searchQuery || '').trim()) {
              rememberSearch(searchQuery);
            }
          }}
          onFocus={() => setIsFocused(true)}
          autoComplete="off"
        />
        {searchQuery && (
          <div 
            className="search-clear-btn" 
            onClick={() => setSearchQuery('')}
          >
            <X size={16} />
          </div>
        )}

        {/* Search Results Dropdown */}
        {showSearchDropdown && (
          <div className="search-results-dropdown glass animate-fade-in">
            {showRecentRow && (
              <div className="results-section">
                <div className="section-label">Recent searches</div>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="result-item"
                    style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setSearchQuery(term);
                      setIsFocused(true);
                    }}
                  >
                    <div className="result-info">
                      <span className="result-name">{term}</span>
                      <span className="result-meta">Search again</span>
                    </div>
                    <ArrowRight size={14} className="result-arrow" />
                  </button>
                ))}
              </div>
            )}
            {results.pages.length > 0 && (
              <div className="results-section">
                <div className="section-label">Sections</div>
                {results.pages.map(page => (
                  <Link 
                    key={page.path} 
                    to={page.path} 
                    className="result-item"
                    onClick={() => {
                      setSearchQuery('');
                      setIsFocused(false);
                      setIsSearchOpen(false);
                    }}
                  >
                    <span className="result-icon">{page.icon}</span>
                    <div className="result-info">
                      <span className="result-name">{page.name}</span>
                      <span className="result-meta">Navigate to page</span>
                    </div>
                    <ArrowRight size={14} className="result-arrow" />
                  </Link>
                ))}
              </div>
            )}

            {results.products.length > 0 && (
              <div className="results-section">
                <div className="section-label">Products</div>
                {results.products.map(product => (
                  <div 
                    key={product.id} 
                    className="result-item"
                    onClick={() => {
                      rememberSearch(searchQuery || product.name);
                      if (onProductClick) {
                        onProductClick(product);
                      } else {
                        navigate('/shop');
                        setSearchQuery(product.name);
                      }
                      setIsFocused(false);
                      setIsSearchOpen(false);
                    }}
                  >
                    <img src={product.image || product.image_url} alt={product.name} className="result-thumb" loading="lazy" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '10px' }} />
                    <div className="result-info">
                      <span className="result-name">{product.name}</span>
                      <span className="result-meta">GH₵{Number(product.price || 0).toFixed(2)} • View Details</span>
                    </div>
                    <ArrowRight size={14} className="result-arrow" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mobile-search-close" onClick={() => setIsSearchOpen(false)}>
          <X size={20} />
        </div>
      </div>

      <div className="nav-actions">
        {/* Mobile Search Toggle */}
        <div 
          className="sidebar-icon mobile-nav-icon btn" 
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          role="button"
          aria-label="Toggle Search"
          tabIndex={0}
        >
          <Search size={20} />
        </div>
        
        {/* Mobile Map Toggle - hidden on mobile; Map is in the sidebar */}
        <div className="sidebar-icon btn nav-map-btn" onClick={onMapClick} role="button" aria-label="Open Store Locations" tabIndex={0}>
          <Map size={20} />
        </div>
        
        {/* Notifications */}
        <div className="sidebar-icon btn nav-notif-btn" style={{ position: 'relative' }} onClick={onNotificationsClick} role="button" aria-label={`View Notifications, ${unreadCount} unread`} tabIndex={0}>
          <Bell size={20} />
          {unreadCount > 0 && (
            <span key={unreadCount} className="badge-premium badge-notif">
              {unreadCount}
            </span>
          )}
        </div>
        
        {/* Mobile Cart Link */}
        <Link 
          to={user ? "/cart" : "#"} 
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              onLoginClick('Please login to view your cart');
            }
          }}
          className="sidebar-icon btn" 
          style={{ position: 'relative' }}
        >
          <ShoppingCart size={20} />
          {cartCount > 0 && (
            <span key={cartCount} className="badge-premium badge-cart">
              {cartCount}
            </span>
          )}
        </Link>
        
        <div className="sidebar-icon btn" id="theme-toggle" onClick={onThemeToggle} role="button" aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"} tabIndex={0}>
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </div>
        
        {user ? (
          <Link 
            to="/profile" 
            className="profile-nav-link btn" 
            style={{ 
              background: 'var(--primary-blue)', 
              color: 'white', 
              borderRadius: '24px', 
              padding: '4px 16px 4px 4px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              textDecoration: 'none', 
              height: '42px', 
              width: 'auto',
              flexShrink: 0
            }}
          >
            <div style={{ 
              width: '34px', 
              height: '34px', 
              borderRadius: '50%', 
              background: user.profileImage ? 'transparent' : 'white', 
              color: 'var(--primary-blue)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 800, 
              fontSize: '13px',
              border: '2px solid white',
              flexShrink: 0,
              overflow: 'hidden',
              position: 'relative'
            }}>
              {user.profileImage ? (
                <img 
                  src={user.profileImage} 
                  alt={user.name} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    borderRadius: '50%' 
                  }} 
                />
              ) : (
                user.avatar || user.name?.charAt(0) || 'U'
              )}
            </div>
            <span className="navbar-user-name" style={{ fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {user.name?.split(' ')?.[0] || 'User'}
            </span>
          </Link>
        ) : (
          <button className="btn-login btn" id="btn-login" onClick={onLoginClick}>Login</button>
        )}
      </div>
    </nav>
  );
}