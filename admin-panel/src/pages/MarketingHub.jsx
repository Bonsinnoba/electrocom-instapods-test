import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import SliderManager from './SliderManager';
import CouponManager from './CouponManager';
import ReviewManager from './ReviewManager';
import BroadcastManager from './BroadcastManager';
import BroadcastDeliveryAnalytics from './BroadcastDeliveryAnalytics';
import { Megaphone, LayoutDashboard, Tag, Star, Zap, BarChart3 } from 'lucide-react';

export default function MarketingHub() {
  const { user } = useAuth();
  const role = user?.role || 'store_manager';
  const isMarketing = role === 'marketing';
  const isAccountant = role === 'accountant';
  const isPicker = role === 'picker';


  const availableTabs = [];
  
  if (!isAccountant && !isPicker) {
    availableTabs.push({ 
      id: 'coupons', 
      label: 'Coupons', 
      icon: <Tag size={16} />, 
      component: <CouponManager /> 
    });
    availableTabs.push({ 
      id: 'broadcast', 
      label: 'Broadcasts', 
      icon: <Zap size={16} />, 
      component: <BroadcastManager /> 
    });
    availableTabs.push({
      id: 'delivery',
      label: 'Delivery analytics',
      icon: <BarChart3 size={16} />,
      component: <BroadcastDeliveryAnalytics />,
    });
  }
  
  if (!isAccountant && !isPicker) {
    availableTabs.push({ 
      id: 'slider', 
      label: 'Hero Slider', 
      icon: <LayoutDashboard size={16} />, 
      component: <SliderManager /> 
    });
  }
  
  if (!isMarketing && !isPicker) {
    availableTabs.push({ 
      id: 'reviews', 
      label: 'Reviews', 
      icon: <Star size={16} />, 
      component: <ReviewManager /> 
    });
  }

  // Sort logically (Coupons, Slider, Reviews, Broadcasts, Delivery analytics)
  availableTabs.sort((a, b) => {
    const order = ['coupons', 'slider', 'reviews', 'broadcast', 'delivery'];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });

  const [activeTab, setActiveTab] = useState(availableTabs.length > 0 ? availableTabs[0].id : null);

  if (!activeTab) return <div style={{ padding: '40px', textAlign: 'center' }}>No access to any marketing modules.</div>;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '34px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <Megaphone size={32} color="var(--primary-gold)" />
          Marketing & Growth
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage your promotions, banners, reviews, and email broadcasts.</p>
      </header>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '0', overflowX: 'auto' }}>
        {availableTabs.map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '10px 10px 0 0', border: 'none',
              background: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent', color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', borderBottom: activeTab === tab.id ? '2px solid var(--primary-gold)' : '2px solid transparent',
              transition: 'all 0.2s', whiteSpace: 'nowrap'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      <div>
        {availableTabs.find(t => t.id === activeTab)?.component}
      </div>
    </div>
  );
}
