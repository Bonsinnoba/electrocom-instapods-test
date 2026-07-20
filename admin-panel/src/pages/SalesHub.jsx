import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import OrderManager from './OrderManager';
import ReturnManager from './ReturnManager';
import AbandonedCartManager from './AbandonedCartManager';
import MissingItemsManager from './MissingItemsManager';
import { ShoppingCart, RotateCcw, ShoppingBag, AlertTriangle } from 'lucide-react';

export default function SalesHub() {
  const { user } = useAuth();
  const role = user?.role || 'store_manager';
  const isMarketing = role === 'marketing';
  const isAccountant = role === 'accountant';
  const isPicker = role === 'picker';

  const availableTabs = [];
  
  if (!isMarketing) {
    availableTabs.push({ 
      id: 'orders', 
      label: isPicker ? 'Picker Queue' : (isAccountant ? 'Audits / Orders' : 'Active Orders'), 
      icon: <ShoppingCart size={16} />, 
      component: <OrderManager /> 
    });
  }
  if (!isMarketing && !isAccountant && !isPicker) {
    availableTabs.push({ 
      id: 'returns', 
      label: 'Returns', 
      icon: <RotateCcw size={16} />, 
      component: <ReturnManager /> 
    });
  }
  if (!isMarketing && !isPicker) {
    availableTabs.push({ 
      id: 'abandoned', 
      label: 'Abandoned Carts', 
      icon: <ShoppingBag size={16} />, 
      component: <AbandonedCartManager /> 
    });
  }
  if (!isMarketing && !isPicker) {
    availableTabs.push({
      id: 'missing-items',
      label: 'Missing Items',
      icon: <AlertTriangle size={16} />,
      component: <MissingItemsManager />
    });
  }

  const [activeTab, setActiveTab] = useState(availableTabs.length > 0 ? availableTabs[0].id : null);

  if (!activeTab) return <div style={{ padding: '40px', textAlign: 'center' }}>No access to any sales modules.</div>;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '34px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <ShoppingCart size={32} color="var(--primary-gold)" />
          Sales & Fulfillment
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage orders, returns, and track abandoned carts.</p>
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
