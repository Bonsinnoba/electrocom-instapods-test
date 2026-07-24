import React, { startTransition } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function TransitionLink({ to, onClick, children, className, style, ...props }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (e) => {
    // Check if the click is a normal left click without modifiers (Ctrl, Cmd, Alt, Shift)
    const isNormalClick = e.button === 0 && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey;
    
    if (isNormalClick && !e.defaultPrevented) {
      e.preventDefault();
      
      // Only navigate if we are transitioning to a different pathname
      if (location.pathname !== to) {
        startTransition(() => {
          navigate(to);
        });
      }
      
      if (onClick) {
        onClick(e);
      }
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className} style={style} {...props}>
      {children}
    </a>
  );
}
