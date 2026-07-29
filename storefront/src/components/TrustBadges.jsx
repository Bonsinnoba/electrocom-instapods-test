import React from 'react';
import { Shield, Truck, RotateCcw, CreditCard, Lock, HeadphonesIcon } from 'lucide-react';

const ALL_BADGES = [
  {
    icon: Lock,
    title: 'Secure Checkout',
    description: 'Your data is protected with SSL encryption'
  },
  {
    icon: Truck,
    title: 'Fast Delivery',
    description: 'Free shipping on orders over $50'
  },
  {
    icon: RotateCcw,
    title: 'Easy Returns',
    description: '30-day return policy, no questions asked'
  },
  {
    icon: CreditCard,
    title: 'Flexible Payment',
    description: 'Multiple payment options available'
  },
  {
    icon: Shield,
    title: 'Buyer Protection',
    description: 'Full refund if you\'re not satisfied'
  },
  {
    icon: HeadphonesIcon,
    title: '24/7 Support',
    description: 'Our team is here to help anytime'
  }
];

/**
 * TrustBadges — renders a "Why Shop With Us" card.
 *
 * Props:
 *   slice?: [start, end]  — which subset of badges to show (default: all)
 *   showFooter?: boolean  — show the "Trusted by 10,000+" footer (default: true when slice is undefined)
 */
export default function TrustBadges({ slice, showFooter }) {
  const badges = slice ? ALL_BADGES.slice(slice[0], slice[1]) : ALL_BADGES;
  const displayFooter = showFooter ?? !slice; // footer shown by default only when rendering all badges

  return (
    <div className="glass" style={{
      padding: '20px',
      borderRadius: '16px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)'
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: 700,
        margin: '0 0 16px',
        color: 'var(--text-main)',
        textAlign: 'center'
      }}>
        Why Shop With Us
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {badges.map((badge, index) => {
          const Icon = badge.icon;
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--bg-main)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.background = 'var(--bg-surface)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.background = 'var(--bg-main)';
              }}
            >
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--primary-blue)'
              }}>
                <Icon size={17} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  marginBottom: '2px'
                }}>
                  {badge.title}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: '1.4'
                }}>
                  {badge.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {displayFooter && (
        <div style={{
          marginTop: '14px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--text-muted)'
          }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '14px',
                    height: '14px',
                    background: 'var(--warning)',
                    borderRadius: '50%',
                    display: 'inline-block'
                  }}
                />
              ))}
            </div>
            <span>Trusted by 10,000+ customers</span>
          </div>
        </div>
      )}
    </div>
  );
}
