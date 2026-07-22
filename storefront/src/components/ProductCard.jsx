import React, { useState, memo } from 'react';
import { X, Star, Heart, ShoppingCart, GitCompareArrows, Bell } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useWishlist } from '../context/WishlistContext';
import { useUser } from '../context/UserContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { useComparison } from '../context/ComparisonContext';


function ProductCard({ id, name, price, image, rating, discount_percent, sale_ends_at, stock_quantity, status = 'active', onClick, onRemove, description }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { formatPrice } = useSettings();
  const safeRating = parseFloat(rating) || 0;
  
  const discount = parseInt(discount_percent) || 0;
  const isSaleActive = discount > 0 && (!sale_ends_at || new Date(sale_ends_at) > new Date());
  const discountedPrice = isSaleActive ? price * (1 - discount / 100) : price;
  const effectivePrice = isSaleActive ? discountedPrice : price;
  const stockQty = Number.isFinite(Number(stock_quantity)) ? Number(stock_quantity) : null;
  
  // Use hooks for wishlist, user, comparison state
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user, openAuthModal } = useUser();
  const { addToCart } = useCart();
  const { addToast } = useNotifications();
  const { addToCompare, removeFromCompare, isInCompare, compareList } = useComparison();
  const isOutOfStock = status === 'out_of_stock' || (stockQty !== null && stockQty <= 0);
  const inWishlist = isInWishlist(id);
  const inCompare = isInCompare(id);
  const compareAtMax = compareList.length >= 3 && !inCompare; 

  const handleWishlistClick = (e) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal('signin');
      return;
    }
    toggleWishlist({ id, name, price: effectivePrice, original_price: price, discount_percent: discount, image, rating });
  };

  const handleAddToCart = (e) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    if (!user) {
      if (openAuthModal) openAuthModal('signin');
      return;
    }
    addToCart({ id, name, price: effectivePrice, original_price: price, discount_percent: discount, image, rating });
    addToast(`${name} added to cart`, 'success');
  };

  const handleNotifyMe = async (e) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal('signin');
      return;
    }

    setIsNotifying(true);

    try {
      let token;
      try {
        token = localStorage.getItem('token');
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          console.warn('Storage quota exceeded when getting token');
        }
      }
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/stock_notifications.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: id,
          email: user.email,
          phone: user.phone || null,
          notification_method: 'both'
        })
      });

      const data = await response.json();

      if (data.success) {
        addToast(data.message || 'You will be notified when this product is back in stock', 'success');
      } else {
        addToast(data.error || 'Failed to request notification', 'error');
      }
    } catch {
      addToast('Failed to request notification. Please try again.', 'error');
    } finally {
      setIsNotifying(false);
    }
  };

  return (
    <div
      className="product-card animate-scale-in"
      onClick={onClick}
      style={{ position: 'relative' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >

      {/* Heart Toggle Button - Shown on all cards if onRemove is NOT present (Shop view) */}
      {!onRemove && (
        <button 
          onClick={handleWishlistClick}
          className={`wishlist-btn ${inWishlist ? 'active' : ''}`}
          title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart 
            size={18} 
            fill={inWishlist ? "currentColor" : "none"} 
            strokeWidth={inWishlist ? 0 : 2}
          />
        </button>
      )}

      {/* Add to Cart / Notify Me Button - Shown on all cards if onRemove is NOT present (Shop view) */}
      {!onRemove && (
        isOutOfStock ? (
          <button
            onClick={handleNotifyMe}
            className="add-to-cart-btn"
            title="Notify me when in stock"
            aria-label="Notify me when in stock"
            disabled={isNotifying}
            style={{
              background: 'var(--warning)',
              cursor: isNotifying ? 'not-allowed' : 'pointer',
              opacity: isNotifying ? 0.7 : 1
            }}
          >
            <Bell size={18} />
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            className="add-to-cart-btn"
            title="Add to cart"
            aria-label="Add to cart"
          >
            <ShoppingCart size={18} />
          </button>
        )
      )}

      {/* Compare Toggle Button */}
      {!onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            inCompare ? removeFromCompare(id) : addToCompare({ id, name, price, image, rating, discount_percent, sale_ends_at, stock_quantity, status, category: undefined });
          }}
          title={compareAtMax ? 'Max 3 products' : inCompare ? 'Remove from compare' : 'Add to compare'}
          aria-label={inCompare ? 'Remove from compare' : 'Add to compare'}
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            width: '32px', height: '32px',
            borderRadius: '8px',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: compareAtMax ? 'not-allowed' : 'pointer',
            background: inCompare ? 'var(--primary-blue)' : 'var(--bg-surface)',
            color: inCompare ? '#fff' : 'var(--text-muted)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            opacity: compareAtMax ? 0.4 : 1,
            transition: 'all 0.2s',
            zIndex: 12,
          }}
        >
          <GitCompareArrows size={14} />
        </button>
      )}

      
      {onRemove && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="wishlist-btn" 
          title="Remove from favorites"
          aria-label="Remove from favorites"
        >
          <X size={18} />
        </button>
      )}

      <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-sm)', overflow: 'hidden', aspectRatio: '1/1' }}>
        {!imgLoaded && (
          <div className="skeleton" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 'inherit' }}></div>
        )}
        <img 
          src={image} 
          alt={name} 
          className="product-image" 
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in-out', width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {isSaleActive && (
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'var(--danger)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: 800,
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            letterSpacing: '0.02em'
          }}>
            {discount}% OFF
          </div>
        )}
        {isOutOfStock && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5
          }}>
            <span style={{
              background: 'white',
              color: 'black',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '13px',
              letterSpacing: '0.05em',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }}>
              SOLD OUT
            </span>
          </div>
        )}
      </div>

      <div className="product-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ margin: 0 }}>{name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--warning-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                <Star size={10} fill="var(--warning)" color="var(--warning)" />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)' }}>{safeRating.toFixed(1)}</span>
            </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <p style={{ margin: 0, fontWeight: 700, color: isSaleActive ? 'var(--success)' : 'inherit', fontSize: '16px' }}>
                {formatPrice(effectivePrice)}
            </p>
            {isSaleActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.7 }}>
                      {formatPrice(price)}
                  </p>
                  <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 700 }}>
                    -{discount}%
                  </span>
                </div>
            )}
        </div>
        {stockQty !== null && stockQty > 0 && !isOutOfStock && (
          stockQty <= 5 ? (
            <p className="stock-urgency-pulse" style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--danger)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px' }}>🔥</span> Only {stockQty} left!
            </p>
          ) : stockQty <= 10 ? (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px' }}>⚡</span> Selling fast
            </p>
          ) : (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
              ✓ In Stock
            </p>
          )
        )}
      </div>

      {/* Description Tooltip */}
      {showTooltip && description && (
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxHeight: '40%',
          background: 'rgba(0, 0, 0, 0.08)',
          color: 'var(--text-main)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          lineHeight: '1.3',
          zIndex: 10,
          whiteSpace: 'normal',
          wordWrap: 'break-word',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          backdropFilter: 'blur(2px)',
          overflow: 'auto'
        }}>
          {description}
        </div>
      )}
    </div>
  );
}

export default memo(ProductCard);