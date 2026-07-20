import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertCircle, Scale, Loader2, Info, Mail, RefreshCw, Truck } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import DOMPurify from 'dompurify';
import { parseCMSContent } from '../utils/cmsUtils';

const ICON_MAP = {
  shield: Scale,
  lock: CheckCircle,
  eye: FileText,
  scroll: Scale,
  info: Info,
  mail: Mail,
  refresh: RefreshCw,
  truck: Truck,
  'file-text': FileText,
  'alert-circle': AlertCircle
};

export default function TermsOfService() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const res = await fetch(`${API_BASE}/cms.php?slug=terms-of-service`, {
          headers: { 'X-App-ID': 'storefront' }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data.success && data.data && parseInt(data.data.is_published) === 1) {
          const parsed = parseCMSContent(data.data.content);
          setSections(parsed);
        }
      } catch (err) {
        console.error("Failed to fetch dynamic terms of service:", err);
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
    <div className="terms-page" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px',
      paddingBottom: '60px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '64px', 
          height: '64px', 
          background: 'rgba(30, 124, 248, 0.1)', 
          borderRadius: '20px', 
          color: 'var(--primary-blue)',
          marginBottom: '20px'
        }}>
          <Scale size={32} />
        </div>
        <h1 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-1px' }}>Terms of Service</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '18px' }}>Store Policy</p>
      </div>

      <div className="policy-grid">
        {sections.length > 0 ? (
          sections.map((section, idx) => {
            const IconComp = ICON_MAP[section.iconKey] || FileText;
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
             <p style={{ color: 'var(--text-muted)' }}>Policy content is being updated. Please check back later.</p>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', marginTop: '40px' }}>
        <p>By using our services, you acknowledge that you have read and understood these Terms of Service.</p>
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
