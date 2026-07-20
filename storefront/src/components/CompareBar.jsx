import React from 'react';
import { X, GitCompareArrows, Trash2 } from 'lucide-react';
import { useComparison } from '../context/ComparisonContext';
import { useSettings } from '../context/SettingsContext';

export default function CompareBar() {
  const { compareList, removeFromCompare, clearCompare, openModal } = useComparison();
  const { formatPrice } = useSettings();

  if (compareList.length === 0) return null;

  // Ghost slots to fill up to 3
  const slots = [...compareList, ...Array(3 - compareList.length).fill(null)];

  return (
    <div
      className="compare-bar-enter"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'all',
          margin: '0 auto 0',
          width: '100%',
          maxWidth: '900px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-light)',
          borderLeft: '1px solid var(--border-light)',
          borderRight: '1px solid var(--border-light)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '14px 24px',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{
            background: 'rgba(var(--primary-blue-rgb), 0.1)',
            color: 'var(--primary-blue)',
            borderRadius: '10px',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <GitCompareArrows size={18} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
              Compare
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
              {compareList.length} / 3 selected
            </p>
          </div>
        </div>

        {/* Product Slots */}
        <div style={{ display: 'flex', gap: '10px', flex: 1, alignItems: 'center', overflow: 'hidden' }}>
          {slots.map((product, idx) =>
            product ? (
              <div
                key={product.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  padding: '6px 10px',
                  position: 'relative',
                  minWidth: 0,
                  flex: '1 1 0',
                  maxWidth: '220px',
                }}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px', background: '#fff', flexShrink: 0 }}
                />
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                }}>
                  {product.name}
                </span>
                <button
                  onClick={() => removeFromCompare(product.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '2px', borderRadius: '4px',
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    transition: 'color 0.2s',
                  }}
                  onMouseOver={e => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  title="Remove from comparison"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div
                key={`ghost-${idx}`}
                style={{
                  flex: '1 1 0',
                  maxWidth: '220px',
                  height: '48px',
                  border: '2px dashed var(--border-light)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  opacity: 0.6,
                }}
              >
                + Add product
              </div>
            )
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={clearCompare}
            style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid transparent',
              borderRadius: '10px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--danger)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'transparent'}
            title="Clear all"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={openModal}
            disabled={compareList.length < 2}
            className="btn-primary"
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: compareList.length < 2 ? 0.5 : 1,
              cursor: compareList.length < 2 ? 'not-allowed' : 'pointer',
            }}
          >
            <GitCompareArrows size={15} />
            Compare Now
          </button>
        </div>
      </div>
    </div>
  );
}
