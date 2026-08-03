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
          gap: '12px',
          padding: '10px 16px',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Icon + Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{
            background: 'rgba(var(--primary-blue-rgb), 0.08)',
            color: 'var(--primary-blue)',
            borderRadius: '10px',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <GitCompareArrows size={16} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'inline-block' }}>{compareList.length}/3</span>
          </div>
        </div>

        {/* Product Slots */}
        <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center', overflow: 'hidden' }}>
          {slots.map((product, idx) =>
            product ? (
              <div
                key={product.id}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '10px',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  style={{ width: '44px', height: '44px', objectFit: 'contain', borderRadius: '8px', background: '#fff' }}
                />
                <button
                  onClick={() => removeFromCompare(product.id)}
                  style={{
                    position: 'absolute', top: '-6px', right: '-6px',
                    width: '26px', height: '26px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-main)', border: '1px solid var(--border-light)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div
                key={`ghost-${idx}`}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '10px',
                  border: '2px dashed var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  opacity: 0.7,
                  flexShrink: 0,
                }}
              >
                +
              </div>
            )
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={clearCompare}
            style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid transparent',
              borderRadius: '10px',
              padding: '8px',
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
              padding: '10px 18px',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: compareList.length < 2 ? 0.5 : 1,
              cursor: compareList.length < 2 ? 'not-allowed' : 'pointer',
            }}
          >
            <GitCompareArrows size={15} />
            Compare
          </button>
        </div>
      </div>
    </div>
  );
}
