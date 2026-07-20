import React, { useState, useEffect, useRef, Component, lazy, Suspense } from 'react'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import PartnersMarquee from './components/PartnersMarquee'
import RecentlyViewedProducts from './components/RecentlyViewedProducts'
import CookieConsent from './components/CookieConsent'
import { X } from 'lucide-react'
import BackToTop from './components/BackToTop'
import { secureStorage } from './utils/secureStorage';

import { CartProvider, useCart } from './context/CartContext';
import { WishlistProvider, useWishlist } from './context/WishlistContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { UserProvider } from './context/UserContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { ComparisonProvider } from './context/ComparisonContext';
import CompareBar from './components/CompareBar';
import CompareModal from './components/CompareModal';

import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
const ProductModal = lazy(() => import('./components/ProductModal'));
const MapCard = lazy(() => import('./components/MapCard'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const Drawer = lazy(() => import('./components/Drawer'));
const ToastContainer = lazy(() => import('./components/ToastContainer'));

const Cart = lazy(() => import('./pages/Cart'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Profile = lazy(() => import('./pages/Profile'));
const Checkout = lazy(() => import('./pages/Checkout'));
import { fetchOrders, fetchProducts, socialAuthExchange, fetchCSRFToken } from './services/api';
import { useUser } from './context/UserContext';
import { formatRelativeTime, formatDate } from './utils/dateFormatter';
import MaintenancePage from './pages/MaintenancePage';
const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const Orders = lazy(() => import('./pages/Orders'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Support = lazy(() => import('./pages/Support'));
const Settings = lazy(() => import('./pages/Settings'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const ShippingInfo = lazy(() => import('./pages/ShippingInfo'));
const Returns = lazy(() => import('./pages/Returns'));
const FAQ = lazy(() => import('./pages/FAQ'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const TrackOrder = lazy(() => import('./pages/TrackOrder'));
const CMSPage = lazy(() => import('./pages/CMSPage'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Locations = lazy(() => import('./pages/Locations'));

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      window.scrollTo(0, 0);
      prevPathname.current = pathname;
    }
  }, [pathname]);

  return null;
};

const RouteLoader = ({ children }) => (
  <Suspense fallback={<div className="loading-state">Loading page...</div>}>
    {children}
  </Suspense>
);

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser, login: handleContextLogin, logout, authModal, openAuthModal, closeAuthModal } = useUser();
  const { siteSettings, formatPrice } = useSettings();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const lastFetchRef = React.useRef(0);
  const processingSocialAuthRef = useRef(null);
  const hasCheckedMaintenance = useRef(false);
  const hasFetchedCSRF = useRef(false);
  const hasLoadedProducts = useRef(false);

  // Check maintenance mode from backend
  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const checkMaintenance = async () => {
      try {
        const res = await fetch(`${API_BASE}/get_products.php?limit=1`, {
          // Note: credentials 'include' ensures cookies are sent automatically
        });
        if (res.status === 503) {
          setIsMaintenanceMode(true);
        } else {
          setIsMaintenanceMode(false);
        }
      } catch (error) {
        console.warn('Failed to check maintenance mode:', error);
      }
    };
    if (!hasCheckedMaintenance.current) {
      hasCheckedMaintenance.current = true;
      checkMaintenance();
    }
    const intervalId = setInterval(checkMaintenance, 300000); // re-check every 5 minutes
    return () => clearInterval(intervalId);
  }, []);

  const [redirectPath, setRedirectPath] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState(null); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('theme') === 'dark';
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when loading theme');
      }
      return false;
    }
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]); // Start empty, fetch from API
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);

  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addToast, addNotification, notifications, deleteNotification } = useNotifications();
  const maintenanceRef = useRef(isMaintenanceMode);

  // Handle social login redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const socialAuthCode = params.get('social_auth');
    const token = params.get('social_token');
    const encodedUser = params.get('social_user');
    const error = params.get('social_error');

    if (socialAuthCode) {
      if (processingSocialAuthRef.current === socialAuthCode) {
        return;
      }
      processingSocialAuthRef.current = socialAuthCode;

      // Clean up the URL parameter immediately to prevent duplicate runs on render
      navigate('/', { replace: true });

      socialAuthExchange(socialAuthCode).then(res => {
        if (res && res.success && res.data) {
          const { token: authToken, user: rawUser } = res.data;
          const userObj = {
            id: rawUser.id,
            name: rawUser.name,
            email: rawUser.email,
            phone: rawUser.phone || '',
            address: rawUser.address || '',
            level: rawUser.level || 1,
            levelName: rawUser.levelName || rawUser.level_name || 'Starter',
            avatar: rawUser.avatar_text || rawUser.avatar || (rawUser.name ? rawUser.name.slice(0, 2).toUpperCase() : '??'),
            profileImage: rawUser.profileImage || rawUser.profile_image || null,
            role: rawUser.role || 'customer',
            email_notif: rawUser.email_notif !== undefined ? Boolean(rawUser.email_notif) : true,
            push_notif: rawUser.push_notif !== undefined ? Boolean(rawUser.push_notif) : true,
            sms_tracking: rawUser.sms_tracking !== undefined ? Boolean(rawUser.sms_tracking) : true,
            theme: rawUser.theme || 'blue',
          };
          // Pass both user and token to the centralized login handler
          handleContextLogin(userObj, authToken);
          addToast("Login successful!", "success");
        } else {
          addToast(res?.message || "Failed to complete social sign-in.", "error");
        }
      }).catch(err => {
        console.error('Failed to exchange social auth code:', err);
        addToast("Failed to complete social sign-in.", "error");
      });
    } else if (token && encodedUser) {
      try {
        const rawUser = JSON.parse(atob(decodeURIComponent(encodedUser)));
        const userObj = {
          id: rawUser.id,
          name: rawUser.name,
          email: rawUser.email,
          phone: rawUser.phone || '',
          address: rawUser.address || '',
          level: rawUser.level || 1,
          levelName: rawUser.level_name || 'Starter',
          avatar: rawUser.avatar_text || (rawUser.name ? rawUser.name.slice(0, 2).toUpperCase() : '??'),
          profileImage: rawUser.profile_image || null,
          role: rawUser.role || 'customer',
          email_notif: rawUser.email_notif !== undefined ? Boolean(rawUser.email_notif) : true,
          push_notif: rawUser.push_notif !== undefined ? Boolean(rawUser.push_notif) : true,
          sms_tracking: rawUser.sms_tracking !== undefined ? Boolean(rawUser.sms_tracking) : true,
          theme: rawUser.theme || 'blue',
        };
        // Pass both user and token to the centralized login handler
        handleContextLogin(userObj, token);
        addToast("Login successful!", "success");
        // Clear the URL immediately to prevent re-processing and clean history
        navigate('/', { replace: true });
      } catch (e) {
        console.error('Failed to parse social user:', e);
      }
    } else if (error) {
      addToast(decodeURIComponent(error), "error");
      navigate('/', { replace: true });
    }
  }, [navigate, handleContextLogin, addToast, addNotification]);

  useEffect(() => {
    maintenanceRef.current = isMaintenanceMode;
  }, [isMaintenanceMode]);

  useEffect(() => {
    try {
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when saving theme');
      }
    }
    document.documentElement.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('dark-mode', isDarkMode);
  }, [isDarkMode]);

  // Fetch CSRF token on app initialization
  useEffect(() => {
    if (!hasFetchedCSRF.current) {
      hasFetchedCSRF.current = true;
      fetchCSRFToken().then(token => {
        if (token) {
          sessionStorage.setItem('csrf_token', token);
        }
      });
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

  // Apply dynamic site branding
  useEffect(() => {
    const { primaryColor, accentColor, headerBg, fontFamily, siteName, siteTagline, metaDescription, faviconUrl } = siteSettings;
    const hoverColors = calculateHoverColors(
      primaryColor || '#3B82F6',
      accentColor || '#f59e0b',
      headerBg || '#0f172a'
    );

    if (primaryColor) {
      document.documentElement.style.setProperty('--primary-blue', primaryColor);
      document.documentElement.style.setProperty('--primary-blue-hover', `${primaryColor}CC`);
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '59, 130, 246';
      };
      document.documentElement.style.setProperty('--primary-blue-rgb', hexToRgb(primaryColor));
    }

    if (accentColor) {
      document.documentElement.style.setProperty('--primary-gold', accentColor);
    }

    if (headerBg) {
      document.documentElement.style.setProperty('--top-nav-bg', headerBg);
    }

    // Apply hover colors
    document.documentElement.style.setProperty('--button-primary-hover', hoverColors.buttonPrimaryHover);
    document.documentElement.style.setProperty('--button-secondary-hover', hoverColors.buttonSecondaryHover);
    document.documentElement.style.setProperty('--button-accent-hover', hoverColors.buttonAccentHover);
    document.documentElement.style.setProperty('--link-hover', hoverColors.linkHover);
    document.documentElement.style.setProperty('--card-hover', hoverColors.cardHover);

    if (fontFamily) {
      document.documentElement.style.setProperty('--font-main', fontFamily);
      document.body.style.fontFamily = `'${fontFamily}', sans-serif`;
    }

    if (siteName && !location.pathname.includes('/settings')) {
      const tag = (siteTagline && String(siteTagline).trim()) ? String(siteTagline).trim() : 'Shop';
      document.title = `${siteName} | ${tag}`;
    }

    if (metaDescription && String(metaDescription).trim()) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', String(metaDescription).trim());
    }

    if (faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    }
  }, [siteSettings, location.pathname]);

  const productsRef = useRef(products);

  useEffect(() => {
      productsRef.current = products;
  }, [products]);

  const loadProducts = async () => {
    try {
      if (productsRef.current.length === 0) setLoading(true);
      
      const mappedProducts = await fetchProducts();
      if (mappedProducts && Array.isArray(mappedProducts)) {
          
          setProducts(prevProducts => {
            const isDifferent = JSON.stringify(prevProducts) !== JSON.stringify(mappedProducts);
            return isDifferent ? mappedProducts : prevProducts;
          });
          
          lastFetchRef.current = Date.now();

          if (mappedProducts.length === 0 && productsRef.current.length === 0) {
             addToast("Product catalog is currently empty", "info");
          }
      } else {
          throw new Error("Invalid data format from server");
      }
    } catch (error) {
      if (error.maintenance) {
        setIsMaintenanceMode(true);
        return; 
      }
      if (productsRef.current.length === 0 && !maintenanceRef.current) {
          console.error(`API Error: ${error.message}`);
      }
    } finally {
      if (productsRef.current.length === 0) setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedProducts.current) {
      hasLoadedProducts.current = true;
      loadProducts();
    }
    const handleFocus = () => {
        if (Date.now() - lastFetchRef.current > 30000) {
            loadProducts();
        }
    };
    window.addEventListener('focus', handleFocus);
    return () => {
        window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const selectedProductRef = useRef(selectedProduct);
  useEffect(() => {
    selectedProductRef.current = selectedProduct;
  }, [selectedProduct]);

  useEffect(() => {
    if (selectedProductRef.current) {
      const latest = products.find(p => p.id === selectedProductRef.current.id);
      if (latest && JSON.stringify(latest) !== JSON.stringify(selectedProductRef.current)) {
        setSelectedProduct(latest);
      }
    }
  }, [products]);

  // Listen for global 401 Unauthorized events from apiFetch
  useEffect(() => {
    const handleUnauthorized = () => {
        if (user) {
            logout();
            addToast("Session expired. Please login again.", "info");
        }
    };
    
    // Custom event dispatched from api.js when a 401 response is received
    window.addEventListener('auth_unauthorized', handleUnauthorized);
    
    return () => {
        window.removeEventListener('auth_unauthorized', handleUnauthorized);
    };
  }, [user, logout, addToast]);

  useEffect(() => {
    if (user && activeDrawer === 'orders') {
        const loadOrders = async () => {
            try {
                const data = await fetchOrders(user.id);
                setOrders(data);
            } catch (error) {
                console.warn('Failed to load orders:', error);
            }
        };
        loadOrders();
    }
  }, [user, activeDrawer]);

  // Track site visits (only once per session across all tabs)
  useEffect(() => {
    const trackVisit = async () => {
      try {
        // Check if already tracked in this session (shared across tabs via localStorage)
        const sessionStartTime = localStorage.getItem('ehub_session_start');
        const now = Date.now();
        const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

        if (sessionStartTime && (now - parseInt(sessionStartTime)) < SESSION_DURATION) {
          return; // Already tracked within session duration
        }

        // Get or generate visitor ID
        let visitorId = localStorage.getItem('ehub_visitor_id');
        if (!visitorId) {
          visitorId = crypto.randomUUID();
          localStorage.setItem('ehub_visitor_id', visitorId);
        }

        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        await fetch(`${API_BASE}/track_visit.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitor_id: visitorId,
            user_id: user?.id || null
          })
        });

        // Mark session as tracked with timestamp
        localStorage.setItem('ehub_session_start', now.toString());
      } catch (error) {
        console.warn('Failed to track visit:', error);
      }
    };

    trackVisit();
  }, [user]);

  const closeDrawers = () => setActiveDrawer(null);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  // Phase 7: Track product views locally for personalized sorting
  const handleProductClick = (product) => {
    setSelectedProduct(product);
    try {
      const historyStr = localStorage.getItem('ehub_view_history');
      const history = historyStr ? JSON.parse(historyStr) : {};
      history[product.id] = (history[product.id] || 0) + 1;
      localStorage.setItem('ehub_view_history', JSON.stringify(history));

      const recentStr = localStorage.getItem('ehub_recent_views');
      const recent = Array.isArray(JSON.parse(recentStr || '[]')) ? JSON.parse(recentStr || '[]') : [];
      const nextRecent = [product.id, ...recent.filter((id) => id !== product.id)].slice(0, 20);
      localStorage.setItem('ehub_recent_views', JSON.stringify(nextRecent));

      const categoryStr = localStorage.getItem('ehub_category_affinity');
      const categoryAffinity = categoryStr ? JSON.parse(categoryStr) : {};
      const categoryKey = (product.category || 'uncategorized').toLowerCase();
      categoryAffinity[categoryKey] = (categoryAffinity[categoryKey] || 0) + 1;
      localStorage.setItem('ehub_category_affinity', JSON.stringify(categoryAffinity));
    } catch (e) {
      console.warn('Failed to save view history:', e);
    }
  };

  useEffect(() => {
    const protectedRoutes = ['/settings', '/transactions', '/profile', '/orders', '/notifications', '/cart'];
    if (protectedRoutes.includes(location.pathname) && !user) {
       setRedirectPath(location.pathname);
       navigate('/');
       openAuthModal('signin');
    }
  }, [location.pathname, user, navigate]);

  useEffect(() => {
    if (user && redirectPath) {
      navigate(redirectPath);
      setRedirectPath(null);
    }
  }, [user, redirectPath, navigate]);

  const handleAddToCart = (product, qty, color) => {
    addToCart(product, qty, color);
    addToast(`Added ${product.name} to cart`, 'info');
  };

  const handleAddToWishlist = (product) => {
    toggleWishlist(product);
    const isNowIn = !isInWishlist(product.id);
    addToast(
      isNowIn ? `Added ${product.name} to wishlist` : `Removed ${product.name} from wishlist`, 
      'info'
    );
  };

  if (isMaintenanceMode || siteSettings.maintenanceMode) return <MaintenancePage />;

  return (
    <div className={`app-root ${isDarkMode ? 'dark-mode' : ''}`}>
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOrdersClick={() => setActiveDrawer('orders')} 
        onNotificationsClick={() => setActiveDrawer('notifications')} 
      />
      
      <div className="main-wrapper">
        <Navbar 
          onLoginClick={() => openAuthModal('signin')} 
          onMenuClick={toggleSidebar}
          onThemeToggle={toggleDarkMode}
          onProductClick={handleProductClick}
          onNotificationsClick={() => setActiveDrawer('notifications')}
          isDarkMode={isDarkMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          products={products}
        />

        <ScrollToTop />

        <main className="dashboard-grid full-width">
          <Routes>
            <Route path="/" element={<RouteLoader><Home products={products} onProductClick={handleProductClick} searchQuery={searchQuery} loading={loading} /></RouteLoader>} />
            <Route path="/shop" element={<RouteLoader><Shop products={products} onProductClick={handleProductClick} searchQuery={searchQuery} loading={loading} /></RouteLoader>} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/favorites" element={<Favorites onProductClick={handleProductClick} searchQuery={searchQuery} />} />
            <Route path="/orders" element={<RouteLoader><Orders searchQuery={searchQuery} /></RouteLoader>} />
            <Route path="/notifications" element={<RouteLoader><Notifications searchQuery={searchQuery} /></RouteLoader>} />
            <Route path="/support" element={<RouteLoader><Support searchQuery={searchQuery} /></RouteLoader>} />
            <Route path="/settings" element={<RouteLoader><Settings searchQuery={searchQuery} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} /></RouteLoader>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success" element={<RouteLoader><OrderSuccess /></RouteLoader>} />
            <Route path="/transactions" element={<RouteLoader><Transactions /></RouteLoader>} />
            <Route path="/about" element={<RouteLoader><AboutUs /></RouteLoader>} />
            <Route path="/locations" element={<RouteLoader><Locations /></RouteLoader>} />

            <Route path="/reset-password" element={<RouteLoader><ResetPassword /></RouteLoader>} />
            <Route path="/privacy-policy" element={<RouteLoader><PrivacyPolicy /></RouteLoader>} />
            <Route path="/terms-of-service" element={<RouteLoader><TermsOfService /></RouteLoader>} />
            <Route path="/cookie-policy" element={<RouteLoader><CookiePolicy /></RouteLoader>} />
            <Route path="/shipping-info" element={<RouteLoader><ShippingInfo /></RouteLoader>} />
            <Route path="/returns" element={<RouteLoader><Returns /></RouteLoader>} />
            <Route path="/faq" element={<RouteLoader><FAQ /></RouteLoader>} />
            <Route path="/track" element={<RouteLoader><TrackOrder /></RouteLoader>} />
            <Route path="/p/:slug" element={<RouteLoader><CMSPage /></RouteLoader>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {(location.pathname === '/' || location.pathname === '/shop') && (
          <RecentlyViewedProducts products={products} />
        )}
        <PartnersMarquee />
        <Footer />
      </div>

      {(!!selectedProduct || authModal.isOpen || !!activeDrawer) && (
        <Suspense fallback={null}>
          <ProductModal 
            product={selectedProduct}
            products={products}
            isOpen={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={handleAddToCart}
            onAddToWishlist={handleAddToWishlist}
            onProductClick={setSelectedProduct}
          />

          <AuthModal 
            isOpen={authModal.isOpen} 
            initialMode={authModal.mode}
            onClose={() => {
                closeAuthModal();
            }} 
          />

          <Drawer 
            id="drawer-map" 
            title="Our Location" 
            isOpen={activeDrawer === 'map'} 
            onClose={closeDrawers}
          >
            <MapCard />
          </Drawer>

          <Drawer 
            id="drawer-orders" 
            title="My Orders" 
            isOpen={activeDrawer === 'orders'} 
            onClose={closeDrawers}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!user ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Please login to view your orders.
            </div>
          ) : !Array.isArray(orders) || orders.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No orders found.
            </div>
          ) : (
            orders.map(order => (
                <div key={order.id} style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '12px', fontSize: '14px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ color: 'var(--text-main)' }}>#{order.id}</strong>
                    <span style={{ 
                        color: (order.status || 'pending') === 'completed' ? 'var(--success)' : ((order.status || 'pending') === 'pending' ? 'var(--warning)' : 'var(--accent-blue)'), 
                        fontSize: '12px', 
                        fontWeight: 600, 
                        background: (order.status || 'pending') === 'completed' ? 'var(--success-bg)' : ((order.status || 'pending') === 'pending' ? 'var(--warning-bg)' : 'var(--info-bg)'), 
                        padding: '2px 8px', 
                        borderRadius: '10px' 
                    }}>
                        {order.status || 'pending'}
                    </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {formatDate(order.created_at)}
                    </div>
                    <div style={{ marginTop: '8px', fontWeight: 600 }}>{formatPrice(order.total_amount || 0)}</div>
                </div>
            ))
          )}
            </div>
          </Drawer>

          <Drawer 
            id="drawer-notifications" 
            title="Recent Updates" 
            isOpen={activeDrawer === 'notifications'} 
            onClose={closeDrawers}
          >
            <div className="notifications-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No new notifications</div>
          ) : (
            notifications.map(notif => (
              <div key={notif.id} className="notification-item" style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', border: '1px solid var(--border-light)' }}>
                <div>
                   <span style={{ display: 'block', marginBottom: '4px' }}>{notif.text}</span>
                   <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatRelativeTime(notif.time)}</span>
                </div>
                <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)', minWidth: '14px' }} onClick={() => deleteNotification(notif.id)} />
              </div>
            ))
          )}
            </div>
          </Drawer>
        </Suspense>
      )}
      <Suspense fallback={null}>
        <ToastContainer />
      </Suspense>
      <CompareBar />
      <CompareModal />
      <BackToTop />
      <CookieConsent />
    </div>
  );
}

const AppProviders = ({ children }) => {
  return (
    <ConfirmProvider>
      <NotificationProvider>
        <SettingsProvider>
          <WishlistProvider>
            <CartProvider>
              <ComparisonProvider>
                {children}
              </ComparisonProvider>
            </CartProvider>
          </WishlistProvider>
        </SettingsProvider>
      </NotificationProvider>
    </ConfirmProvider>
  );
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("React Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', background: '#fee2e2', color: '#991b1b', minHeight: '100vh' }}>
          <h1>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px', background: '#fff', padding: '20px', border: '1px solid #fca5a5' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <UserProvider>
      <AppProviders>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AppProviders>
    </UserProvider>
  );
}
