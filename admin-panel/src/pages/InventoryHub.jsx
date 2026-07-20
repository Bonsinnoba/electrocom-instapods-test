import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ProductManager from './ProductManager';
import BulkShelvingTool from './BulkShelvingTool';
import CategoryManager from './CategoryManager';
import { Package, Layers, Tag } from 'lucide-react';

export default function InventoryHub() {
  const { user } = useAuth();
  const role = user?.role || 'store_manager';
  const isMarketing = role === 'marketing';
  const isAccountant = role === 'accountant';
  const isPicker = role === 'picker';

  const availableTabs = [];
  const isManager = role === 'store_manager' || role === 'super';

  if (!isAccountant && !isPicker) {
    availableTabs.push({
      id: 'products',
      label: 'Product Catalog',
      icon: <Package size={16} />,
      component: <ProductManager />
    });
    availableTabs.push({
      id: 'categories',
      label: 'Category Manager',
      icon: <Tag size={16} />,
      component: <CategoryManager />,
    });
    availableTabs.push({
      id: 'bulk_shelving',
      label: 'Bulk shelving',
      icon: <Layers size={16} />,
      component: <BulkShelvingTool />,
    });
  }
  

  const [activeTab, setActiveTab] = useState(availableTabs.length > 0 ? availableTabs[0].id : null);

  if (!activeTab) return <div style={{ padding: '40px', textAlign: 'center' }}>No access to any inventory modules.</div>;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '34px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <Package size={32} color="var(--primary-gold)" />
          Inventory Management
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage products and global inventory shelving.</p>
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
