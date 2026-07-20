import React from 'react';

export default function ProductSkeleton() {
  return (
    <div className="product-card" style={{ cursor: 'default' }}>
      <div className="product-image skeleton" style={{ borderRadius: '12px' }}></div>
      <div className="product-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div className="skeleton" style={{ height: '14px', width: '60%', borderRadius: '4px' }}></div>
            <div className="skeleton" style={{ height: '14px', width: '20%', borderRadius: '4px' }}></div>
        </div>
        <div className="skeleton" style={{ height: '12px', width: '40%', borderRadius: '4px' }}></div>
      </div>
    </div>
  );
}
