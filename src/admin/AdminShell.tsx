import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  PenLine,
  Settings,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useSiteData } from '@/context/SiteDataContext';
import { AdminDataProvider, useAdminData } from './AdminDataContext';
import { DashboardSection } from './sections/DashboardSection';
import { PhotoLibrarySection } from './sections/PhotoLibrarySection';
import { ProductsSection } from './sections/ProductsSection';
import { OrdersSection } from './sections/OrdersSection';
import { InquiriesSection } from './sections/InquiriesSection';
import { ContentEditorSection } from './sections/ContentEditorSection';
import { StudioSettingsSection } from './sections/StudioSettingsSection';
import { cx } from './ui';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/photos', label: 'Photos', icon: ImageIcon },
  { to: '/admin/content', label: 'Website text', icon: PenLine },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare, badge: 'inquiries' as const },
  { to: '/admin/settings', label: 'Studio & shop settings', icon: Settings },
];

const ShellInner: React.FC<{ onLogout: () => Promise<void> | void }> = ({ onLogout }) => {
  const { settings, refresh } = useSiteData();
  const { summary, refreshSummary } = useAdminData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();

  // Make sure the editors start from what is live right now.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep the nav badges current as the owner moves around.
  useEffect(() => {
    refreshSummary();
    setMenuOpen(false);
  }, [location.pathname, refreshSummary]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const badgeFor = (key?: 'inquiries') => (summary && key === 'inquiries' ? summary.inquiriesNew : 0);

  const nav = (
    <nav aria-label="Admin sections" className="space-y-1 p-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const badge = badgeFor(item.badge);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isActive ? 'bg-accent/15 font-medium text-accent' : 'text-ink-faint hover:bg-canvas-elevated hover:text-ink-light'
              )
            }
          >
            <Icon size={17} aria-hidden />
            <span className="flex-1">{item.label}</span>
            {badge > 0 && (
              <span
                className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-[#0D0C0B]"
                title={`${badge} new ${badge === 1 ? 'inquiry' : 'inquiries'}`}
              >
                {badge}
                <span className="sr-only"> new</span>
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[300] focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-[#0D0C0B]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-hairline-strong bg-[#100F0E] px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-hairline-strong lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="truncate font-serif text-base">{settings.studio_profile.name || 'Studio'}</span>
          <span className="hidden text-xs text-ink-faint sm:inline">· Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline-strong px-3 py-1.5 text-sm hover:border-accent"
          >
            <span>View site</span>
            <ExternalLink size={13} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <button
            type="button"
            onClick={async () => {
              setSigningOut(true);
              await onLogout();
            }}
            disabled={signingOut}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline-strong px-3 py-1.5 text-sm hover:border-red-700 hover:text-red-300 disabled:opacity-60"
          >
            <LogOut size={14} aria-hidden />
            <span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span>
            <span className="sr-only sm:hidden">Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 flex-shrink-0 border-r border-hairline-strong bg-[#0E0D0C] lg:block">
          <div className="sticky top-14">{nav}</div>
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 top-14 z-30 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <div id="admin-mobile-nav" className="relative h-full w-72 max-w-[85vw] overflow-y-auto border-r border-hairline-strong bg-[#0E0D0C]">
              {nav}
            </div>
          </div>
        )}

        <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <Routes>
              <Route index element={<DashboardSection />} />
              <Route path="photos" element={<PhotoLibrarySection />} />
              <Route path="content" element={<ContentEditorSection />} />
              <Route path="products" element={<ProductsSection />} />
              <Route path="orders" element={<OrdersSection />} />
              <Route path="inquiries" element={<InquiriesSection />} />
              <Route path="settings" element={<StudioSettingsSection />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export const AdminShell: React.FC<{ onLogout: () => Promise<void> | void }> = ({ onLogout }) => (
  <AdminDataProvider>
    <ShellInner onLogout={onLogout} />
  </AdminDataProvider>
);
