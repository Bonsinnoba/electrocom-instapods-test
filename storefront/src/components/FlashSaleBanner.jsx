import React, { useState, useEffect, useMemo, memo } from 'react';
import { Flame, Clock, ArrowRight, Percent, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

function FlashSaleBanner({ products, onProductClick }) {
  const navigate = useNavigate();
  const { formatPrice } = useSettings();

  // 1. Scan catalog for active discounted products with future end times
  const featuredProduct = useMemo(() => {
    if (!products || !Array.isArray(products)) return null;
    
    const discounted = products.filter(p => {
      const discount = parseInt(p.discount_percent) || 0;
      const isAvailable = Number(p.stock_quantity) > 0 && p.status !== 'out_of_stock';
      const hasFutureDate = p.sale_ends_at ? new Date(p.sale_ends_at) > new Date() : true;
      return discount > 0 && isAvailable && hasFutureDate;
    });

    if (discounted.length === 0) return null;

    // Spotlight the product with the highest discount percentage
    return discounted.reduce((max, current) => {
      const maxDisc = parseInt(max.discount_percent) || 0;
      const curDisc = parseInt(current.discount_percent) || 0;
      return curDisc > maxDisc ? current : max;
    }, discounted[0]);
  }, [products]);

  // Determine targeted deadline (Product sale end time or rolling midnight fallback)
  const targetTime = useMemo(() => {
    if (featuredProduct && featuredProduct.sale_ends_at) {
      return new Date(featuredProduct.sale_ends_at).getTime();
    }
    // Fallback: Rolling midnight countdown
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime();
  }, [featuredProduct]);

  // 2. Countdown timer state and interval loop
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const updateCountdown = () => {
      const difference = targetTime - new Date().getTime();
      
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);
    return () => clearInterval(intervalId);
  }, [targetTime]);

  const handleBannerAction = () => {
    if (featuredProduct) {
      if (onProductClick) onProductClick(featuredProduct);
    } else {
      navigate('/shop');
    }
  };

  // Pre-calculate prices
  const discount = featuredProduct ? parseInt(featuredProduct.discount_percent) || 0 : 35;
  const originalPrice = featuredProduct ? parseFloat(featuredProduct.price) || 0 : 0;
  const promoPrice = featuredProduct ? originalPrice * (1 - discount / 100) : 0;

  return (
    <div 
      className="flash-sale-banner glass animate-scale-in"
      onClick={handleBannerAction}
      style={{
        position: 'relative',
        padding: '24px 32px',
        borderRadius: '24px',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(245, 158, 11, 0.04) 50%, rgba(59, 130, 246, 0.1) 100%)',
        backdropFilter: 'blur(12px)',
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s ease, box-shadow 0.4s ease'
      }}
    >
      {/* Background ambient glows */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-10%',
        width: '250px',
        height: '250px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, rgba(239, 68, 68, 0) 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-50%',
        right: '-10%',
        width: '250px',
        height: '250px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0) 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }}></div>

      {/* Title & Info Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1, flex: '1 1 300px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            padding: '8px',
            borderRadius: '12px',
            color: 'rgb(239, 68, 68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)'
          }} className="flame-icon-pulse">
            <Flame size={20} fill="currentColor" />
          </div>
          <span style={{
            fontSize: '13px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: 'rgb(239, 68, 68)',
            textShadow: '0 0 10px rgba(239, 68, 68, 0.2)'
          }}>
            Limited Time Flash Sale
          </span>
        </div>

        {featuredProduct ? (
          <div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.8px', color: 'var(--text-main)' }}>
              Spotlight Deal: {featuredProduct.name}
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Incredible savings on premium electronics. Grab it before stock runs out!
            </p>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.8px', color: 'var(--text-main)' }}>
              Weekend Tech Extravaganza
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Save up to 35% across our entire catalog of top-grade microcontrollers and components!
            </p>
          </div>
        )}
      </div>

      {/* Timer & Product / Promo CTA side */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '24px',
        zIndex: 1,
        justifyContent: 'flex-start'
      }}>
        {/* Countdown Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[
            { value: timeLeft.days, label: 'Days' },
            { value: timeLeft.hours, label: 'Hrs' },
            { value: timeLeft.minutes, label: 'Mins' },
            { value: timeLeft.seconds, label: 'Secs' }
          ].map((item, idx) => (
            <React.Fragment key={item.label}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  width: '54px',
                  height: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  fontWeight: 900,
                  color: 'var(--primary-gold)',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
                }} className="countdown-box">
                  {String(item.value).padStart(2, '0')}
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {item.label}
                </span>
              </div>
              {idx < 3 && (
                <span style={{
                  fontSize: '20px',
                  fontWeight: 900,
                  color: 'rgba(255, 255, 255, 0.15)',
                  marginBottom: '18px'
                }}>
                  :
                </span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Featured Product Info OR Generic Promo Details */}
        {featuredProduct ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '8px 16px 8px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            position: 'relative',
            overflow: 'visible'
          }} className="banner-product-card">
            {/* Image */}
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <img 
                src={featuredProduct.image} 
                alt={featuredProduct.name} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            
            {/* Price block */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                {formatPrice(originalPrice)}
              </span>
              <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--success)' }}>
                {formatPrice(promoPrice)}
              </span>
            </div>

            {/* Discount Badge */}
            <div style={{
              position: 'absolute',
              top: '-12px',
              right: '-12px',
              background: 'rgb(239, 68, 68)',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 900,
              padding: '4px 8px',
              borderRadius: '100px',
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              letterSpacing: '0.5px'
            }}>
              SAVE {discount}%
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sparkles size={16} color="var(--primary-gold)" />
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary-gold)' }}>
              CODE: FLASH35
            </span>
          </div>
        )}

        {/* Action CTA Button */}
        <button 
          className="btn-primary banner-cta-button"
          style={{
            height: '48px',
            padding: '0 24px',
            borderRadius: '14px',
            fontWeight: 800,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 20px rgba(239, 68, 68, 0.25)',
            background: 'rgb(239, 68, 68)',
            border: 'none',
            color: '#ffffff',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            cursor: 'pointer'
          }}
        >
          {featuredProduct ? 'Shop Deal' : 'Claim Deal'} <ArrowRight size={16} />
        </button>
      </div>

      {/* Styled Micro-Animations & Responsive Queries */}
      <style dangerouslySetInnerHTML={{ __html: `
        .flash-sale-banner:hover {
          transform: translateY(-4px);
          border-color: rgba(239, 68, 68, 0.2) !important;
          box-shadow: 0 25px 50px rgba(239, 68, 68, 0.15) !important;
        }
        .flash-sale-banner:hover .banner-cta-button {
          transform: scale(1.04);
          box-shadow: 0 10px 24px rgba(239, 68, 68, 0.4) !important;
        }
        .flame-icon-pulse {
          animation: flame-pulse 1.5s infinite ease-in-out;
        }
        @keyframes flame-pulse {
          0% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.5)); }
          50% { transform: scale(1.12); filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.8)); }
          100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.5)); }
        }
        @media (max-width: 768px) {
          .flash-sale-banner {
            padding: 20px !important;
          }
          .countdown-box {
            width: 46px !important;
            height: 44px !important;
            fontSize: 18px !important;
          }
        }
      `}} />
    </div>
  );
}

export default memo(FlashSaleBanner);
