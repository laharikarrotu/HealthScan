'use client';

import Link from 'next/link';
import { useState } from 'react';
import NavLink from './NavLink';
import { IconChat, IconScan, IconPill, IconWellness } from './ui/icons';

export default function Nav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navLinks = [
    { href: '/', label: 'Assistant', icon: <IconChat className="w-4 h-4" /> },
    { href: '/scan', label: 'Scan', icon: <IconScan className="w-4 h-4" /> },
    { href: '/interactions', label: 'Interactions', icon: <IconPill className="w-4 h-4" /> },
    { href: '/diet', label: 'Diet', icon: <IconWellness className="w-4 h-4" /> },
  ];
  
  return (
    <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 w-full">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white text-xs font-bold tracking-tight">
              HS
            </div>
            <div className="leading-tight">
              <span className="text-sm font-semibold text-slate-900 block">HealthScan</span>
              <span className="text-[11px] text-slate-500 hidden sm:block">Healthcare assistant</span>
            </div>
          </Link>

          {/* Desktop Navigation - Using NavLink with loading states */}
          <div className="hidden md:flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                onClick={() => setMobileMenuOpen(false)}
              />
            ))}
        </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
          
        {/* Mobile Navigation - Using NavLink with loading states */}
          {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 py-3 flex flex-col gap-1.5">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                onClick={() => setMobileMenuOpen(false)}
              />
            ))}
            </div>
          )}
      </div>
    </nav>
  );
}
