import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { COMPANY_INFO } from '../../data/siteContent';
import { PublicPage } from '../../types';

interface PublicShellProps {
  currentPage: PublicPage;
  onNavigate: (page: PublicPage) => void;
  children: React.ReactNode;
}

const PUBLIC_NAV: { id: PublicPage; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About Us' },
  { id: 'services', label: 'Services' },
  { id: 'programs', label: 'Programs' },
  { id: 'contact', label: 'Contact Us' },
  { id: 'career', label: 'Career' },
];

export function PublicShell({ currentPage, onNavigate, children }: PublicShellProps) {
  const { institution, institutionLoaded } = useSchool();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (page: PublicPage) => {
    let target = page;
    // Automatic guard: zero database entry triggers Setup when trying to Login;
    // existing database entry always redirects Setup to Login without fail.
    if (institutionLoaded) {
      if (page === 'login' && !institution?.setupComplete) {
        target = 'setup';
      } else if (page === 'setup' && institution?.setupComplete) {
        target = 'login';
      }
    }
    onNavigate(target);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0 cursor-pointer"
          >
            {COMPANY_INFO.name}
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-7 text-sm font-medium"
          >
            {PUBLIC_NAV.map((item) => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    active
                      ? 'text-slate-900 border-[#0F4C5C]'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary Login CTA (auto-triggers Setup on empty DB) */}
          <div className="hidden lg:flex items-center shrink-0">
            <button
              type="button"
              onClick={() => handleNav('login')}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Login
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="lg:hidden p-2 text-slate-700 hover:text-slate-900 rounded-md"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-6 py-4 space-y-2">
            {PUBLIC_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`block w-full text-left py-2 text-sm font-medium ${
                  currentPage === item.id ? 'text-[#0F4C5C]' : 'text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="pt-3 mt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleNav('login')}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#0F4C5C] rounded-md text-center"
              >
                Login
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Quiet Editorial Footer with understated Setup link */}
      <footer className="bg-slate-950 text-slate-300 border-t border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5 space-y-3">
            <p className="text-lg font-bold text-white font-display tracking-tight">
              {COMPANY_INFO.name}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Invite-only school operations infrastructure for real-time attendance, automated
              parent communications, admissions enrolment, departments, and staff governance.
            </p>
            <div className="text-xs text-slate-500 pt-2 space-y-1">
              <p>{COMPANY_INFO.headquarters}</p>
              <p>
                {COMPANY_INFO.phoneWithHours} · {COMPANY_INFO.email}
              </p>
            </div>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <p className="text-xs font-semibold text-slate-400">Navigation</p>
            <ul className="space-y-2 text-sm">
              {PUBLIC_NAV.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleNav(item.id)}
                    className="text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-400">Institution Access</p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Logins are invite-only and role-scoped by your school&apos;s Super Admin for
              Stakeholders, Administration, Teachers, Staff, and Students.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleNav('login')}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-white hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                Member Login
              </button>
              <button
                type="button"
                onClick={() => handleNav('setup')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                Setup
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800/80">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} {COMPANY_INFO.name}. All rights reserved.</span>
            <span>Invite-Only Campus Governance · Tezpur, Assam</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
