import React, { useState, useEffect, memo } from 'react';
import { X, Plus, Minus, ShoppingCart, Heart, FileText, Info, List, Settings, Star, MessageSquare, Send, ShoppingBag, CheckCircle } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useSettings } from '../context/SettingsContext';
import { useUser } from '../context/UserContext';
import { fetchProductReviews, submitReview, formatImageUrl } from '../services/api';


function ProductModal({ product, products = [], isOpen, onClose, onAddToCart, onAddToWishlist, onProductClick }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0] || 'Default');
  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0] || null);
  const [activeImage, setActiveImage] = useState(product?.image);
  const { isInWishlist } = useWishlist();
  const { formatPrice } = useSettings();
  const { user, openAuthModal } = useUser();

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ average_rating: 0, total_reviews: 0 });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  useEffect(() => {
    if (product) {
      setActiveImage(product.image);
      setQuantity(1);
      setSelectedColor(product.colors?.[0] || 'Default');
      setSelectedVariant(product.variants?.[0] || null);
      setReviewMessage('');
      setReviewComment('');
      setReviewRating(5);
      // Fetch reviews
      fetchProductReviews(product.id).then(data => {
        setReviews(data.reviews || []);
        setReviewStats({ average_rating: data.average_rating, total_reviews: data.total_reviews });
      });
    }
  }, [product]);

  const handleSubmitReview = async () => {
    if (!reviewComment.trim()) return;
    setReviewSubmitting(true);
    setReviewMessage('');
    try {
      const result = await submitReview(product.id, reviewRating, reviewComment);
      if (result.success) {
        setReviewMessage('Review submitted!');
        setReviewComment('');
        // Refresh reviews
        const data = await fetchProductReviews(product.id);
        setReviews(data.reviews || []);
        setReviewStats({ average_rating: data.average_rating, total_reviews: data.total_reviews });
      } else {
        setReviewMessage(result.error || 'Failed to submit review');
      }
    } catch {
      setReviewMessage('Failed to submit review. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');

  if (!isOpen || !product) return null;

  const inWishlist = isInWishlist(product.id);
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  const allImages = Array.from(new Set([product.image, ...gallery].filter(Boolean))).slice(0, 4);
  const datasheetUrl = product.datasheet_url || `https://www.google.com/search?q=${encodeURIComponent(`${product.product_code} ${product.name} datasheet pdf`)}`;

  // Smarter recommendations based on category, price proximity, ratings, popularity, and user behavior.
  let related = [];
  try {
    let historyStr, recentViewsStr;
    try {
      historyStr = localStorage.getItem('ehub_view_history') || '{}';
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when loading view history');
      }
      historyStr = '{}';
    }
    try {
      recentViewsStr = localStorage.getItem('ehub_recent_views') || '[]';
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when loading recent views');
      }
      recentViewsStr = '[]';
    }
    const history = JSON.parse(historyStr);
    const recentViews = JSON.parse(recentViewsStr);
    const recentSet = new Set(Array.isArray(recentViews) ? recentViews : []);
    const currentPrice = parseFloat(product.price) || 0;
    const categoryKey = String(product.category || '').toLowerCase();
    const candidates = (products || []).filter((p) => p.id !== product.id);
    related = candidates
      .map((p, idx) => {
        const pPrice = parseFloat(p.price) || 0;
        const priceDiff = currentPrice > 0 ? Math.abs(pPrice - currentPrice) / currentPrice : 1;
        const sameCategory = String(p.category || '').toLowerCase() === categoryKey ? 1 : 0;
        const viewScore = Number(history[p.id] || 0);
        const ratingScore = parseFloat(p.rating) || 0;
        const popularity = Number(p.total_sold || p.sold || 0);
        const recentPenalty = recentSet.has(p.id) ? -1.2 : 0;
        const score =
          sameCategory * 4 +
          (1 - Math.min(priceDiff, 1)) * 2 +
          ratingScore * 1.4 +
          popularity * 0.03 +
          viewScore * 0.6 +
          recentPenalty;
        return { p, idx, score };
      })
      .sort((a, b) => (b.score - a.score) || (a.idx - b.idx))
      .slice(0, 4)
      .map((entry) => entry.p);
  } catch {
    related = (products || [])
      .filter(p => p.category === product.category && p.id !== product.id)
      .slice(0, 4);
  }

  const isOutOfStock = product.status === 'out_of_stock' || (product.stock_quantity !== null && product.stock_quantity <= 0);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    if (!user) {
      if (openAuthModal) openAuthModal('signin');
      return;
    }
    setIsAdding(true);
    const cartProduct = {
      ...product,
      price: currentPrice.toString(),
      original_price: basePrice + (selectedVariant ? parseFloat(selectedVariant.price_modifier) : 0),
      discount_percent: discount,
      image: (selectedVariant && selectedVariant.image_url) ? formatImageUrl(selectedVariant.image_url) : product.image,
      variant_sku: selectedVariant ? selectedVariant.sku : null,
      selected_attributes: selectedVariant ? selectedVariant.attributes : null
    };
    // Ensure uniqueness in cart if different variant
    cartProduct.id = selectedVariant ? `${product.id}-${selectedVariant.id}` : product.id;
    onAddToCart(cartProduct, quantity, selectedColor);
    setTimeout(() => setIsAdding(false), 2000);
  };

  const discount = parseInt(product.discount_percent) || 0;
  const isSaleActive = discount > 0 && (!product.sale_ends_at || new Date(product.sale_ends_at) > new Date());
  
  const basePrice = parseFloat(product.price);
  const effectiveBasePrice = isSaleActive ? basePrice * (1 - discount / 100) : basePrice;
  const currentPrice = effectiveBasePrice + (selectedVariant ? parseFloat(selectedVariant.price_modifier) : 0);

  const handleAddToWishlist = () => {
    setIsSaving(true);
    onAddToWishlist({
      ...product,
      price: currentPrice,
      original_price: basePrice + (selectedVariant ? parseFloat(selectedVariant.price_modifier) : 0),
      discount_percent: discount
    });
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleNotifyMe = async () => {
    if (!user) {
      if (openAuthModal) openAuthModal('signin');
      return;
    }

    setIsNotifying(true);
    setNotifyMessage('');

    try {
      let token;
      try {
        token = localStorage.getItem('token');
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          console.warn('Storage quota exceeded when getting token');
        }
      }
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/stock_notifications.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: product.id,
          email: user.email,
          phone: user.phone || null,
          notification_method: 'both'
        })
      });

      const data = await response.json();

      if (data.success) {
        setNotifyMessage(data.message || 'You will be notified when this product is back in stock');
      } else {
        setNotifyMessage(data.error || 'Failed to request notification');
      }
    } catch {
      setNotifyMessage('Failed to request notification. Please try again.');
    } finally {
      setIsNotifying(false);
    }
  };

  return (
    <div className={`modal-backdrop active`} onClick={onClose}>
      <div className="product-modal modal glass animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '20px', 
            right: '20px', 
            width: '32px', 
            height: '32px', 
            padding: 0, 
            borderRadius: '50%',
            zIndex: 10,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
        >
          <X size={18} />
        </button>
        
        <div className="product-modal-content">
          {/* Left Column: Image & Actions */}
          <div className="product-modal-image" style={{ minWidth: 0 }}>
            {/* Main Image View Area */}
            <div className="modal-gallery-layout">
              {/* Vertical Sidebar Thumbnails */}
              {allImages.length > 1 && (
                <div className="modal-thumbnails-sidebar">
                  {allImages.map((img, idx) => (
                    <div 
                      key={idx}
                      className={`thumbnail-item ${activeImage === img ? 'active' : ''}`}
                      onClick={() => setActiveImage(img)}
                    >
                      <img
                        src={img}
                        alt={`View ${idx + 1}`}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '8px'
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Primary Image Stage */}
              <div className="modal-image-stage">
                <img 
                  src={(selectedVariant && selectedVariant.image_url) ? formatImageUrl(selectedVariant.image_url) : activeImage} 
                  alt={product.name} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain', 
                    borderRadius: '16px' 
                  }} 
                />
              </div>
            </div>

            {/* Config & Actions Group */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
              {/* Quantity & Color Row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
                <div className="detail-section">
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Quantity</label>
                  <div className="quantity-selector" style={{ background: 'var(--bg-surface-secondary)', padding: '4px', borderRadius: '12px', opacity: isOutOfStock ? 0.5 : 1 }}>
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={isOutOfStock}><Minus size={14} /></button>
                    <span style={{ margin: '0 12px', fontWeight: 700 }}>{isOutOfStock ? 0 : quantity}</span>
                    <button onClick={() => setQuantity(quantity + 1)} disabled={isOutOfStock}><Plus size={14} /></button>
                  </div>
                </div>

                {product.colors && product.colors.length > 0 && (
                  <div className="detail-section">
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Color</label>
                    <div className="color-swatches" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {product.colors.map(color => (
                        <button 
                          key={color} 
                          className={`color-swatch ${selectedColor === color ? 'active' : ''}`}
                          style={{ backgroundColor: color.toLowerCase(), width: '28px', height: '28px' }}
                          onClick={() => setSelectedColor(color)}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {product.variants && product.variants.length > 0 && (
                  <div className="detail-section" style={{ width: '100%', marginTop: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Settings size={14} /> Options & Variations
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {product.variants.map(v => {
                        const label = v.sku || Object.values(v.attributes || {}).join(' - ') || 'Variant';
                        const isSelected = selectedVariant?.id === v.id;
                        return (
                          <button 
                            key={v.id} 
                            onClick={() => setSelectedVariant(v)}
                            className={`variant-chip ${isSelected ? 'active' : ''}`}
                            style={{ 
                              padding: '10px 16px', 
                              borderRadius: '12px', 
                              fontSize: '13px',
                              fontWeight: 600,
                              border: '2px solid',
                              borderColor: isSelected ? 'var(--primary-blue)' : 'var(--border-light)',
                              color: isSelected ? 'var(--primary-blue)' : 'var(--text-main)',
                              background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-surface)',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none',
                              transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                            }}
                            onMouseEnter={(e) => !isSelected && (e.currentTarget.style.borderColor = 'var(--primary-blue)')}
                            onMouseLeave={(e) => !isSelected && (e.currentTarget.style.borderColor = 'var(--border-light)')}
                          >
                            {isSelected && <CheckCircle size={14} className="animate-scale-in" />}
                            <span>{label}</span>
                            {parseFloat(v.price_modifier) > 0 && (
                              <span style={{ 
                                fontSize: '11px', 
                                opacity: 0.8,
                                background: isSelected ? 'var(--primary-blue)' : 'var(--bg-surface-secondary)',
                                color: isSelected ? 'white' : 'var(--text-muted)',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                marginLeft: '4px'
                              }}>
                                +{formatPrice(parseFloat(v.price_modifier))}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Side-by-Side Primary Actions */}
              <div className="modal-primary-actions" style={{ display: 'flex', gap: '12px', width: '100%', flexWrap: 'wrap' }}>
                {isOutOfStock ? (
                  <>
                    <button
                      className="btn-primary"
                      onClick={handleNotifyMe}
                      disabled={isNotifying}
                      style={{
                        flex: 1.5,
                        padding: '14px 10px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: 700,
                        background: isNotifying ? 'var(--text-muted)' : 'var(--warning)',
                        color: 'white',
                        whiteSpace: 'nowrap',
                        cursor: isNotifying ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    >
                      <Bell size={18} />
                      {isNotifying ? 'Requesting...' : 'Notify Me When in Stock'}
                    </button>
                    <button
                      className={`btn-outline ${inWishlist ? 'active' : ''} ${isSaving ? 'animate-scale-in' : ''}`}
                      onClick={handleAddToWishlist}
                      style={{
                        flex: 1,
                        padding: '14px 10px',
                        borderRadius: '14px',
                        background: inWishlist ? 'var(--danger-bg)' : 'var(--bg-surface)',
                        color: inWishlist ? 'var(--danger)' : 'var(--primary-blue)',
                        borderColor: inWishlist ? 'var(--danger)' : 'var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: '1px solid',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <Heart size={18} fill={inWishlist ? "var(--danger)" : "none"} className={isSaving ? 'animate-scale-in' : ''} />
                      {isSaving ? (inWishlist ? 'Saved!' : 'Removed!') : (inWishlist ? 'Favorite' : 'Save')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={`btn-primary ${isAdding ? 'animate-pulse-success' : ''}`}
                      onClick={handleAddToCart}
                      disabled={isAdding}
                      style={{
                        flex: 1.5,
                        padding: '14px 10px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: 700,
                        boxShadow: isAdding ? '0 4px 20px rgba(16, 185, 129, 0.4)' : '0 4px 12px rgba(59, 130, 246, 0.2)',
                        background: isAdding ? 'var(--success)' : 'var(--primary-blue)',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    >
                      <ShoppingCart size={18} className={isAdding ? 'animate-scale-in' : ''} />
                      {isAdding ? 'Added!' : 'Add to Cart'}
                    </button>
                    <button
                      className={`btn-outline ${inWishlist ? 'active' : ''} ${isSaving ? 'animate-scale-in' : ''}`}
                      onClick={handleAddToWishlist}
                      style={{
                        flex: 1,
                        padding: '14px 10px',
                        borderRadius: '14px',
                        background: inWishlist ? 'var(--danger-bg)' : 'var(--bg-surface)',
                        color: inWishlist ? 'var(--danger)' : 'var(--primary-blue)',
                        borderColor: inWishlist ? 'var(--danger)' : 'var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: '1px solid',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <Heart size={18} fill={inWishlist ? "var(--danger)" : "none"} className={isSaving ? 'animate-scale-in' : ''} />
                      {isSaving ? (inWishlist ? 'Saved!' : 'Removed!') : (inWishlist ? 'Favorite' : 'Save')}
                    </button>
                  </>
                )}
              </div>

              {notifyMessage && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: notifyMessage.includes('Failed') ? 'var(--danger-bg)' : 'var(--success-bg)',
                  color: notifyMessage.includes('Failed') ? 'var(--danger)' : 'var(--success)',
                  fontSize: '13px',
                  fontWeight: 600,
                  textAlign: 'center',
                  border: `1px solid ${notifyMessage.includes('Failed') ? 'var(--danger)' : 'var(--success)'}`
                }}>
                  {notifyMessage}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Info & Details */}
          <div className="product-modal-details" style={{ scrollBehavior: 'smooth', minWidth: 0 }}>
            <h2 className="product-title" style={{ fontSize: '32px', marginBottom: '4px' }}>{product.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <p className="product-price" style={{ 
                      fontSize: '32px', 
                      margin: 0, 
                      color: isSaleActive ? 'var(--success)' : 'inherit',
                      fontWeight: 800
                    }}>
                      {formatPrice(currentPrice)}
                    </p>
                    {isSaleActive && (
                      <p style={{ 
                        fontSize: '18px', 
                        margin: 0, 
                        color: 'var(--text-muted)', 
                        textDecoration: 'line-through',
                        opacity: 0.6
                      }}>
                        {formatPrice(basePrice + (selectedVariant ? parseFloat(selectedVariant.price_modifier) : 0))}
                      </p>
                    )}
                  </div>
                  {isSaleActive && (
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      marginTop: '4px',
                      color: 'var(--danger)',
                      fontSize: '13px',
                      fontWeight: 700
                    }}>
                      <Info size={14} /> Flash Sale: {discount}% OFF 
                      {product.sale_ends_at && (
                        <span style={{ fontWeight: 400, opacity: 0.8 }}>
                          (Ends {new Date(product.sale_ends_at).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--warning-bg)', padding: '6px 14px', borderRadius: '100px', alignSelf: 'flex-start', marginTop: '6px' }}>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map(s => (
                            <Star 
                                key={s} 
                                size={14} 
                                fill={s <= Math.round(product.rating || 5) ? "var(--warning)" : "transparent"} 
                                color={s <= Math.round(product.rating || 5) ? "var(--warning)" : "var(--text-muted)"} 
                            />
                        ))}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--warning)' }}>{(parseFloat(product.rating) || 5.0).toFixed(1)}</span>
                </div>
            </div>

            {product.description && (
              <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
                  {product.description}
                </p>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-light)', margin: '12px 0' }}></div>


            <div className="product-info-tabs">
              {(product.datasheet_url || product.directions) && (
                <div className="info-tab">
                  <h3><FileText size={16} /> Documentation</h3>
                  <p>Full usage guide and safety documentation available for download.</p>
                  {product.datasheet_url ? (
                    <a href={product.datasheet_url} target="_blank" rel="noopener noreferrer" className="docs-link">Download PDF</a>
                  ) : product.directions && (product.directions.startsWith('http') || product.directions.endsWith('.pdf')) ? (
                    <a href={product.directions} target="_blank" rel="noopener noreferrer" className="docs-link">Download PDF</a>
                  ) : null}
                </div>
              )}

              {product.included && product.included.length > 0 && (
                <div className="info-tab">
                  <h3><List size={16} /> Included Items</h3>
                  <ul>
                    {product.included.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}

              {(product.product_code || product.specs || product.directions) && (
                <div className="info-tab">
                  <h3><Settings size={16} /> Technical Specs & User Guide</h3>
                  {product.product_code && (
                    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Component Code: <span style={{ color: 'var(--primary-blue)', fontFamily: 'monospace' }}>{product.product_code}</span>
                      </span>
                      <a
                        href={datasheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline"
                        style={{ fontSize: '12px', padding: '6px 10px', textDecoration: 'none' }}
                      >
                        Find Datasheet
                      </a>
                    </div>
                  )}

                  {/* Specifications */}
                  {product.specs && Object.keys(product.specs).length > 0 && (
                    <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Object.entries(product.specs).map(([key, value]) => (
                        <span key={key} style={{
                          fontSize: '13px',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-surface-secondary)',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-light)'
                        }}>
                          <strong style={{ color: 'var(--text-main)' }}>{key}:</strong> {value}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Directions / PDF Section */}
                  {product.directions && (
                    <div style={{ padding: '16px', background: 'var(--bg-surface-secondary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={14} /> Usage Directions
                      </h4>
                      {product.directions.startsWith('http') || product.directions.endsWith('.pdf') ? (
                        <div>
                          <p style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            A detailed PDF user guide is available with full technical instructions.
                          </p>
                          <a
                            href={product.directions}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 16px',
                              fontSize: '13px',
                              textDecoration: 'none',
                              width: '100%',
                              justifyContent: 'center'
                            }}
                          >
                            <FileText size={16} />
                            Download User Guide (PDF)
                          </a>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                          {product.directions}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Customer Reviews Section */}
              <div className="info-tab">
                <h3><MessageSquare size={16} /> Customer Reviews ({reviewStats.total_reviews})</h3>
                
                {/* Average Rating Summary */}
                {reviewStats.total_reviews > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px', background: 'var(--bg-surface-secondary)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--warning)' }}>{reviewStats.average_rating}</span>
                    <div>
                      <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={14} fill={s <= Math.round(reviewStats.average_rating) ? 'var(--warning)' : 'transparent'} color={s <= Math.round(reviewStats.average_rating) ? 'var(--warning)' : 'var(--text-muted)'} />
                        ))}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Based on {reviewStats.total_reviews} review{reviewStats.total_reviews !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}

                {/* Review List */}
                {reviews.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    {reviews.map(r => (
                      <div key={r.id} style={{ padding: '14px', background: 'var(--bg-surface-secondary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                              {r.avatar_text || r.user_name?.charAt(0) || '?'}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '13px' }}>{r.user_name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} size={12} fill={s <= r.rating ? 'var(--warning)' : 'transparent'} color={s <= r.rating ? 'var(--warning)' : 'var(--text-muted)'} />
                            ))}
                          </div>
                        </div>
                        {r.comment && <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-muted)' }}>{r.comment}</p>}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>No reviews yet. Be the first to review this product!</p>
                )}

                {/* Write a Review */}
                {user && (
                  <div style={{ padding: '16px', background: 'var(--bg-surface-secondary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700 }}>Write a Review</h4>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setReviewRating(s)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}>
                          <Star size={20} fill={s <= reviewRating ? 'var(--warning)' : 'transparent'} color={s <= reviewRating ? 'var(--warning)' : 'var(--text-muted)'} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your experience with this product..."
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    {reviewMessage && (
                      <p style={{ fontSize: '12px', color: reviewMessage === 'Review submitted!' ? 'var(--success)' : 'var(--danger)', margin: '8px 0 0' }}>{reviewMessage}</p>
                    )}
                    <button
                      onClick={handleSubmitReview}
                      disabled={reviewSubmitting || !reviewComment.trim()}
                      className="btn-primary"
                      style={{ marginTop: '10px', padding: '10px 16px', fontSize: '13px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}
                    >
                      <Send size={14} /> {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                )}
              </div>

              {/* Related Products Section */}
              {related.length > 0 && (
                <div className="related-products-section" style={{ marginTop: '32px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingBag size={18} color="var(--primary-blue)" /> 
                    Frequently Bought Together
                  </h3>
                  <div className="related-carousel" style={{ 
                    display: 'flex', 
                    gap: '16px', 
                    overflowX: 'auto', 
                    paddingBottom: '16px',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    width: '100%',
                    maxWidth: '100%'
                  }}>
                    {related.map(rp => (
                      <div key={rp.id} className="related-card glass" style={{
                        minWidth: '160px',
                        maxWidth: '160px',
                        padding: '12px',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        scrollSnapAlign: 'start',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        border: '1px solid var(--border-light)',
                        transition: 'all 0.3s ease'
                      }} 
                      onClick={() => {
                          if (onProductClick) onProductClick(rp);
                          const details = document.querySelector('.product-modal-details');
                          if (details) details.scrollTop = 0;
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary-blue)'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                      >
                        <div style={{ width: '100%', height: '120px', background: 'white', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img 
                              src={formatImageUrl(rp.image_url || rp.image)} 
                              alt={rp.name} 
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'contain', 
                                borderRadius: '10px' 
                              }} 
                            />
                        </div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 6px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>{rp.name}</h4>
                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <div style={{ display: 'flex', flexDirection: 'column' }}>
                             <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary-blue)', margin: 0 }}>
                               {formatPrice(
                                 (parseInt(rp.discount_percent) > 0 && (!rp.sale_ends_at || new Date(rp.sale_ends_at) > new Date()))
                                   ? rp.price * (1 - parseInt(rp.discount_percent) / 100)
                                   : rp.price
                               )}
                             </p>
                             {(parseInt(rp.discount_percent) > 0 && (!rp.sale_ends_at || new Date(rp.sale_ends_at) > new Date())) && (
                               <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.7 }}>
                                 {formatPrice(rp.price)}
                               </span>
                             )}
                           </div>
                           <button className="btn-icon" style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-blue)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                               <Plus size={14} />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ProductModal);
