import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, FileText } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import DOMPurify from 'dompurify'; // Important: Sanitize HTML content before rendering

export default function CMSPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { siteSettings } = useSettings();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset state when slug changes
    setPage(null);
    setError(null);
    setLoading(true);

    const fetchPageContent = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE}/cms.php?slug=${slug}`);
        const data = await response.json();

        if (response.ok && data.success && data.data) {
          setPage(data.data);
          document.title = `${data.data.title} | ${siteSettings.siteName}`;
        } else {
          setError(data.error || 'Page not found');
          document.title = `Not Found | ${siteSettings.siteName}`;
        }
      } catch (err) {
        setError('Failed to load connection');
        document.title = `Error | ${siteSettings.siteName}`;
      } finally {
        setLoading(false);
      }
    };

    fetchPageContent();
  }, [slug, siteSettings]);

  if (loading) {
    return (
      <div className="container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
             <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-light)', borderTopColor: 'var(--primary-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
             <p style={{ color: 'var(--text-muted)' }}>Loading page content...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="container animate-fade-in" style={{ minHeight: '60vh', padding: '64px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <div className="card glass" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '48px 32px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                <AlertTriangle size={32} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '12px' }}>Page Not Found</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
                The page "{slug}" you are looking for doesn't exist, has been moved, or is temporarily unavailable.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button onClick={() => navigate(-1)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ArrowLeft size={16} /> Go Back
                </button>
                <Link to="/" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Return to Store
                </Link>
            </div>
         </div>
      </div>
    );
  }

  // --- Security: Sanitize HTML content before Injecting to prevent stored XSS attacks ---
  const sanitizedHTML = DOMPurify.sanitize(page.content, { 
      USE_PROFILES: { html: true },
      // allow iframes for videos if required, else keep it restricted
      ADD_TAGS: ['iframe'], 
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling']
  });

  return (
    <div className="container animate-fade-in" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', gap: '24px' }}>
       <div className="card glass" style={{ maxWidth: '900px', margin: '0 auto', padding: '0', overflow: 'hidden' }}>
            
            {/* Page Header */}
            <div style={{ 
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', 
                borderBottom: '1px solid var(--border-light)',
                padding: '40px 48px',
                textAlign: 'center'
            }}>
                <div style={{ 
                    width: '48px', height: '48px', borderRadius: '14px', 
                    background: 'var(--primary-blue)', color: 'white', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    margin: '0 auto 16px auto',
                    boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.4)'
                }}>
                    <FileText size={24} />
                </div>
                <h1 style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-1px', margin: 0 }}>{page.title}</h1>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px', fontWeight: 600 }}>
                    Last Updated: {new Date(page.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
            </div>

            {/* Page Content Body */}
            <div className="cms-content-body" style={{ padding: '48px', color: 'var(--text-main)' }}>
                {page.content ? (
                   <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />
                ) : (
                   <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontStyle: 'italic' }}>
                       This page has no content yet.
                   </div>
                )}
            </div>

       </div>

       {/* Custom Styles for injected HTML content to make it look native */}
       <style>{`
          .cms-content-body {
              line-height: 1.7;
              font-size: 16px;
          }
          .cms-content-body h1, .cms-content-body h2, .cms-content-body h3, .cms-content-body h4 {
              font-weight: 800;
              margin-top: 2em;
              margin-bottom: 0.75em;
              line-height: 1.3;
              color: var(--text-main);
          }
          .cms-content-body h1 { fontSize: 32px; letterSpacing: -1px; }
          .cms-content-body h2 { fontSize: 24px; borderBottom: 1px solid var(--border-light); paddingBottom: 10px; }
          .cms-content-body h3 { fontSize: 20px; }
          
          .cms-content-body p { margin-bottom: 1.5em; color: var(--text-muted); }
          .cms-content-body a { color: var(--primary-blue); text-decoration: none; font-weight: 600; }
          .cms-content-body a:hover { text-decoration: underline; }
          
          .cms-content-body ul, .cms-content-body ol { margin-bottom: 1.5em; padding-left: 2em; color: var(--text-muted); }
          .cms-content-body li { margin-bottom: 0.5em; }
          
          .cms-content-body blockquote {
              border-left: 4px solid var(--primary-blue);
              padding-left: 16px;
              font-style: italic;
              color: var(--text-muted);
              margin: 1.5em 0;
              background: rgba(255,255,255,0.02);
              padding: 16px 20px;
              border-radius: 0 12px 12px 0;
          }
          
          .cms-content-body img {
              max-width: 100%;
              height: auto;
              border-radius: 12px;
              margin: 2em 0;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          
          .cms-content-body iframe {
              width: 100%;
              min-height: 400px;
              border-radius: 12px;
              margin: 2em 0;
              border: none;
          }
       `}</style>
    </div>
  );
}
