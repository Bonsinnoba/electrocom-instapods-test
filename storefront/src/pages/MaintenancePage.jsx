import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Mail, Clock, Wrench } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { formatImageUrl } from '../services/api';

function GearsIllustration({ primary, accent }) {
  return (
    <svg viewBox="0 0 200 200" width="200" height="200" style={{ display: 'block', margin: '0 auto' }} aria-hidden>
      <defs>
        <linearGradient id="maint-g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
        <linearGradient id="maint-g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={primary} />
        </linearGradient>
        <filter id="maint-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="maint-gear-lg" style={{ transformOrigin: '80px 90px' }}>
        <circle cx="80" cy="90" r="32" fill="url(#maint-g1)" opacity="0.12" />
        <circle cx="80" cy="90" r="20" fill="none" stroke="url(#maint-g1)" strokeWidth="2.5" filter="url(#maint-glow)" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
          <rect
            key={i}
            x="77"
            y="56"
            width="6"
            height="12"
            rx="2"
            fill="url(#maint-g1)"
            style={{ transformOrigin: '80px 90px', transform: `rotate(${a}deg)` }}
          />
        ))}
        <circle cx="80" cy="90" r="6" fill="url(#maint-g1)" />
      </g>
      <g className="maint-gear-sm" style={{ transformOrigin: '128px 75px' }}>
        <circle cx="128" cy="75" r="20" fill="url(#maint-g2)" opacity="0.12" />
        <circle cx="128" cy="75" r="12" fill="none" stroke="url(#maint-g2)" strokeWidth="2" />
        {[0, 51.4, 102.8, 154.2, 205.6, 257, 308.4].map((a, i) => (
          <rect
            key={i}
            x="126"
            y="59"
            width="4"
            height="9"
            rx="2"
            fill="url(#maint-g2)"
            style={{ transformOrigin: '128px 75px', transform: `rotate(${a}deg)` }}
          />
        ))}
        <circle cx="128" cy="75" r="4" fill="url(#maint-g2)" />
      </g>
    </svg>
  );
}

function AnimatedDot({ delay, primary, accent, variant }) {
  const bg =
    variant === 'mid'
      ? primary
      : variant === 'accent'
        ? accent
        : `linear-gradient(135deg, ${primary}, ${accent})`;
  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: bg,
        margin: '0 5px',
        animation: `maintDotBounce 1.35s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

export default function MaintenancePage() {
  const { siteSettings } = useSettings();
  const [timeStr, setTimeStr] = useState('');

  const primary = siteSettings.primaryColor || '#3b82f6';
  const accent = siteSettings.accentColor || '#f59e0b';
  const fontStack = siteSettings.fontFamily
    ? `'${siteSettings.fontFamily}', system-ui, sans-serif`
    : "'Inter', system-ui, sans-serif";

  const gradientBg = useMemo(
    () =>
      `linear-gradient(145deg, 
        color-mix(in srgb, ${primary} 18%, #0a0f1a) 0%, 
        #0c1222 35%, 
        color-mix(in srgb, ${accent} 12%, #0a0f1a) 70%, 
        #080c14 100%)`,
    [primary, accent]
  );

  useEffect(() => {
    const tick = () => setTimeStr(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const email = siteSettings.siteEmail || 'support@example.com';
  const wa = siteSettings.whatsapp?.replace(/\D/g, '');
  const waHref = wa ? `https://wa.me/${wa}` : null;

  return (
    <div
      className="maintenance-page-root"
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0f18',
        background: gradientBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 32px)',
        fontFamily: fontStack,
        color: '#f1f5f9',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Soft orbs — brand-tinted */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-15%',
          left: '-10%',
          width: 'min(55vw, 420px)',
          height: 'min(55vw, 420px)',
          borderRadius: '50%',
          background: `radial-gradient(circle, color-mix(in srgb, ${primary} 35%, transparent) 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-12%',
          right: '-8%',
          width: 'min(50vw, 380px)',
          height: 'min(50vw, 380px)',
          borderRadius: '50%',
          background: `radial-gradient(circle, color-mix(in srgb, ${accent} 28%, transparent) 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      />

      {/* Main card */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '28px',
          padding: 'clamp(40px, 6vw, 56px) clamp(28px, 5vw, 48px)',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.05) inset,
            0 24px 64px rgba(0,0,0,0.45),
            0 0 80px color-mix(in srgb, ${primary} 15%, transparent)
          `,
          position: 'relative',
          zIndex: 1,
          animation: 'maintCardEnter 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        {siteSettings.siteLogoUrl ? (
          <img
            src={formatImageUrl(siteSettings.siteLogoUrl)}
            alt=""
            width="220"
            height="48"
            style={{
              height: '48px',
              width: 'auto',
              maxWidth: '220px',
              objectFit: 'contain',
              marginBottom: '24px',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.35))',
              aspectRatio: '220/48'
            }}
          />
        ) : null}

        <div style={{ marginBottom: siteSettings.siteLogoUrl ? '20px' : '28px', transform: siteSettings.siteLogoUrl ? 'scale(0.92)' : 'none', opacity: siteSettings.siteLogoUrl ? 0.95 : 1 }}>
          <GearsIllustration primary={primary} accent={accent} />
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: `linear-gradient(135deg, color-mix(in srgb, ${primary} 22%, transparent), color-mix(in srgb, ${accent} 18%, transparent))`,
            border: `1px solid color-mix(in srgb, ${primary} 40%, transparent)`,
            borderRadius: '999px',
            padding: '8px 16px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: `color-mix(in srgb, ${primary} 90%, #fff)`,
            marginBottom: '20px',
            boxShadow: `0 0 24px color-mix(in srgb, ${primary} 20%, transparent)`,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: accent,
              animation: 'maintPulse 2s ease-in-out infinite',
            }}
          />
          <Wrench size={14} strokeWidth={2.5} style={{ opacity: 0.9 }} />
          {siteSettings.siteName}
          <span style={{ opacity: 0.85 }}>· Maintenance</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '14px',
          }}
        >
          <Sparkles size={28} strokeWidth={2} color={accent} style={{ flexShrink: 0 }} aria-hidden />
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              margin: 0,
              background: `linear-gradient(135deg, #fff 20%, color-mix(in srgb, ${primary} 75%, #fff))`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            We&apos;ll be right back
          </h1>
        </div>

        <p
          style={{
            color: 'rgba(226, 232, 240, 0.72)',
            fontSize: 'clamp(0.9375rem, 2vw, 1.0625rem)',
            lineHeight: 1.65,
            marginBottom: '28px',
            maxWidth: '400px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          We&apos;re upgrading the store for a smoother, faster experience. Thanks for your patience — check back soon.
        </p>

        {/* Shimmer bar */}
        <div
          style={{
            height: '4px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.08)',
            marginBottom: '28px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: '40%',
              background: `linear-gradient(90deg, transparent, ${primary}, ${accent}, transparent)`,
              borderRadius: '4px',
              animation: 'maintShimmer 2.2s ease-in-out infinite',
            }}
          />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <AnimatedDot delay={0} primary={primary} accent={accent} variant="gradient" />
          <AnimatedDot delay={0.15} primary={primary} accent={accent} variant="mid" />
          <AnimatedDot delay={0.3} primary={primary} accent={accent} variant="accent" />
        </div>

        {/* Contact */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.55)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, color-mix(in srgb, ${primary} 35%, transparent), color-mix(in srgb, ${accent} 25%, transparent))`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Mail size={20} color="#e2e8f0" strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>Need help?</div>
            <div style={{ fontSize: '13px', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.6 }}>
              Email{' '}
              <a href={`mailto:${email}`} style={{ color: primary, fontWeight: 700, textDecoration: 'none' }}>
                {email}
              </a>
              {waHref && (
                <>
                  {' '}
                  or{' '}
                  <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ color: accent, fontWeight: 700, textDecoration: 'none' }}>
                    message us on WhatsApp
                  </a>
                </>
              )}
              .
            </div>
          </div>
        </div>

        {siteSettings.businessHours && (
          <p style={{ marginTop: '18px', fontSize: '12px', color: 'rgba(148, 163, 184, 0.9)' }}>
            {siteSettings.businessHours}
          </p>
        )}

        <div
          style={{
            marginTop: '22px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'rgba(148, 163, 184, 0.85)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Clock size={14} strokeWidth={2} />
          Local time · {timeStr}
        </div>
      </div>

      {/* Social */}
      <div style={{ marginTop: '28px', display: 'flex', flexWrap: 'wrap', gap: '12px 20px', justifyContent: 'center', zIndex: 1 }}>
        {[
          siteSettings.socialInstagram && { label: 'Instagram', url: siteSettings.socialInstagram },
          siteSettings.socialTwitter && { label: 'X / Twitter', url: siteSettings.socialTwitter },
          siteSettings.socialFacebook && { label: 'Facebook', url: siteSettings.socialFacebook },
        ]
          .filter(Boolean)
          .map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                color: 'rgba(203, 213, 225, 0.6)',
                fontWeight: 600,
                textDecoration: 'none',
                padding: '6px 12px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.08)',
                transition: 'color 0.2s, border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f1f5f9';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(203, 213, 225, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {s.label}
            </a>
          ))}
      </div>

      <style>{`
        @keyframes maintDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 1; }
          40% { transform: translateY(-8px); opacity: 0.65; }
        }
        @keyframes maintPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 color-mix(in srgb, ${accent} 50%, transparent); }
          50% { opacity: 0.85; box-shadow: 0 0 0 6px transparent; }
        }
        @keyframes maintShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes maintCardEnter {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .maint-gear-lg { animation: maintRotateCW 10s linear infinite; }
        .maint-gear-sm { animation: maintRotateCCW 6s linear infinite; }
        @keyframes maintRotateCW { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes maintRotateCCW { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
      `}</style>
    </div>
  );
}
