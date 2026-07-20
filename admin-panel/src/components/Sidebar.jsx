import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatImageUrl } from '../services/api';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, Settings, Tag,
  LogOut, MapPin, ShieldAlert, Database, Globe, Zap, Activity, ShieldCheck,
  Star, Bell, ShoppingBag, RotateCcw, ClipboardList, MessageSquare, Truck, Megaphone,
  BookOpen, Mail, Layout, Layers, Images, Send, BarChart3
} from 'lucide-react';
import { useAdminSettings } from '../context/AdminSettingsContext';
import { useConfirm } from '../context/ConfirmContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { confirm } = useConfirm();
  const { siteName, logoUrl } = useAdminSettings();
  const role = user?.role || 'store_manager';
  const isSuper = role === 'super';
  const isAccountant = role === 'accountant';
  const isPicker = role === 'picker';
  const isMarketing = role === 'marketing';
  const isManager = role === 'store_manager' || role === 'super';

  // Define visibility for items based on role
  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: isPicker ? 'Picker Hub' : 'Dashboard', path: '/', visible: true },
    { icon: <Package size={20} />, label: 'Inventory Hub', path: '/catalog', visible: !isAccountant && !isPicker },
    { icon: <ShoppingCart size={20} />, label: isPicker ? 'Picker Workflow' : 'Sales & Fulfillment', path: '/sales', visible: !isMarketing },
    { icon: <Zap size={20} />, label: 'POS Checkout', path: '/pos', visible: !isMarketing && !isAccountant && !isPicker },
    { icon: <Users size={20} />, label: isAccountant ? 'Billing List' : 'Customers', path: '/customers', visible: !isMarketing && !isPicker },
    { icon: <Megaphone size={20} />, label: 'Marketing & Growth', path: '/marketing', visible: isMarketing },
    { icon: <Images size={20} />, label: 'Hero Sliders', path: '/sliders', visible: isManager && !isPicker },
    { icon: <Send size={20} />, label: 'Broadcast Hub', path: '/broadcast', visible: isManager && !isPicker },
    { icon: <MessageSquare size={20} />, label: 'Staff Hub', path: '/staff-chat', visible: !isAccountant },
    { icon: <Bell size={20} />, label: 'System Alerts', path: '/notifications', visible: true },
    { icon: <BookOpen size={20} />, label: 'Help & guides', path: '/help', visible: true },
    { icon: <Layout size={20} />, label: 'Content Manager', path: '/cms', visible: isManager && !isPicker },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings', visible: !isMarketing },
  ].filter(item => item.visible);

  const superItems = [
    { icon: <ShieldAlert size={20} />, label: 'Global Overview', path: '/super/dashboard' },

    { icon: <Users size={20} />, label: 'Admin Control', path: '/super/admins' },
    { icon: <MapPin size={20} />, label: 'Pickup Locations', path: '/super/pickup-locations' },
    { icon: <Database size={20} />, label: 'System Logs', path: '/super/logs' },
    { icon: <Globe size={20} />, label: 'Super Settings', path: '/super/settings' },
  ];

  return (
    <aside className="admin-sidebar glass">
      <div className="sidebar-logo">
        <img 
          src={logoUrl || "/logo.png"} 
          alt={`${siteName} Admin`} 
          style={{ height: '32px', width: 'auto', objectFit: 'contain' }} 
        />
        <span className="sidebar-logo-text" style={{ 
          fontSize: '18px', 
          fontWeight: 900, 
          letterSpacing: '-0.5px',
          color: 'var(--text-main)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {siteName}
        </span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-group">
          <div className="sidebar-section-label">
            {isAccountant ? 'Financial Control' : 
             isMarketing ? 'Promotion & Analytics' : 
             isPicker ? 'Picker Operations' :
             role === 'store_manager' ? 'Store Operations' : 
             'Store Management'}
          </div>
          {navItems.map((item, idx) => (
            <div 
              key={item.path} 
              className="animate-slide-in" 
              style={{ 
                animationDelay: `${idx * 0.05}s`,
                animationFillMode: 'both'
              }}
            >
              <NavLink
                to={item.path}
                className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
                title={item.label}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            </div>
          ))}
        </div>

        {isSuper && (
          <div className="sidebar-group">
            <div className="sidebar-section-label gold">
              <ShieldAlert size={14} /> Root Control
            </div>
            {superItems.map((item, idx) => (
              <div 
                key={item.path} 
                className="animate-slide-in" 
                style={{ 
                  animationDelay: `${(navItems.length + idx) * 0.05}s`,
                  animationFillMode: 'both'
                }}
              >
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `sidebar-nav-link super${isActive ? ' active-super' : ''}`}
                  title={item.label}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-label">{item.label}</span>
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="sidebar-footer animate-slide-in" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
        <div className="sidebar-profile-card">
          <div className="sidebar-profile-info">
            {user?.profileImage ? (
              <img 
                src={formatImageUrl(user.profileImage)} 
                alt={user?.name || 'User'} 
                className="sidebar-profile-img"
              />
            ) : (
              <div className="sidebar-profile-avatar">
                {user?.avatar || (user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD')}
              </div>
            )}
            <div className="sidebar-profile-details">
              <span className="sidebar-profile-name">{user?.name || 'Administrator'}</span>
              <span className="sidebar-profile-role">{role.replace('_', ' ').toUpperCase()}</span>
            </div>
          </div>
          <button 
            className="btn sidebar-profile-logout"
            onClick={async () => {
              if (await confirm("Are you sure you want to log out of your admin session? You will need to sign in again to access the dashboard.", {
                  title: "Log Out",
                  icon: <LogOut size={24} />,
                  iconColor: "#ef4444",
                  confirmText: "Log Out"
              })) {
                  logout();
              }
            }}
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

    </aside>
  );
}
