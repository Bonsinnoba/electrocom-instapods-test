import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { API_BASE_URL } from './services/api';



import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { AdminSettingsProvider, useAdminSettings } from './context/AdminSettingsContext';
import { X } from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const CustomerManager = lazy(() => import('./pages/CustomerManager'));
const Settings = lazy(() => import('./pages/Settings'));
const SystemNotifications = lazy(() => import('./pages/SystemNotifications'));
const POSInterface = lazy(() => import('./pages/POSInterface'));
const InventoryHub = lazy(() => import('./pages/InventoryHub'));
const SalesHub = lazy(() => import('./pages/SalesHub'));
const MarketingHub = lazy(() => import('./pages/MarketingHub'));
const SuperDashboard = lazy(() => import('./pages/super-user/SuperDashboard'));
const AdminControl = lazy(() => import('./pages/super-user/AdminControl'));
const SystemLogs = lazy(() => import('./pages/super-user/SystemLogs'));
const StaffChat = lazy(() => import('./pages/StaffChat'));
const AccountantDashboard = lazy(() => import('./pages/AccountantDashboard'));
const GlobalSettings = lazy(() => import('./pages/super-user/GlobalSettings'));
const PickupLocationManager = lazy(() => import('./pages/super-user/PickupLocationManager'));
const PickerDashboard = lazy(() => import('./pages/PickerDashboard'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const CMSManager = lazy(() => import('./pages/CMSManager'));
const CategoryManager = lazy(() => import('./pages/CategoryManager'));
const SliderManager = lazy(() => import('./pages/SliderManager'));
const BroadcastHub = lazy(() => import('./pages/BroadcastHub'));

// ─── Toast Overlay ────────────────────────────────────────────────────────────
const AdminToasts = () => {
  const { notifications, markAsRead, toasts, removeToast } = useNotifications();
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      {notifications.filter(n => !n.read).slice(0, 5).map(notif => (
        <div key={notif.id} className="glass animate-slide-in" style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: notif.type === 'error' ? 'var(--danger-bg)' : 
                      notif.type === 'success' ? 'var(--success-bg)' : 
                      'var(--info-bg)',
          border: `1px solid ${notif.type === 'error' ? 'var(--danger)' : 
                               notif.type === 'success' ? 'var(--success)' : 
                               'var(--primary-blue)'}`,
          color: notif.type === 'error' ? 'var(--danger)' : 
                 notif.type === 'success' ? 'var(--success)' : 
                 'var(--primary-blue)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
          minWidth: '300px',
          maxWidth: '450px',
          pointerEvents: 'auto'
        }}>
          <div style={{ flex: 1, fontWeight: 700, fontSize: '14px' }}>{notif.text}</div>
          <button 
            onClick={() => markAsRead(notif.id)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'inherit', 
              cursor: 'pointer', 
              opacity: 0.6,
              display: 'flex',
              padding: '4px'
            }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      
      {toasts.map(toast => (
        <div key={toast.id} className="glass animate-fade-in" style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: toast.type === 'error' ? 'var(--danger-bg)' : 
                      toast.type === 'success' ? 'var(--success-bg)' : 
                      'var(--info-bg)',
          border: `1px solid ${toast.type === 'error' ? 'var(--danger)' : 
                               toast.type === 'success' ? 'var(--success)' : 
                               'var(--primary-blue)'}`,
          color: toast.type === 'error' ? 'var(--danger)' : 
                 toast.type === 'success' ? 'var(--success)' : 
                 'var(--primary-blue)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
          minWidth: '300px',
          maxWidth: '450px',
          pointerEvents: 'auto'
        }}>
          <div style={{ flex: 1, fontWeight: 700, fontSize: '14px' }}>{toast.text}</div>
          <button 
            onClick={() => removeToast(toast.id)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'inherit', 
              cursor: 'pointer', 
              opacity: 0.6,
              display: 'flex',
              padding: '4px'
            }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

// ─── Protected Layout (defined OUTSIDE App to stay stable across renders) ─────
const ProtectedLayout = ({ children, requireSuper = false }) => {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const check = async () => {
      try {
        const data = await authFetch('/super_settings.php');
        if (data && data.success) {
          if (data.data?.maintenance && user?.role !== 'super') {
            setIsMaintenance(true);
          }
        }
      } catch (e) {}
    };
    check();
  }, [isAuthenticated, user, logout]);

  // While auth context is loading from localStorage, show nothing (prevents flash)
  if (loading) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (isMaintenance) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '20px', background: 'var(--bg-main)', color: 'var(--text-main)'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>🛠️</div>
        <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '16px' }}>System Maintenance</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '500px', lineHeight: '1.6' }}>
          The administration panel is currently undergoing scheduled maintenance. 
          Only Super Admins can access the dashboard at this time.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="btn-primary" 
          style={{ marginTop: '32px', padding: '12px 24px' }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (requireSuper && user?.role !== 'super') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
};

const DashboardSwitcher = () => {
  const { user } = useAuth();
  if (user?.role === 'picker') return <PickerDashboard />;
  return <Dashboard />;
};

const RouteLoader = ({ children }) => (
  <Suspense fallback={<div className="loading-state">Loading module...</div>}>
    {children}
  </Suspense>
);

// ─── App Content ─────────────────────────────────────────────────────────────
function AppContent() {
  const { settings, siteName, primaryColor, fontFamily, loading: settingsLoading } = useAdminSettings();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Apply dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  // Apply site branding (Primary Color and Font)
  useEffect(() => {
    if (primaryColor) {
      document.documentElement.style.setProperty('--primary-blue', primaryColor);
      document.documentElement.style.setProperty('--primary-blue-hover', `${primaryColor}CC`);
      
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '30, 58, 138';
      };
      document.documentElement.style.setProperty('--primary-blue-rgb', hexToRgb(primaryColor));
    }
    
    if (fontFamily) {
      document.documentElement.style.setProperty('--font-main', fontFamily);
      document.body.style.fontFamily = `'${fontFamily}', sans-serif`;
    }

    if (siteName) {
      document.title = `${siteName} | Admin Panel`;
    }
  }, [primaryColor, fontFamily, siteName]);

  // Remove local legacy theme sync
  useEffect(() => {
    document.body.classList.remove('theme-yellow', 'theme-green', 'theme-purple');
  }, []);

  // Storage change listener only needs to care about Dark Mode now
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) setIsDarkMode(JSON.parse(saved));
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('themeChange', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('themeChange', handleStorageChange);
    };
  }, []);

  const { logout, isAuthenticated } = useAuth();
  const { addToast } = useNotifications();

  // Idle timeout implementation (Session Expiry)
  useEffect(() => {
    if (!settings?.sessionTimeout || !isAuthenticated) return;
    
    const timeoutMins = parseInt(settings.sessionTimeout);
    let timer;
    
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
        addToast(`Disconnected: Session expired after ${timeoutMins}m of inactivity.`, 'info');
      }, timeoutMins * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));
    
    resetTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, resetTimer));
      if (timer) clearTimeout(timer);
    };
  }, [settings?.sessionTimeout, isAuthenticated, logout, addToast]);

  // passive session expiry listener (401 from API)
  useEffect(() => {
    const handleUnauthorized = () => {
      // Only trigger session expiry if we were actually logged in
      // and NOT already on the login page
      if (isAuthenticated && window.location.pathname !== '/login') {
        logout();
        addToast('Session expired. Please log in again.', 'warning');
      }
    };
    window.addEventListener('auth_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth_unauthorized', handleUnauthorized);
  }, [isAuthenticated, logout, addToast]);

  return (
    <Router>
      <div className="mobile-restriction">
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🖥️</div>
        <h2>Desktop or Tablet Required</h2>
        <p>The Admin Dashboard is optimized for larger screens only.</p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Please access this URL from a tablet (landscape), laptop, or desktop computer (min-width: 1024px).
        </p>
      </div>

      <Routes>
        <Route path="/login" element={<RouteLoader><Login /></RouteLoader>} />

        <Route path="/" element={
          <ProtectedLayout>
            <RouteLoader><DashboardSwitcher /></RouteLoader>
          </ProtectedLayout>
        } />

        <Route path="/catalog" element={<ProtectedLayout><RouteLoader><InventoryHub /></RouteLoader></ProtectedLayout>} />
        <Route path="/categories" element={<ProtectedLayout><RouteLoader><CategoryManager /></RouteLoader></ProtectedLayout>} />
        <Route path="/sales" element={<ProtectedLayout><RouteLoader><SalesHub /></RouteLoader></ProtectedLayout>} />
        <Route path="/marketing" element={<ProtectedLayout><RouteLoader><MarketingHub /></RouteLoader></ProtectedLayout>} />
        <Route path="/sliders" element={<ProtectedLayout><RouteLoader><SliderManager /></RouteLoader></ProtectedLayout>} />
        <Route path="/broadcast" element={<ProtectedLayout><RouteLoader><BroadcastHub /></RouteLoader></ProtectedLayout>} />

        <Route path="/pos" element={<ProtectedLayout><RouteLoader><POSInterface /></RouteLoader></ProtectedLayout>} />
        <Route path="/customers" element={<ProtectedLayout><RouteLoader><CustomerManager /></RouteLoader></ProtectedLayout>} />
        <Route path="/notifications" element={<ProtectedLayout><RouteLoader><SystemNotifications /></RouteLoader></ProtectedLayout>} />
        <Route path="/help" element={<ProtectedLayout><RouteLoader><HelpCenter /></RouteLoader></ProtectedLayout>} />
        <Route path="/cms" element={<ProtectedLayout><RouteLoader><CMSManager /></RouteLoader></ProtectedLayout>} />
        <Route path="/settings" element={<ProtectedLayout><RouteLoader><Settings /></RouteLoader></ProtectedLayout>} />

        <Route path="/super/dashboard" element={<ProtectedLayout requireSuper><RouteLoader><SuperDashboard /></RouteLoader></ProtectedLayout>} />
        <Route path="/super/admins" element={<ProtectedLayout requireSuper><RouteLoader><AdminControl /></RouteLoader></ProtectedLayout>} />

        <Route path="/super/logs" element={<ProtectedLayout requireSuper><RouteLoader><SystemLogs /></RouteLoader></ProtectedLayout>} />
        <Route path="/super/settings" element={<ProtectedLayout requireSuper><RouteLoader><GlobalSettings /></RouteLoader></ProtectedLayout>} />
        <Route path="/super/pickup-locations" element={<ProtectedLayout requireSuper><RouteLoader><PickupLocationManager /></RouteLoader></ProtectedLayout>} />
        
        <Route path="/staff-chat" element={<ProtectedLayout><RouteLoader><StaffChat /></RouteLoader></ProtectedLayout>} /> 
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <AdminSettingsProvider>
        <NotificationProvider>
          <ConfirmProvider>
            <AdminToasts />
            <AppContent />
          </ConfirmProvider>
        </NotificationProvider>
      </AdminSettingsProvider>
    </AuthProvider>
  );
}

export default App;