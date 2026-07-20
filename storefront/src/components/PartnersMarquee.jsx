import React, { useState, useEffect, useRef } from 'react';

const formatImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  return `${API_BASE}/${url}`;
};

export default function PartnersMarquee() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const res = await fetch(`${API_BASE}/get_partners.php`);
        const result = await res.json();
        if (result.success) {
          setPartners(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch partners:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchPartners();
    }
  }, []);

  if (loading || partners.length === 0) {
    return null; // Don't render anything if empty or loading to keep the layout clean
  }

  // Duplicate the list of partners to create a seamless infinite marquee effect
  const marqueeItems = [...partners, ...partners, ...partners];

  return (
    <div className="partners-marquee-container animate-fade-in">
      <div className="partners-marquee-header">
        <h3 className="marquee-title">Trusted By Our Partners & Collaborators</h3>
        <div className="title-accent-bar"></div>
      </div>
      
      <div className="marquee-wrapper">
        <div className="marquee-fade-left"></div>
        <div className="marquee-track">
          {marqueeItems.map((partner, index) => (
            <div key={`${partner.id}-${index}`} className="marquee-item">
              {partner.logo_url ? (
                <img
                  src={formatImageUrl(partner.logo_url)}
                  alt={partner.name}
                  className="partner-logo"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to text if image fails to load
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <span className="partner-name-fallback" style={{ display: partner.logo_url ? 'none' : 'block' }}>
                {partner.name}
              </span>
            </div>
          ))}
        </div>
        <div className="marquee-fade-right"></div>
      </div>

      <style>{`
        .partners-marquee-container {
          padding: 0;
          margin-top: -24px;
          margin-bottom: 0px;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          overflow: hidden;
        }

        .partners-marquee-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .marquee-title {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin: 0 0 8px 0;
        }

        .title-accent-bar {
          width: 40px;
          height: 3px;
          background: var(--primary-blue);
          border-radius: 2px;
          margin: 0 auto;
        }

        .marquee-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          max-width: 1200px;
          height: 100px;
          padding: 0;
          overflow: hidden;
        }

        /* Continuous seamless scrolling animation */
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }

        .marquee-track {
          display: flex;
          align-items: center;
          width: max-content;
          animation: marquee 30s linear infinite;
          padding-left: 20px;
        }

        .marquee-wrapper:hover .marquee-track {
          animation-play-state: paused;
        }

        .marquee-item {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 40px;
          min-width: 180px;
          height: 60px;
          transition: transform 0.3s ease;
        }

        .marquee-item:hover {
          transform: scale(1.05);
        }

        .partner-logo {
          max-height: 42px;
          max-width: 140px;
          object-fit: contain;
          opacity: 0.75;
          filter: grayscale(1) contrast(0.85);
          transition: all 0.3s ease;
        }

        /* Colored on hover for interactive touch */
        .marquee-item:hover .partner-logo {
          opacity: 1;
          filter: grayscale(0) contrast(1);
        }

        .partner-name-fallback {
          font-size: 16px;
          font-weight: 800;
          color: var(--text-muted);
          opacity: 0.7;
          letter-spacing: -0.2px;
          transition: all 0.3s ease;
        }

        .marquee-item:hover .partner-name-fallback {
          color: var(--primary-blue);
          opacity: 1;
        }

        /* Transparent side gradients for beautiful fade integration */
        .marquee-fade-left, .marquee-fade-right {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 80px;
          z-index: 2;
          pointer-events: none;
        }

        .marquee-fade-left {
          left: 0;
          background: linear-gradient(to right, var(--bg-main) 0%, transparent 100%);
        }

        .marquee-fade-right {
          right: 0;
          background: linear-gradient(to left, var(--bg-main) 0%, transparent 100%);
        }

        @media (max-width: 768px) {
          .marquee-wrapper {
            height: 80px;
          }
          .marquee-item {
            padding: 0 24px;
            min-width: 140px;
          }
          .partner-logo {
            max-height: 32px;
            max-width: 100px;
          }
          .partner-name-fallback {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}
