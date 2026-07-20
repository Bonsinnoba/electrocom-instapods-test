import React, { useState, useEffect, useMemo, memo } from 'react';
import { Flame, Clock, ArrowRight, Percent, Sparkles, AlertTriangle, TrendingUp, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { fetchFlashSaleBannerSettings } from '../services/api';

function FlashSaleBanner({ products, onProductClick }) {
  const navigate = useNavigate();
  const { formatPrice } = useSettings();
  const [bannerSettings, setBannerSettings] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Load banner settings on mount
  useEffect(() => {
    fetchFlashSaleBannerSettings().then(settings => {
      if (settings) {
        setBannerSettings(settings);
      }
    });
  }, []);

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

  // 2. Fallback: Get useful content when no flash sales
  const fallbackContent = useMemo(() => {
    if (!products || !Array.isArray(products)) return null;

    const settings = bannerSettings || {};

    // Priority 1: New arrivals (products added in last X days)
    if (settings.new_arrivals_enabled) {
      const daysThreshold = settings.new_arrivals_days || 7;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
      const newArrivals = products.filter(p => {
        const created = new Date(p.created_at || p.created_at || 0);
        return created > thresholdDate && p.status !== 'out_of_stock' && Number(p.stock_quantity) > 0;
      });

      if (newArrivals.length > 0) {
        return {
          type: 'new_arrivals',
          title: settings.new_arrivals_title || 'Just Arrived',
          subtitle: (settings.new_arrivals_subtitle || '{count} new products added this week').replace('{count}', newArrivals.length),
          icon: 'Sparkles',
          color: 'var(--primary-blue)',
          bgGradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(147, 51, 234, 0.08) 50%, rgba(59, 130, 246, 0.1) 100%)',
          featuredProduct: newArrivals[0],
          cta: settings.new_arrivals_cta || 'Explore New'
        };
      }
    }

    // Priority 2: Low stock alerts (products with < X items)
    if (settings.low_stock_enabled) {
      const stockThreshold = settings.low_stock_threshold || 5;
      const lowStock = products.filter(p => {
        return Number(p.stock_quantity) > 0 && Number(p.stock_quantity) < stockThreshold && p.status !== 'out_of_stock';
      });

      if (lowStock.length > 0) {
        return {
          type: 'low_stock',
          title: settings.low_stock_title || 'Low Stock Alert',
          subtitle: (settings.low_stock_subtitle || '{count} items running low - grab them before they\'re gone').replace('{count}', lowStock.length),
          icon: 'AlertTriangle',
          color: 'rgb(245, 158, 11)',
          bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(239, 68, 68, 0.08) 50%, rgba(245, 158, 11, 0.1) 100%)',
          featuredProduct: lowStock[0],
          cta: settings.low_stock_cta || 'Shop Now'
        };
      }
    }

    // Priority 3: Popular products (highest sold count)
    if (settings.popular_enabled) {
      const popular = [...products]
        .filter(p => p.status !== 'out_of_stock' && Number(p.stock_quantity) > 0)
        .sort((a, b) => Number(b.total_sold || b.sold || 0) - Number(a.total_sold || a.sold || 0));

      if (popular.length > 0 && Number(popular[0].total_sold || popular[0].sold || 0) > 0) {
        return {
          type: 'popular',
          title: settings.popular_title || 'Trending Now',
          subtitle: settings.popular_subtitle || 'Most popular items based on customer purchases',
          icon: 'TrendingUp',
          color: 'var(--primary-gold)',
          bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(234, 179, 8, 0.08) 50%, rgba(245, 158, 11, 0.1) 100%)',
          featuredProduct: popular[0],
          cta: settings.popular_cta || 'View Popular'
        };
      }
    }

    // Priority 4: General store promotion
    if (settings.promotion_enabled) {
      return {
        type: 'promotion',
        title: settings.promotion_title || 'Free Shipping',
        subtitle: settings.promotion_subtitle || 'On orders over GHS 500',
        icon: 'Truck',
        color: 'var(--success)',
        bgGradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(16, 185, 129, 0.08) 50%, rgba(34, 197, 94, 0.1) 100%)',
        featuredProduct: null,
        cta: settings.promotion_cta || 'Start Shopping'
      };
    }

    return null;
  }, [products, bannerSettings]);

  // Determine what to show
  const bannerContent = featuredProduct ? {
    type: 'flash_sale',
    title: (bannerSettings?.flash_sale_title || 'Limited Time Flash Sale'),
    subtitle: featuredProduct ? (bannerSettings?.flash_sale_subtitle || 'Spotlight Deal: {product_name}').replace('{product_name}', featuredProduct.name) : 'Incredible savings on premium electronics',
    icon: 'Flame',
    color: 'rgb(239, 68, 68)',
    bgGradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(245, 158, 11, 0.04) 50%, rgba(59, 130, 246, 0.1) 100%)',
    featuredProduct: featuredProduct,
    cta: bannerSettings?.flash_sale_cta || 'Shop Deal'
  } : fallbackContent;

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

  // Countdown timer effect
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

  // Don't show if disabled in settings or no content
  if (bannerSettings && !bannerSettings.is_enabled) return null;
  if (!bannerContent) return null;

  const handleBannerAction = () => {
    if (bannerContent.featuredProduct) {
      if (onProductClick) onProductClick(bannerContent.featuredProduct);
    } else {
      navigate('/shop');
    }
  };

  // Pre-calculate prices
  const discount = bannerContent.featuredProduct ? parseInt(bannerContent.featuredProduct.discount_percent) || 0 : 0;
  const originalPrice = bannerContent.featuredProduct ? parseFloat(bannerContent.featuredProduct.price) || 0 : 0;
  const promoPrice = bannerContent.featuredProduct ? originalPrice * (1 - discount / 100) : 0;

  // Icon mapping
  const iconMap = {
    Flame: Flame,
    Sparkles: Sparkles,
    AlertTriangle: AlertTriangle,
    TrendingUp: TrendingUp,
    Truck: Truck
  };
  const IconComponent = iconMap[bannerContent.icon] || Flame;

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
        background: bannerContent.bgGradient,
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
        background: `radial-gradient(circle, ${bannerContent.color}25 0%, ${bannerContent.color}00 70%)`,
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
        background: `radial-gradient(circle, ${bannerContent.color}20 0%, ${bannerContent.color}00 70%)`,
        pointerEvents: 'none',
        zIndex: 0
      }}></div>

      {/* Title & Info Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1, flex: '1 1 300px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: `${bannerContent.color}25`,
            padding: '8px',
            borderRadius: '12px',
            color: bannerContent.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 15px ${bannerContent.color}4D`
          }} className="flame-icon-pulse">
            <IconComponent size={20} fill={bannerContent.type === 'flash_sale' ? 'currentColor' : 'none'} />
          </div>
          <span style={{
            fontSize: '13px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: bannerContent.color,
            textShadow: `0 0 10px ${bannerContent.color}33`
          }}>
            {bannerContent.title}
          </span>
        </div>

        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.8px', color: 'var(--text-main)' }}>
            {bannerContent.subtitle}
          </h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
            {bannerContent.type === 'flash_sale' && 'Incredible savings on premium electronics. Grab it before stock runs out!'}
            {bannerContent.type === 'new_arrivals' && 'Discover our latest additions to the catalog'}
            {bannerContent.type === 'low_stock' && 'Limited availability - act fast before they sell out'}
            {bannerContent.type === 'popular' && 'See what other customers are buying right now'}
            {bannerContent.type === 'promotion' && 'Shop today and save on delivery costs'}
          </p>
        </div>
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
        {/* Countdown Stepper - Only show for flash sales */}
        {bannerContent.type === 'flash_sale' && (
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
        )}

        {/* Featured Product Info OR Generic Promo Details */}
        {bannerContent.featuredProduct ? (
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
                src={bannerContent.featuredProduct.image} 
                alt={bannerContent.featuredProduct.name} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            
            {/* Price block */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {bannerContent.type === 'flash_sale' && (
                <>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    {formatPrice(originalPrice)}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--success)' }}>
                    {formatPrice(promoPrice)}
                  </span>
                </>
              )}
              {bannerContent.type !== 'flash_sale' && (
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                  {bannerContent.featuredProduct.name}
                </span>
              )}
            </div>

            {/* Discount Badge - Only for flash sales */}
            {bannerContent.type === 'flash_sale' && discount > 0 && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                background: bannerContent.color,
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 900,
                padding: '4px 8px',
                borderRadius: '100px',
                boxShadow: `0 4px 10px ${bannerContent.color}66`,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                letterSpacing: '0.5px'
              }}>
                SAVE {discount}%
              </div>
            )}
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
            <IconComponent size={16} color={bannerContent.color} />
            <span style={{ fontSize: '14px', fontWeight: 800, color: bannerContent.color }}>
              {bannerContent.type === 'promotion' ? 'FREE SHIPPING' : 'EXPLORE NOW'}
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
            boxShadow: `0 8px 20px ${bannerContent.color}40`,
            background: bannerContent.color,
            border: 'none',
            color: '#ffffff',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            cursor: 'pointer'
          }}
        >
          {bannerContent.cta} <ArrowRight size={16} />
        </button>
      </div>

      {/* Styled Micro-Animations & Responsive Queries */}
      <style dangerouslySetInnerHTML={{ __html: `
        .flash-sale-banner:hover {
          transform: translateY(-4px);
          border-color: ${bannerContent.color}33 !important;
          box-shadow: 0 25px 50px ${bannerContent.color}26 !important;
        }
        .flash-sale-banner:hover .banner-cta-button {
          transform: scale(1.04);
          box-shadow: 0 10px 24px ${bannerContent.color}66 !important;
        }
        .flame-icon-pulse {
          animation: flame-pulse 1.5s infinite ease-in-out;
        }
        @keyframes flame-pulse {
          0% { transform: scale(1); filter: drop-shadow(0 0 2px ${bannerContent.color}80); }
          50% { transform: scale(1.12); filter: drop-shadow(0 0 12px ${bannerContent.color}); }
          100% { transform: scale(1); filter: drop-shadow(0 0 2px ${bannerContent.color}80); }
        }
        @media (max-width: 768px) {
          .flash-sale-banner {
            padding: 20px !important;
          }
          .countdown-box {
            width: 46px !important;
            height: 44px !important;
            font-size: 18px !important;
          }
        }
      `}} />
    </div>
  );
}

export default memo(FlashSaleBanner);
