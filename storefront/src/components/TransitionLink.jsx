import React, { startTransition } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TransitionLink({ to, onClick, children, className, style, ...props }) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    // Let modifier-key clicks (new tab, etc.) pass through normally
    const isNormalClick = e.button === 0 && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey;

    if (isNormalClick && !e.defaultPrevented) {
      e.preventDefault();

      // Run caller's onClick first (e.g. auth guard that calls e.preventDefault)
      if (onClick) {
        onClick(e);
      }

      // Skip router navigation for anchor-only hrefs used as auth placeholders
      if (!to || to === '#' || e.defaultPrevented) return;

      startTransition(() => {
        navigate(to);
      });
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className} style={style} {...props}>
      {children}
    </a>
  );
}
