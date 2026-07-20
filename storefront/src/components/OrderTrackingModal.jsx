import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, Truck, Package, Calendar, MapPin, FileText, XCircle, ArrowRight } from 'lucide-react';
import { fetchOrderDetails, formatImageUrl, getInvoiceUrl } from '../services/api';
import { formatRelativeTime, formatDate } from '../utils/dateFormatter';
import { useSettings } from '../context/SettingsContext';

const steps = [
  { id: 'pending',    label: 'Order Placed', icon: Clock,        desc: 'Your order has been received'  },
  { id: 'processing', label: 'Processing',   icon: Package,      desc: 'We are preparing your items'   },
  { id: 'shipped',    label: 'Shipped',      icon: Truck,        desc: 'Your order is on the way'      },
  { id: 'delivered',  label: 'Delivered',    icon: CheckCircle,  desc: 'Order has been delivered'      },
];

const getStatusIndex = (status) => {
  const s = (status || 'pending').toLowerCase();
  if (s === 'delivered' || s === 'completed') return 3;
  if (s === 'shipped') return 2;
  if (['processing', 'received', 'picking', 'picked'].includes(s)) return 1;
  return 0;
};

const getLogStyle = (statusKey = '') => {
  const s = statusKey.toLowerCase();
  if (s.includes('deliver') || s.includes('complet')) return { bg: 'var(--success-bg)',            color: 'var(--success)'      };
  if (s.includes('ship')    || s.includes('dispatch')) return { bg: 'rgba(59,130,246,0.12)',         color: 'var(--primary-blue)' };
  if (s.includes('pick')    || s.includes('process') || s.includes('receiv'))
    return { bg: 'rgba(249,115,22,0.12)', color: '#f97316' };
  if (s.includes('cancel'))                            return { bg: 'var(--danger-bg)',              color: 'var(--danger)'       };
  return                                                      { bg: 'var(--bg-surface-secondary)',   color: 'var(--text-muted)'   };
};

export default function OrderTrackingModal({ orderId, isOpen, onClose }) {
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const { formatPrice }       = useSettings();

  useEffect(() => {
    if (!isOpen) { setOrder(null); setLoading(true); return; }
    if (!orderId) return;
    let cancelled = false;
    setLoading(true); setError(null);
    fetchOrderDetails(orderId)
      .then(data  => { if (!cancelled) setOrder(data); })
      .catch(()   => { if (!cancelled) setError('Failed to load tracking information.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const isCancelled  = order?.status?.toLowerCase() === 'cancelled';
  const currentIndex = getStatusIndex(order?.status);

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 2999,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
        }}
      />

      {/* ── Drawer ── */}
      <div data-otm-drawer="" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 3000,
        width: '100%', maxWidth: '480px',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-light)',
        boxShadow: '-24px 0 60px rgba(0,0,0,0.28)',
        animation: 'otmSlideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
      }}>

        {/* ─── Header ─── */}
        <div style={{
          padding: '18px 20px', flexShrink: 0,
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg,rgba(59,130,246,0.06) 0%,transparent 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
              background: 'linear-gradient(135deg,var(--primary-blue),#3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
            }}>
              <Truck size={20} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Track Order</h2>
              <span style={{
                fontSize: '11px', fontWeight: 700, color: 'var(--primary-blue)',
                background: 'rgba(59,130,246,0.12)', padding: '2px 10px', borderRadius: '20px',
              }}>{orderId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
              border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          ><X size={17} /></button>
        </div>

        {/* ─── Scrollable Body ─── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '280px', gap: '14px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                border: '4px solid rgba(59,130,246,0.2)', borderTopColor: 'var(--primary-blue)',
                animation: 'otmSpin 0.75s linear infinite',
              }} />
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '14px' }}>Fetching tracking info…</span>
            </div>
          )}

          {error && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>⚠️</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{error}</p>
            </div>
          )}

          {!loading && !error && order && (<>

            {/* ── CANCELLED STATE ── */}
            {isCancelled ? (
              <div style={{
                padding: '28px 20px', borderRadius: '20px', textAlign: 'center',
                background: 'var(--danger-bg)', border: '2px solid var(--danger)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
              }}>
                <div style={{
                  width: '68px', height: '68px', borderRadius: '50%',
                  background: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 28px rgba(239,68,68,0.45)',
                }}>
                  <XCircle size={34} color="white" />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, color: 'var(--danger)' }}>Order Cancelled</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    This order has been cancelled. If you were charged, a refund will be processed within 3–5 business days.
                  </p>
                </div>
              </div>
            ) : (
              /* ── STATUS STEPPER ── */
              <div style={{
                borderRadius: '20px', padding: '22px 14px 18px',
                background: 'linear-gradient(135deg,rgba(59,130,246,0.04) 0%,transparent 100%)',
                border: '1px solid rgba(59,130,246,0.1)',
              }}>
                <div style={{ position: 'relative' }}>
                  {/* Track */}
                  <div style={{
                    position: 'absolute', top: '23px',
                    left: 'calc(12.5% + 10px)', right: 'calc(12.5% + 10px)',
                    height: '4px', borderRadius: '3px', background: 'var(--bg-surface-secondary)', zIndex: 0,
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '3px',
                      width: `${(currentIndex / (steps.length - 1)) * 100}%`,
                      background: 'linear-gradient(90deg,var(--primary-blue),#60a5fa)',
                      boxShadow: '0 0 10px rgba(59,130,246,0.5)',
                      transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                    {steps.map((step, idx) => {
                      const done   = idx <= currentIndex;
                      const active = idx === currentIndex;
                      const Icon   = step.icon;
                      return (
                        <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '25%' }}>
                          <div
                            className={active ? 'otm-step-active' : ''}
                            style={{
                              width: '46px', height: '46px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: done ? 'linear-gradient(135deg,var(--primary-blue),#3b82f6)' : 'var(--bg-surface-secondary)',
                              color: done ? 'white' : 'var(--text-muted)',
                              boxShadow: done ? '0 6px 18px rgba(59,130,246,0.4)' : '0 2px 6px rgba(0,0,0,0.07)',
                              transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
                              transform: active ? 'scale(1.12)' : 'scale(1)',
                            }}
                          ><Icon size={20} /></div>
                          <span style={{
                            fontSize: '10px', fontWeight: active ? 800 : 600, textAlign: 'center',
                            color: active ? 'var(--primary-blue)' : done ? 'var(--text-main)' : 'var(--text-muted)',
                            lineHeight: 1.3,
                          }}>{step.label}</span>
                          {active && (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--primary-blue)', textTransform: 'uppercase', letterSpacing: '0.5px', animation: 'otmPulse 2s infinite' }}>
                              Current
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── INFO CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                {
                  icon: <Calendar size={15} />,
                  iconBg: 'rgba(59,130,246,0.15)', iconColor: 'var(--primary-blue)',
                  cardBg: 'linear-gradient(135deg,rgba(59,130,246,0.06),rgba(59,130,246,0.02))',
                  cardBorder: 'rgba(59,130,246,0.15)',
                  label: 'Est. Delivery',
                  value: (order.status === 'delivered' || order.status === 'completed')
                    ? '✓ Delivered'
                    : isCancelled ? 'N/A' : '3–5 working days',
                },
                {
                  icon: <MapPin size={15} />,
                  iconBg: 'rgba(249,115,22,0.15)', iconColor: '#f97316',
                  cardBg: 'linear-gradient(135deg,rgba(249,115,22,0.06),rgba(249,115,22,0.02))',
                  cardBorder: 'rgba(249,115,22,0.15)',
                  label: 'Ship To',
                  value: order.shipping_address || '—',
                },
              ].map((card, i) => (
                <div key={i} style={{
                  padding: '14px', borderRadius: '16px',
                  background: card.cardBg, border: `1px solid ${card.cardBorder}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                    <div style={{ padding: '5px', borderRadius: '8px', background: card.iconBg, color: card.iconColor }}>
                      {card.icon}
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.4 }}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* ── ORDER ACTIVITY TIMELINE ── */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.9px' }}>
                Order Activity
              </h3>
              <div style={{
                borderRadius: '16px', padding: '18px',
                background: 'linear-gradient(135deg,rgba(59,130,246,0.03),rgba(59,130,246,0.01))',
                border: '1px solid rgba(59,130,246,0.1)',
              }}>
                {order.logs && order.logs.length > 0 ? (
                  [...order.logs].reverse().map((log, idx, arr) => {
                    const isFirst = idx === 0;
                    const isLast  = idx === arr.length - 1;
                    const ls      = getLogStyle(log.status_key);
                    return (
                      <div key={idx} style={{ display: 'flex', gap: '14px', paddingBottom: isLast ? 0 : '18px', opacity: Math.max(0.45, 1 - idx * 0.1) }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{
                            width: '11px', height: '11px', borderRadius: '50%', marginTop: '3px',
                            background: isFirst ? 'var(--primary-blue)' : 'var(--border-light)',
                            boxShadow: isFirst ? '0 0 0 4px rgba(59,130,246,0.18)' : 'none',
                          }} />
                          {!isLast && (
                            <div style={{ width: '2px', flex: 1, minHeight: '18px', marginTop: '4px', background: 'linear-gradient(180deg,var(--border-light) 0%,transparent 100%)' }} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
                              padding: '2px 10px', borderRadius: '20px', background: ls.bg, color: ls.color,
                            }}>{log.status_key}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-surface-secondary)', padding: '2px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                              {formatRelativeTime(log.created_at)}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: isFirst ? 700 : 500, color: isFirst ? 'var(--text-main)' : 'var(--text-muted)', lineHeight: 1.4 }}>
                            {log.message}
                          </p>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7 }}>{formatDate(log.created_at)}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: 'var(--primary-blue)', boxShadow: '0 0 0 4px rgba(59,130,246,0.18)', marginTop: '3px', flexShrink: 0 }} />
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Order Placed Successfully</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-surface-secondary)', padding: '2px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Order #{orderId} confirmed and awaiting pickup.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── PACKAGE CONTENTS ── */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.9px' }}>
                Package Contents
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {order.items?.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', borderRadius: '14px',
                    background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)',
                  }}>
                    <div style={{
                      width: '50px', height: '50px', borderRadius: '10px', flexShrink: 0,
                      background: 'white', border: '1px solid var(--border-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      {item.image_url
                        ? <img src={formatImageUrl(item.image_url)} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        : <Package size={20} color="var(--text-muted)" />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary-blue)', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '20px', display: 'inline-block', marginTop: '4px' }}>
                        Qty: {item.qty}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary-blue)', flexShrink: 0 }}>
                      {formatPrice(item.price * item.qty)}
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', borderRadius: '14px', marginTop: '2px',
                  background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(59,130,246,0.04))',
                  border: '1px solid rgba(59,130,246,0.2)',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Order Total</span>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary-blue)' }}>
                    {formatPrice(parseFloat(order.total_amount || 0))}
                  </span>
                </div>
              </div>
            </div>

          </>)}
        </div>

        {/* ─── Footer ─── */}
        <div style={{
          padding: '14px 20px', flexShrink: 0,
          borderTop: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg,rgba(59,130,246,0.04) 0%,transparent 100%)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <a
            href={getInvoiceUrl(orderId)}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textDecoration: 'none',
              padding: '10px 16px', borderRadius: '10px',
              border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)',
            }}
          ><FileText size={14} />Receipt</a>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px 20px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg,var(--primary-blue),#3b82f6)',
              color: 'white', fontWeight: 800, fontSize: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 6px 18px rgba(59,130,246,0.35)',
            }}
          >Done <ArrowRight size={15} /></button>
        </div>
      </div>

      <style>{`
        @keyframes otmSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes otmSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes otmPulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.45; }
        }
        .otm-step-active {
          position: relative;
        }
        .otm-step-active::after {
          content: '';
          position: absolute;
          inset: -5px;
          border-radius: 50%;
          border: 2px solid rgba(59,130,246,0.45);
          animation: otmRipple 1.8s infinite cubic-bezier(0.4,0,0.6,1);
          pointer-events: none;
        }
        @keyframes otmRipple {
          0%   { transform:scale(0.9); opacity:0.8; }
          70%  { transform:scale(1.2); opacity:0; }
          100% { transform:scale(0.9); opacity:0; }
        }
        @media (max-width: 520px) {
          /* Full-width on mobile */
          [data-otm-drawer] { max-width: 100% !important; }
        }
      `}</style>
    </>
  );
}
