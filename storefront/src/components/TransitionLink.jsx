import React, { startTransition } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Drop-in replacement for <Link> that wraps navigation in startTransition,
 * preventing React error #426 (suspended component during synchronous input).
 *
 * Handles three cases:
 *  1. to="#"  — auth-placeholder links: call onClick, do NOT navigate.
 *  2. Normal  — prevent default browser nav, call onClick (e.g. close sidebar),
 *               then navigate inside startTransition.
 *  3. Modifier keys (Ctrl/Cmd/Shift/Alt) — let the browser handle natively.
 */
export default function TransitionLink({ to, onClick, children, className, style, ...props }) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    // Let modifier-key clicks (open-in-new-tab etc.) pass through normally
    const isNormalClick =
      e.button === 0 && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey;

    if (!isNormalClick) return;

    // '#' links are auth-guard placeholders — just fire onClick and stop
    if (!to || to === '#') {
      e.preventDefault();
      if (onClick) onClick(e);
      return;
    }

    // Normal route link — prevent full-page reload
    e.preventDefault();

    // Fire onClick first (e.g. sidebar close, analytics)
    if (onClick) onClick(e);

    // Schedule the route transition as a non-urgent update so that
    // lazy-loaded chunks can suspend without crashing (#426)
    startTransition(() => {
      navigate(to);
    });
  };

  return (
    <a href={to} onClick={handleClick} className={className} style={style} {...props}>
      {children}
    </a>
  );
}
