import React from 'react';
import { Link } from 'react-router-dom';
import { useSiteData } from '@/context/SiteDataContext';
import { HiMark } from '@/components/brand/HiMark';

const instagramUrl = (handle: string) => `https://instagram.com/${handle.replace(/^@/, '').trim()}`;

export const Footer: React.FC<Record<string, unknown>> = () => {
  const { settings } = useSiteData();
  const p = settings.studio_profile;
  const whatsapp = p.whatsapp.replace(/\D/g, '');

  return (
    <footer className="border-t border-hairline bg-canvas-subtle text-ink-faint">
      <div className="container-site pt-16 pb-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-5 space-y-5">
            <Link to="/" className="inline-flex items-center gap-3 text-ink-light">
              <HiMark className="h-11 w-auto" />
              <span className="font-serif text-2xl">{p.name}</span>
            </Link>
            <p className="max-w-sm text-[15px] leading-relaxed">{p.bio}</p>
          </div>

          <div className="md:col-span-3 space-y-2 text-[15px]">
            <h3 className="text-sm text-ink-light mb-3">Visit</h3>
            <p className="leading-relaxed">
              {p.address}
              <br />
              {p.city}, {p.state} {p.pincode}
            </p>
            {p.hours && <p>{p.hours}</p>}
          </div>

          <div className="md:col-span-2 space-y-2 text-[15px]">
            <h3 className="text-sm text-ink-light mb-3">Talk to us</h3>
            <a className="block hover:text-ink-light" href={`tel:${p.phone.replace(/\s/g, '')}`}>
              {p.phone}
            </a>
            {whatsapp && (
              <a className="block hover:text-ink-light" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            )}
            {p.email && (
              <a className="block hover:text-ink-light break-all" href={`mailto:${p.email}`}>
                {p.email}
              </a>
            )}
            {p.instagram && (
              <a className="block hover:text-ink-light" href={instagramUrl(p.instagram)} target="_blank" rel="noreferrer">
                Instagram
              </a>
            )}
          </div>

          <div className="md:col-span-2 space-y-2 text-[15px]">
            <h3 className="text-sm text-ink-light mb-3">Shop</h3>
            <Link className="block hover:text-ink-light" to="/shop">
              Frames & albums
            </Link>
            <Link className="block hover:text-ink-light" to="/shop/custom-frame">
              Frame your own photo
            </Link>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-hairline flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between text-sm">
          <p>
            © {new Date().getFullYear()} {p.legalName || p.name}
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Policies">
            <Link className="hover:text-ink-light" to="/policies/shipping">Shipping</Link>
            <Link className="hover:text-ink-light" to="/policies/returns">Returns</Link>
            <Link className="hover:text-ink-light" to="/policies/privacy">Privacy</Link>
            <Link className="hover:text-ink-light" to="/policies/terms">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};
