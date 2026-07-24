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

  const [sliderHeight, setSliderHeight] = useState(() =>
    window.innerWidth <= 768 ? 312 : 480
  );

  useEffect(() => {
    const handleResize = () => {
      setSliderHeight(window.innerWidth <= 768 ? 312 : 480);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (slides.length === 0) return null;

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  // OPTION A: If any slide contains a video, use it as a persistent, global background 
  // while the text/content wrapper continues to slide over it.
  const globalVideoSlide = slides.find(s => isVideo(s.image_url));

  const getSidePadding = () => {
    const width = window.innerWidth;
    if (width <= 768) return '20px'; // Mobile
    if (width <= 1200) return '40px'; // Tablet/Medium
    return '80px'; // Desktop
  };

  const getPositionStyles = (pos) => {
    const sidePadding = getSidePadding();
    const config = {
        left: { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'left', padding: `0 ${sidePadding}`, gradient: 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)' },
        right: { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'right', padding: `0 ${sidePadding}`, gradient: 'linear-gradient(to left, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)' },
        center: { justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 20px', gradient: 'radial-gradient(circle, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 80%)' },
        top: { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'center', padding: '60px 20px', gradient: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)' },
        bottom: { justifyContent: 'center', alignItems: 'flex-end', textAlign: 'center', padding: '60px 20px', gradient: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)' }
    };
    return config[pos] || config.left;
  };



  return (
    <div className="hero-slider" style={{ position: 'relative', height: `${sliderHeight}px`, overflow: 'hidden', borderRadius: '16px' }}>
      
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
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: `translateX(-${currentSlide * 100}%)`,
          position: 'relative',
          zIndex: 1
        }}
      >
        {slides.map((slide, index) => {
          const styles = getPositionStyles(slide.text_position);
          const isActive = index === currentSlide;
          
          // If we are using a global video, we don't render individual slide backgrounds.
          const hasGlobalVideo = !!globalVideoSlide;

          return (
            <div
              key={slide.id}
              style={{
                flex: "0 0 100%",
                height: '100%',
                backgroundImage: (hasGlobalVideo || isVideo(slide.image_url)) ? 'none' : `url(${slide.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Individual Slide Video (Fallback if not using Global) */}
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
                    transform: isActive ? 'translateY(0)' : 'translateY(40px)',
                    transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s'
                  }}
                >
                  {(slide.title || siteSettings.heroBannerTagline) && (
                    <h2 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '16px', lineHeight: 1.1 }}>
                      {slide.title || siteSettings.heroBannerTagline}
                    </h2>
                  )}
                  {(slide.subtitle || siteSettings.heroBannerSubtext) && (
                    <p style={{ fontSize: '18px', marginBottom: '24px', opacity: 0.9 }}>
                      {slide.subtitle || siteSettings.heroBannerSubtext}
                    </p>
                  )}
                  
                  <Link to={slide.button_link || siteSettings.heroCTAUrl || '/shop'} className="btn-primary" style={{ padding: '12px 32px', fontSize: '16px', marginTop: '16px', display: 'inline-block' }}>
                    {slide.button_text || siteSettings.heroCTAText || 'Shop Now'}
                  </Link>
                </div>
  
                {/* Individual Text Blocks with Custom Positions */}
                {(() => {
                    let blocks = [];
                    try {
                        const raw = slide.content_blocks;
                        blocks = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
                    } catch(e) { 
                        console.warn("Malformed Hero Slide content blocks:", e);
                        blocks = []; 
                    }
                    
                    if (!Array.isArray(blocks)) return null;

                    // Sanitize all blocks before rendering
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
                            opacity: isActive ? (block.type === 'paragraph' ? 0.8 : 1) : 0,
                            fontWeight: block.type === 'heading' ? 800 : (block.type === 'subheading' ? 600 : 400),
                            lineHeight: 1.4,
                            maxWidth: '90%',
                            zIndex: 5,
                            textShadow: '0 2px 15px rgba(0,0,0,0.6)',
                            transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.1}s`
                        };
 
                        if (block.type === 'heading') return <h3 key={i} style={{ ...blockStyle, fontSize: block.fontSize || '38px', marginBottom: '0.4em' }}>{block.text}</h3>;
                        if (block.type === 'subheading') return <h4 key={i} style={{ ...blockStyle, fontSize: block.fontSize || '20px' }}>{block.text}</h4>;
                        if (block.type === 'cta') return (
                          <Link key={i} to={block.link || '#'} className="btn-primary" style={{ ...blockStyle, position: 'absolute', top: `${top}%`, left: `${left}%`, padding: '10px 24px', whiteSpace: 'nowrap' }}>
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

      <button onClick={prevSlide} style={{ position: 'absolute', top: '50%', left: '20px', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={24} />
      </button>

      <button onClick={nextSlide} style={{ position: 'absolute', top: '50%', right: '20px', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronRight size={24} />
      </button>

      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 10 }}>
        {slides.map((_, i) => (
          <div
            key={i}
            onClick={() => setCurrentSlide(i)}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: i === currentSlide ? 'white' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(HeroSlider);
