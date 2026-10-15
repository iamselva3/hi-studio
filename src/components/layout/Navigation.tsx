import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon, ShoppingBag } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import { useSiteData } from '@/context/SiteDataContext';
import { HiMark } from '@/components/brand/HiMark';

const LINKS = [
  { label: 'Work', to: '/#work' },
  { label: 'Story', to: '/#story' },
  { label: 'Shop', to: '/shop' },
  { label: 'Contact', to: '/#contact' },
];

// Older callers passed props; the bar now reads everything from context.
export const Navigation: React.FC<Record<string, unknown>> = () => {
  const { pathname, hash } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { count, openCart } = useCart();
  const { settings } = useSiteData();
  const profile = settings.studio_profile;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const overHero = pathname === '/' && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname, hash]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const isActive = (to: string) => (to.startsWith('/#') ? pathname === '/' && hash === to.slice(1) : pathname.startsWith(to));

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[100] transition-[background-color,border-color,backdrop-filter] duration-300 ${
          overHero && !menuOpen
            ? 'bg-transparent border-b border-transparent'
            : 'bg-canvas/90 backdrop-blur-md border-b border-hairline'
        }`}
      >
        <div className="container-site h-16 sm:h-[72px] flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3 text-ink-light" aria-label={`${profile.name} home`}>
            <HiMark className="h-8 w-auto sm:h-9" />
            <span className="font-serif text-xl tracking-[0.01em] leading-none">{profile.name}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Main">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`relative text-[15px] transition-colors ${
                  isActive(l.to) ? 'text-ink-light' : 'text-ink-faint hover:text-ink-light'
                }`}
              >
                {l.label}
                {isActive(l.to) && <span className="absolute -bottom-1.5 left-0 right-0 h-px bg-accent" />}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={toggleTheme}
              className="w-11 h-11 inline-flex items-center justify-center rounded-full text-ink-faint hover:text-ink-light transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={openCart}
              className="relative w-11 h-11 inline-flex items-center justify-center rounded-full text-ink-faint hover:text-ink-light transition-colors"
              aria-label={`Open bag${count ? `, ${count} item${count > 1 ? 's' : ''}` : ''}`}
            >
              <ShoppingBag size={18} />
              {count > 0 && (
                <span className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-canvas text-[11px] font-semibold leading-[18px] text-center tabular-nums">
                  {count}
                </span>
              )}
            </button>
            <Link to="/#contact" className="hidden sm:inline-flex btn-primary h-10 px-4 text-sm ml-2">
              Book a shoot
            </Link>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden w-11 h-11 inline-flex items-center justify-center rounded-full text-ink-light"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`md:hidden fixed inset-0 z-[90] bg-canvas transition-[opacity,visibility] duration-300 ${
          menuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <div className="container-site pt-24 pb-10 h-full flex flex-col">
          <nav className="flex flex-col" aria-label="Mobile">
            {[...LINKS, { label: 'Frame your own photo', to: '/shop/custom-frame' }].map((l, i) => (
              <Link
                key={l.to}
                to={l.to}
                className="py-3 border-b border-hairline font-serif text-[34px] leading-tight text-ink-light"
                style={{ transitionDelay: `${i * 30}ms` }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto space-y-2 text-[15px] text-ink-faint">
            <a href={`tel:${profile.phone.replace(/\s/g, '')}`} className="block text-ink-light">
              {profile.phone}
            </a>
            <a href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="block">
              WhatsApp
            </a>
            <p>{profile.city}</p>
          </div>
        </div>
      </div>
    </>
  );
};
