import React, { useState, useEffect, memo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

const isVideo = (url) => url && (url.match(/\.(mp4|webm)$/i) || url.startsWith('data:video'));

/**
 * Sanitize user input to prevent XSS attacks
 * Removes dangerous HTML tags and attributes
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
};

/**
 * Validate and sanitize content blocks for safe rendering
 */
const sanitizeContentBlock = (block) => {
  if (!block || typeof block !== 'object') return null;
  
  return {
    ...block,
    text: sanitizeInput(block.text || ''),
    link: sanitizeInput(block.link || ''),
    // Only allow safe CSS values
    color: block.color && /^#[0-9A-Fa-f]{6}$/.test(block.color) ? block.color : '#ffffff',
    fontSize: typeof block.fontSize === 'string' ? block.fontSize : '16px',
    textAlign: ['left', 'center', 'right'].includes(block.textAlign) ? block.textAlign : 'center',
    type: ['paragraph', 'heading', 'subheading', 'cta'].includes(block.type) ? block.type : 'paragraph',
    top: typeof block.top === 'string' || typeof block.top === 'number' ? block.top : '50',
    left: typeof block.left === 'string' || typeof block.left === 'number' ? block.left : '50'
  };
};

function HeroSlider() {
  const { siteSettings, homepageBoot } = useSettings();
  const slides = homepageBoot?.slides || [];
  const [currentSlide, setCurrentSlide] = React.useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const handleFocus = () => {
      // If the page regains focus, restart the slider loop.
      setCurrentSlide((prev) => Math.min(prev, slides.length - 1));
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 8000); // Increased to 8 seconds
    return () => clearInterval(timer);
  }, [slides.length]);

  const [sliderHeight, setSliderHeight] = useState(() => {
    const width = window.innerWidth;
    if (width <= 768) return 312; // Mobile - keep as is
    if (width <= 1200) return 317; // Tablet - 66% of 480 (+10%)
    return 403; // Desktop - 84% of 480 (+20%)
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width <= 768) {
        setSliderHeight(312); // Mobile
      } else if (width <= 1200) {
        setSliderHeight(317); // Tablet - +10%
      } else {
        setSliderHeight(403); // Desktop - +20%
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (slides.length === 0) {
    return (
      <div 
        className="hero-slider" 
        style={{ 
          position: 'relative', 
          height: `${sliderHeight}px`, 
          overflow: 'hidden', 
          borderRadius: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="skeleton" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
        <div 
          style={{ 
            position: 'relative', 
            zIndex: 2, 
            textAlign: 'center', 
            padding: '24px', 
            maxWidth: '540px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="skeleton" style={{ height: '36px', width: '70%', margin: '0 auto 16px', borderRadius: '8px' }} />
          <div className="skeleton" style={{ height: '16px', width: '85%', margin: '0 auto 24px', borderRadius: '6px' }} />
          <div className="skeleton" style={{ height: '42px', width: '140px', margin: '0 auto', borderRadius: '10px' }} />
        </div>
      </div>
    );
  }

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  const globalVideoSlide = slides.find(s => isVideo(s.image_url));

  const getSidePadding = () => {
    const width = window.innerWidth;
    if (width <= 480) return '44px';
    if (width <= 768) return '48px';
    if (width <= 1200) return '56px';
    return '80px';
  };

  const getPositionStyles = (pos) => {
    const sidePadding = getSidePadding();
    const config = {
        left: { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'left', padding: `0 ${sidePadding}`, gradient: 'linear-gradient(to right, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 100%)' },
        right: { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'right', padding: `0 ${sidePadding}`, gradient: 'linear-gradient(to left, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 100%)' },
        center: { justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 20px', gradient: 'radial-gradient(circle, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 80%)' },
        top: { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'center', padding: '60px 20px', gradient: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 100%)' },
    };
    return config[pos] || config.left;
  };

  return (
    <div className="hero-slider" style={{ position: 'relative', height: `${sliderHeight}px`, overflow: 'hidden', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)' }}>
      
      {/* GLOBAL VIDEO BACKGROUND */}
      {globalVideoSlide && (
         <video 
            src={globalVideoSlide.image_url}
            autoPlay loop muted playsInline
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
         />
      )}

      <div 
        className="slides-wrapper" 
        style={{ 
          display: 'flex', 
          width: '100%', 
          height: '100%', 
          transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: `translateX(-${currentSlide * 100}%)`,
          position: 'relative',
          zIndex: 1
        }}
      >
        {slides.map((slide, index) => {
          const styles = getPositionStyles(slide.text_position);
          const isActive = index === currentSlide;
          const hasGlobalVideo = !!globalVideoSlide;

          return (
            <div
              key={slide.id || index}
              style={{
                flex: "0 0 100%",
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Slide Background Image with Ken-Burns Motion */}
              {!(hasGlobalVideo || isVideo(slide.image_url)) && (
                <div 
                  className={`hero-slide-bg ${isActive ? 'ken-burns' : ''}`}
                  style={{
                    backgroundImage: `url(${slide.image_url})`,
                  }}
                />
              )}

              {!hasGlobalVideo && isVideo(slide.image_url) && (
                 <video 
                    src={slide.image_url}
                    autoPlay loop muted playsInline
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
                 />
              )}
              
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
                width: '100%',
                height: '100%',
                background: styles.gradient,
                display: 'flex',
                justifyContent: styles.justifyContent,
                alignItems: styles.alignItems,
                padding: styles.padding,
                boxSizing: 'border-box'
              }}>
                <div 
                  className="slide-content" 
                  style={{ 
                    maxWidth: '600px', 
                    color: 'white', 
                    textAlign: styles.textAlign,
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
                    transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s'
                  }}
                >
                  {(slide.title || siteSettings.heroBannerTagline) && (
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, marginBottom: '16px', lineHeight: 1.1, textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)' }}>
                      {slide.title || siteSettings.heroBannerTagline}
                    </h2>
                  )}
                  {(slide.subtitle || siteSettings.heroBannerSubtext) && (
                    <p style={{ fontSize: 'clamp(14px, 2vw, 18px)', marginBottom: '24px', opacity: 0.95, textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)' }}>
                      {slide.subtitle || siteSettings.heroBannerSubtext}
                    </p>
                  )}
                  
                  <Link 
                    to={slide.button_link || siteSettings.heroCTAUrl || '/shop'} 
                    className="btn-primary hero-cta-btn" 
                    style={{ 
                      padding: '14px 34px', 
                      fontSize: '16px', 
                      marginTop: '16px', 
                      display: 'inline-block',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)'
                    }}
                  >
                    {slide.button_text || siteSettings.heroCTAText || 'Shop Now'}
                  </Link>
                </div>
  
                {/* Custom Content Blocks */}
                {(() => {
                    let blocks = [];
                    try {
                        const raw = slide.content_blocks;
                        blocks = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
                    } catch(e) { 
                        blocks = []; 
                    }
                    
                    if (!Array.isArray(blocks)) return null;

                    const sanitizedBlocks = blocks.map(sanitizeContentBlock).filter(Boolean);
  
                    return sanitizedBlocks.map((block, i) => {
                        if (!block.text && block.type !== 'cta') return null;
 
                        const top = parseFloat(block.top) || 50;
                        const left = parseFloat(block.left) || 50;
 
                        const blockStyle = {
                            position: 'absolute',
                            top: `${top}%`,
                            left: `${left}%`,
                            transform: `translate(-50%, ${isActive ? '-50%' : 'calc(-50% + 20px)'})`,
                            fontSize: block.fontSize || '16px',
                            color: block.color || '#ffffff',
                            textAlign: block.textAlign || 'center',
                            opacity: isActive ? (block.type === 'paragraph' ? 0.85 : 1) : 0,
                            fontWeight: block.type === 'heading' ? 800 : (block.type === 'subheading' ? 600 : 400),
                            lineHeight: 1.4,
                            maxWidth: '90%',
                            zIndex: 5,
                            textShadow: '0 2px 15px rgba(0, 0, 0, 0.6)',
                            transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.1}s`
                        };
 
                        if (block.type === 'heading') return <h3 key={i} style={{ ...blockStyle, fontSize: block.fontSize || '38px', marginBottom: '0.4em' }}>{block.text}</h3>;
                        if (block.type === 'subheading') return <h4 key={i} style={{ ...blockStyle, fontSize: block.fontSize || '20px' }}>{block.text}</h4>;
                        if (block.type === 'cta') return (
                          <Link key={i} to={block.link || '#'} className="btn-primary hero-cta-btn" style={{ ...blockStyle, position: 'absolute', top: `${top}%`, left: `${left}%`, padding: '10px 24px', whiteSpace: 'nowrap' }}>
                            {block.text || 'Learn More'}
                          </Link>
                        );
                        return <p key={i} style={blockStyle}>{block.text}</p>;
                    });
                })()}
              </div>
            </div>
          );
        })}
      </div>

      <button 
        onClick={prevSlide} 
        aria-label="Previous Slide"
        className="hero-nav-btn"
        style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '16px', 
          transform: 'translateY(-50%)', 
          zIndex: 10, 
          background: 'rgba(15, 23, 42, 0.4)', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)', 
          borderRadius: '50%', 
          width: '44px', 
          height: '44px', 
          color: 'white', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
        }}
      >
        <ChevronLeft size={22} />
      </button>

      <button 
        onClick={nextSlide} 
        aria-label="Next Slide"
        className="hero-nav-btn"
        style={{ 
          position: 'absolute', 
          top: '50%', 
          right: '16px', 
          transform: 'translateY(-50%)', 
          zIndex: 10, 
          background: 'rgba(15, 23, 42, 0.4)', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)', 
          borderRadius: '50%', 
          width: '44px', 
          height: '44px', 
          color: 'white', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
        }}
      >
        <ChevronRight size={22} />
      </button>

      {/* Slide Pagination Pills */}
      <div 
        style={{ 
          position: 'absolute', 
          bottom: '20px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          display: 'flex', 
          alignItems: 'center',
          gap: '8px', 
          padding: '6px 14px',
          background: 'rgba(15, 23, 42, 0.35)',
          backdropFilter: 'blur(12px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          zIndex: 10 
        }}
      >
        {slides.map((_, i) => {
          const isCurrent = i === currentSlide;
          return (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`hero-pill-indicator ${isCurrent ? 'active' : ''}`}
              style={{
                width: isCurrent ? '26px' : '8px',
                height: '8px',
                borderRadius: '10px',
                background: isCurrent ? 'var(--primary-blue)' : 'rgba(255, 255, 255, 0.5)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                boxShadow: isCurrent ? '0 0 10px rgba(59, 130, 246, 0.6)' : 'none'
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default memo(HeroSlider);
