import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, GitCompareArrows } from 'lucide-react';
import ProductModal from './ProductModal';
import { useComparison } from '../context/ComparisonContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

// Mirrors ProductCard logic — a sale is only active if not yet expired
const isSaleActiveFor = (p) =>
  (parseInt(p.discount_percent) || 0) > 0 &&
  (!p.sale_ends_at || new Date(p.sale_ends_at) > new Date());

export default function RecentlyViewedProducts({ products }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const scrollRef = useRef(null);
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

  const recentProducts = products?.filter(p => recentViews.includes(p.id)) || [];
  const itemsToShow = 4;
  const maxIndex = Math.max(0, recentProducts.length - itemsToShow);

  if (recentProducts.length === 0) return null;

  const handlePrev = () => setCurrentIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentIndex(prev => Math.min(maxIndex, prev + 1));

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCompare = (e, product) => {
    e.stopPropagation();
    addToCompare(product);
  };

  // Desktop: slice by index. Mobile: show all (native scroll handles it).
  const visibleProducts = recentProducts.slice(currentIndex, currentIndex + itemsToShow);

  const Card = ({ product, index }) => (
    <div
      key={`${product.id}-${index}`}
      className="recently-viewed-card glass"
      onClick={() => handleProductClick(product)}
    >
      <div className="rv-card-image">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      </div>
      <h4 className="rv-card-name">{product.name}</h4>
      <div className="rv-card-price">
        {isSaleActiveFor(product)
          ? `GH₵ ${(product.price * (1 - parseInt(product.discount_percent) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `GH₵ ${Number(product.price).toLocaleString()}`
        }
      </div>
      {isSaleActiveFor(product) && (
        <div className="rv-card-discount">
          {parseInt(product.discount_percent)}% OFF
        </div>
      )}
      <button
        className="rv-compare-btn"
        onClick={(e) => handleAddToCompare(e, product)}
        style={{
          background: isInCompare(product.id) ? 'var(--primary-blue)' : 'var(--bg-surface)',
          color: isInCompare(product.id) ? 'white' : 'var(--text-main)',
        }}
      >
        <GitCompareArrows size={14} />
        {isInCompare(product.id) ? 'Added' : 'Compare'}
      </button>
    </div>
  );

  return (
    <>
      <div className="recently-viewed-container animate-fade-in">

        {/* Header row */}
        <div className="rv-header">
          <div className="rv-header-left">
            <div className="rv-icon-wrap">
              <Clock size={22} />
            </div>
            <div>
              <h3 className="rv-title">Recently Viewed</h3>
              <p className="rv-subtitle">Pick up where you left off</p>
            </div>
          </div>

          {/* Prev/Next — hidden on mobile, visible on desktop */}
          <div className="rv-nav-btns">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="btn-secondary rv-btn"
              style={{ opacity: currentIndex === 0 ? 0.5 : 1 }}
            >
              <ChevronLeft size={18} />
              <span>Prev</span>
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= maxIndex}
              className="btn-secondary rv-btn"
              style={{ opacity: currentIndex >= maxIndex ? 0.5 : 1 }}
            >
              <span>Next</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Desktop grid — sliced by index */}
        <div className="recently-viewed-grid rv-desktop">
          {visibleProducts.map((product, index) => (
            <Card key={`d-${product.id}`} product={product} index={index} />
          ))}
        </div>

        {/* Mobile swipe strip — shows all, native scroll-snap */}
        <div className="rv-mobile-strip" ref={scrollRef}>
          {recentProducts.map((product, index) => (
            <Card key={`m-${product.id}`} product={product} index={index} />
          ))}
        </div>

      </div>

      <style>{`
        /* ── Container ── */
        .recently-viewed-container {
          padding: 32px 24px;
          background: var(--bg-main);
          border-top: 1px solid var(--border-light);
        }

        /* ── Header ── */
        .rv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .rv-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .rv-icon-wrap {
          background: var(--primary-bg);
          padding: 10px;
          border-radius: 12px;
          color: var(--primary-blue);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rv-title {
          font-size: 20px;
          font-weight: 800;
          margin: 0;
          color: var(--text-main);
        }
        .rv-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin: 4px 0 0;
        }
        .rv-nav-btns {
          display: flex;
          gap: 8px;
        }
        .rv-btn {
          padding: 10px 14px !important;
          border-radius: 10px !important;
          border: 1px solid var(--border-light) !important;
          background: var(--bg-surface) !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          cursor: pointer;
        }
        .rv-btn span { font-size: 13px; font-weight: 600; }

        /* ── Card shared ── */
        .recently-viewed-card {
          border-radius: 16px;
          padding: 14px;
          border: 1px solid var(--border-light);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease;
          cursor: pointer;
          box-sizing: border-box;
        }
        .recently-viewed-card:hover {
          transform: translateY(-6px) scale(1.008);
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1), 0 0 0 1px rgba(var(--primary-blue-rgb), 0.25);
          border-color: var(--primary-blue);
        }
        .rv-card-image {
          width: 100%;
          height: 140px;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 10px;
          background: var(--bg-surface-secondary);
        }
        .rv-card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .recently-viewed-card:hover .rv-card-image img {
          transform: scale(1.05);
        }
        .rv-card-name {
          font-size: 13px;
          font-weight: 700;
          margin: 0 0 6px;
          color: var(--text-main);
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }
        .rv-card-price {
          font-size: 15px;
          font-weight: 800;
          color: var(--primary-blue);
          margin-bottom: 4px;
        }
        .rv-card-discount {
          font-size: 11px;
          color: var(--success);
          font-weight: 600;
          margin-bottom: 2px;
        }
        .rv-compare-btn {
          width: 100%;
          padding: 7px 10px;
          margin-top: 10px;
          border-radius: 8px;
          border: 1px solid var(--border-light);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        /* ── Desktop grid ── */
        .rv-desktop {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          overflow: hidden;
        }
        .rv-mobile-strip {
          display: none;
        }

        /* ── Tablet ── */
        @media (max-width: 1024px) {
          .recently-viewed-container { padding: 24px 16px; }
          .rv-desktop { grid-template-columns: repeat(3, 1fr); }
        }

        /* ── Mobile: swipe strip ── */
        @media (max-width: 768px) {
          .recently-viewed-container { padding: 20px 16px; }

          /* Hide desktop grid and Prev/Next buttons */
          .rv-desktop { display: none !important; }
          .rv-nav-btns { display: none !important; }

          /* Show swipe strip */
          .rv-mobile-strip {
            display: flex;
            flex-direction: row;
            gap: 12px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 8px;
          }
          .rv-mobile-strip::-webkit-scrollbar { display: none; }

          /* Each card same width as coupon strip cards */
          .rv-mobile-strip .recently-viewed-card {
            flex: 0 0 min(85vw, 300px);
            scroll-snap-align: start;
          }

          /* Shorter image on mobile */
          .rv-mobile-strip .rv-card-image {
            height: 100px;
          }
        }

        @media (max-width: 480px) {
          .rv-mobile-strip .recently-viewed-card {
            flex: 0 0 min(85vw, 280px);
          }
        }
      `}</style>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          products={products}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={(product) => {
            const price = parseFloat(product.price) || 0;
            const effectivePrice = isSaleActiveFor(product)
              ? price * (1 - (parseInt(product.discount_percent) || 0) / 100)
              : price;
            addToCart({ ...product, price: effectivePrice, original_price: price });
          }}
          onAddToWishlist={(product) => { addToWishlist(product); }}
          onProductClick={(product) => { setSelectedProduct(product); }}
        />
      )}
    </>
  );
}
