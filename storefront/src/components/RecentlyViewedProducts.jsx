import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, GitCompareArrows } from 'lucide-react';
import ProductModal from './ProductModal';
import { useComparison } from '../context/ComparisonContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export default function RecentlyViewedProducts({ products }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToCompare, isInCompare } = useComparison();
  const { addToCart } = useCart();
  const { addToWishlist } = useWishlist();

  let recentViews = [];
  try {
    const recentStr = localStorage.getItem('ehub_recent_views');
    if (recentStr) {
      recentViews = JSON.parse(recentStr);
    }
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn('Storage quota exceeded when loading recent views');
    } else {
      console.warn("Failed to parse recent views:", e);
    }
  }

  // Get recently viewed product objects
  const recentProducts = products?.filter(p => recentViews.includes(p.id)) || [];
  const itemsToShow = 4;
  const maxIndex = Math.max(0, recentProducts.length - itemsToShow);

  if (recentProducts.length === 0) {
    return null;
  }

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(maxIndex, prev + 1));
  };

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCompare = (e, product) => {
    e.stopPropagation();
    addToCompare(product);
  };

  const visibleProducts = recentProducts.slice(currentIndex, currentIndex + itemsToShow);

  return (
    <>
      <div className="recently-viewed-container animate-fade-in" style={{
        padding: '32px 24px',
        background: 'var(--bg-main)',
        borderTop: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'var(--primary-bg)',
              padding: '12px',
              borderRadius: '12px',
              color: 'var(--primary-blue)'
            }}>
              <Clock size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Recently Viewed
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Pick up where you left off
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="btn-secondary"
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ChevronLeft size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Prev</span>
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= maxIndex}
              className="btn-secondary"
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                cursor: currentIndex >= maxIndex ? 'not-allowed' : 'pointer',
                opacity: currentIndex >= maxIndex ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Next</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          overflow: 'hidden'
        }}
        className="recently-viewed-grid">
          {visibleProducts.map((product, index) => (
            <div
              key={`${product.id}-${index}`}
              className="recently-viewed-card glass"
              style={{
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid var(--border-light)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onClick={() => handleProductClick(product)}
            >
              <div style={{
                width: '100%',
                height: '140px',
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '12px',
                background: 'var(--bg-surface-secondary)'
              }}>
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.3s ease'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              <h4 style={{
                fontSize: '14px',
                fontWeight: 700,
                margin: '0 0 8px 0',
                color: 'var(--text-main)',
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {product.name}
              </h4>
              <div style={{
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--primary-blue)',
                marginBottom: '8px'
              }}>
                GH₵ {Number(product.price).toLocaleString()}
              </div>
              {product.discount_percent > 0 && (
                <div style={{
                  fontSize: '12px',
                  color: 'var(--success)',
                  fontWeight: 600
                }}>
                  {product.discount_percent}% OFF
                </div>
              )}
              <button
                onClick={(e) => handleAddToCompare(e, product)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginTop: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: isInCompare(product.id) ? 'var(--primary-blue)' : 'var(--bg-surface)',
                  color: isInCompare(product.id) ? 'white' : 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <GitCompareArrows size={14} />
                {isInCompare(product.id) ? 'Added' : 'Compare'}
              </button>
            </div>
          ))}
        </div>

        <style>{`
        .recently-viewed-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
          border-color: var(--primary-blue);
        }
        .recently-viewed-card:hover img {
          transform: scale(1.05);
        }
        @media (max-width: 1024px) {
          .recently-viewed-container {
            padding: 24px 16px;
          }
          .recently-viewed-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 768px) {
          .recently-viewed-container {
            padding: 20px 12px;
          }
          .recently-viewed-container > div > div:first-child {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .recently-viewed-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
        }
        @media (max-width: 480px) {
          .recently-viewed-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          products={products}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={(product) => {
            const discount = parseInt(product.discount_percent) || 0;
            const price = parseFloat(product.price) || 0;
            const effectivePrice = discount > 0 ? price * (1 - discount / 100) : price;
            addToCart({ ...product, price: effectivePrice, original_price: price });
          }}
          onAddToWishlist={(product) => {
            addToWishlist(product);
          }}
          onProductClick={(product) => {
            setSelectedProduct(product);
          }}
        />
      )}
    </>
  );
}
