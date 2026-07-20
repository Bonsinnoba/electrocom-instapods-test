import React, { useState, useEffect } from 'react';
import { Target, Award, Rocket, Heart, Loader2, Info, Mail, RefreshCw, Truck } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import DOMPurify from 'dompurify';
import { parseCMSContent } from '../utils/cmsUtils';

const ICON_MAP = {
  shield: Award,
  lock: Award,
  eye: Target,
  scroll: Rocket,
  info: Info,
  mail: Mail,
  refresh: RefreshCw,
  truck: Truck,
  target: Target,
  award: Award,
  rocket: Rocket,
  heart: Heart
};

export default function AboutUs() {
  const { siteSettings } = useSettings();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const res = await fetch(`${API_BASE}/cms.php?slug=about-us`, {
          headers: { 'X-App-ID': 'storefront' }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data.success && data.data && parseInt(data.data.is_published) === 1) {
          const parsed = parseCMSContent(data.data.content);
          setSections(parsed);
        }
      } catch (err) {
        console.error("Failed to fetch About Us content:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
         <Loader2 className="animate-spin" size={40} color="var(--primary-blue)" />
      </div>
    );
  }

  return (
    <div className="about-us-page" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px',
      paddingBottom: '60px'
    }}>
      
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
         <div style={{ 
            background: 'var(--info-bg)', 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'var(--primary-blue)', 
            margin: '0 auto 20px auto' 
         }}>
             <Rocket size={32} />
         </div>
        <h1 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-1px' }}>About {siteSettings.siteName || 'Us'}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '18px' }}>Our Story & Mission</p>
      </div>

      <div className="policy-grid">
        {sections.length > 0 ? (
          sections.map((section, idx) => {
            const IconComp = ICON_MAP[section.iconKey] || Info;
            return (
              <div key={idx} className="glass section-card animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
                    <IconComp size={24} style={{ color: 'var(--primary-blue)' }} /> {section.originalTitle || section.title}
                </h2>
                <div 
                  className="cms-section-body"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content) }} 
                />
              </div>
            );
          })
        ) : (
          <div className="glass empty-alert">
             <p style={{ color: 'var(--text-muted)' }}>Content is being updated. Please check back later.</p>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-light)', padding: '48px 0', textAlign: 'center', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: 'var(--primary-blue)', marginBottom: '12px' }}>
          <Heart size={20} fill="var(--primary-blue)" />
          <span style={{ fontWeight: 800, fontSize: '18px' }}>We're here for you</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '500px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
          {`Our mission is to provide the best electronics with world-class support. ${siteSettings.siteName} is community-driven and always ready to help.`}
        </p>
      </div>

      <style>{`
        .policy-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
        }

        .section-card {
            padding: 40px;
            border-radius: 32px;
            background: var(--bg-surface);
            border: 1px solid var(--border-light);
            transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .section-card:last-child:nth-child(odd) {
            grid-column: 1 / -1;
        }

        .section-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.05);
            border-color: var(--primary-blue);
        }

        .cms-section-body {
            line-height: 1.8;
            color: var(--text-main);
        }
        .cms-section-body p {
            margin-bottom: 20px;
            opacity: 0.9;
        }
        .cms-section-body ul, .cms-section-body ol {
            padding-left: 20px;
            margin-bottom: 20px;
            display: grid;
            gap: 10px;
        }
        .cms-section-body li {
            opacity: 0.9;
        }

        .empty-alert {
            padding: 40px;
            border-radius: 32px;
            text-align: center;
            grid-column: 1 / -1;
        }

        @media (max-width: 900px) {
           .policy-grid {
              grid-template-columns: 1fr;
           }
           .section-card:last-child:nth-child(odd) {
              grid-column: auto;
           }
        }
      `}</style>
    </div>
  );
}
