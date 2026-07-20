import React from 'react';
import { X, ShoppingCart, Star, Trophy, GitCompareArrows } from 'lucide-react';
import { useComparison } from '../context/ComparisonContext';
import { useSettings } from '../context/SettingsContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';

const ROWS = [
  { key: 'image',    label: 'Product' },
  { key: 'price',    label: 'Price' },
  { key: 'rating',   label: 'Rating' },
  { key: 'category', label: 'Category' },
  { key: 'stock',    label: 'Availability' },
  { key: 'discount', label: 'Discount' },
];

export default function CompareModal() {
  const { compareList, removeFromCompare, clearCompare, isModalOpen, closeModal } = useComparison();
  const { formatPrice } = useSettings();
  const { addToCart } = useCart();
  const { addToast } = useNotifications();

  if (!isModalOpen || compareList.length < 2) return null;

  // Determine "best" values for highlighting
  const prices   = compareList.map(p => parseFloat(p.price) || Infinity);
  const ratings  = compareList.map(p => parseFloat(p.rating) || 0);
  const discounts = compareList.map(p => parseInt(p.discount_percent) || 0);
  const stocks   = compareList.map(p => Number(p.stock_quantity) || 0);

  const minPrice  = Math.min(...prices);
  const maxRating = Math.max(...ratings);
  const maxDiscount = Math.max(...discounts);
  const maxStock  = Math.max(...stocks);

  const isBest = (key, product) => {
    switch (key) {
      case 'price':    return (parseFloat(product.price) || Infinity) === minPrice;
      case 'rating':   return (parseFloat(product.rating) || 0) === maxRating && maxRating > 0;
      case 'discount': return (parseInt(product.discount_percent) || 0) === maxDiscount && maxDiscount > 0;
      case 'stock':    return (Number(product.stock_quantity) || 0) === maxStock && maxStock > 0;
      default:         return false;
    }
  };

  const renderCell = (key, product) => {
    const discount = parseInt(product.discount_percent) || 0;
    const price = parseFloat(product.price) || 0;
    const effectivePrice = discount > 0 ? price * (1 - discount / 100) : price;
    const stockQty = Number(product.stock_quantity) || 0;

    switch (key) {
      case 'image':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '14px', overflow: 'hidden', background: '#fff', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={product.image} alt={product.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', textAlign: 'center', lineHeight: 1.3 }}>{product.name}</p>
            <button
              onClick={() => removeFromCompare(product.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--danger)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={11} /> Remove
            </button>
          </div>
        );
      case 'price':
        return (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: discount > 0 ? 'var(--success)' : 'var(--text-main)' }}>{formatPrice(effectivePrice)}</p>
            {discount > 0 && <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatPrice(price)}</p>}
          </div>
        );
      case 'rating':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Star size={13} fill="var(--warning)" color="var(--warning)" />
            <span style={{ fontSize: '14px', fontWeight: 700 }}>{(parseFloat(product.rating) || 0).toFixed(1)}</span>
          </div>
        );
      case 'category':
        return <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{product.category || '—'}</span>;
      case 'stock':
        return (
          <span style={{ fontSize: '13px', fontWeight: 700, color: stockQty > 10 ? 'var(--success)' : stockQty > 0 ? 'var(--warning)' : 'var(--danger)' }}>
            {stockQty <= 0 ? 'Out of Stock' : stockQty <= 5 ? `Only ${stockQty} left!` : stockQty <= 10 ? 'Low Stock' : 'In Stock'}
          </span>
        );
      case 'discount':
        return discount > 0
          ? <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--danger)' }}>{discount}% OFF</span>
          : <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>—</span>;
      default:
        return null;
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={closeModal}
    >
      <div
        className="compare-modal-enter"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.25)',
          padding: '0 0 32px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px 16px', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitCompareArrows size={20} color="var(--primary-blue)" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>Product Comparison</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>{compareList.length} products</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={clearCompare} style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Clear All</button>
            <button onClick={closeModal} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
          </div>
        </div>

        {/* Comparison Table */}
        <div style={{ overflowX: 'auto', padding: '0 28px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
            <tbody>
              {ROWS.map(({ key, label }) => (
                <tr key={key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  {/* Row Label */}
                  <td style={{ padding: '16px 0', width: '110px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>
                    {label}
                  </td>
                  {/* Product Cells */}
                  {compareList.map(product => {
                    const best = isBest(key, product);
                    return (
                      <td
                        key={product.id}
                        style={{
                          padding: '16px 8px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          background: best ? 'rgba(var(--primary-blue-rgb), 0.04)' : 'transparent',
                          borderRadius: best ? '8px' : '0',
                          position: 'relative',
                        }}
                      >
                        {best && key !== 'image' && (
                          <span style={{
                            position: 'absolute', top: '6px', right: '6px',
                            background: 'var(--primary-blue)', color: '#fff',
                            borderRadius: '20px', fontSize: '9px', fontWeight: 800,
                            padding: '2px 6px', letterSpacing: '0.5px',
                            display: 'flex', alignItems: 'center', gap: '3px',
                          }}>
                            <Trophy size={8} /> BEST
                          </span>
                        )}
                        {renderCell(key, product)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Add to Cart row */}
              <tr>
                <td style={{ padding: '20px 0', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</td>
                {compareList.map(product => (
                  <td key={product.id} style={{ padding: '20px 8px', textAlign: 'center' }}>
                    <button
                      className="btn-primary"
                      style={{ width: '100%', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => {
                        const discount = parseInt(product.discount_percent) || 0;
                        const price = parseFloat(product.price) || 0;
                        const effectivePrice = discount > 0 ? price * (1 - discount / 100) : price;
                        addToCart({ ...product, price: effectivePrice, original_price: price });
                        addToast(`${product.name} added to cart`, 'success');
                      }}
                    >
                      <ShoppingCart size={14} /> Add to Cart
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
