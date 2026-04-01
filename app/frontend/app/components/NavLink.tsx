'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

interface NavLinkProps {
  href: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
}

/**
 * Enhanced NavLink Component with Loading State
 * 
 * Shows a loading indicator on the link when clicked.
 * This provides immediate feedback that navigation is happening.
 * 
 * How it works:
 * 1. Tracks when link is clicked
 * 2. Shows loading spinner on the link
 * 3. Uses Next.js router for client-side navigation
 * 4. Resets loading state after navigation
 */
export default function NavLink({ href, label, icon, onClick }: NavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const isActive = pathname === href;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only handle if not already on this page
    if (pathname === href) {
      e.preventDefault();
      return;
    }

    setIsNavigating(true);
    
    if (onClick) {
      onClick();
    }

    // Navigate using router
    router.push(href);

    // Reset loading state after navigation completes
    // (Next.js navigation is usually instant, but we give it a moment)
    setTimeout(() => {
      setIsNavigating(false);
    }, 500);
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`nav-link-item inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative min-h-0 min-w-0 ${
        isActive
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      } ${isNavigating ? 'opacity-70 cursor-wait' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon != null && <span className="text-slate-500 shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
      {isNavigating && (
        <span className="ml-2 inline-block">
          <svg
            className="w-3 h-3 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </span>
      )}
    </Link>
  );
}

