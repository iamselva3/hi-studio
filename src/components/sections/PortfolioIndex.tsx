import React, { useMemo, useState } from 'react';
import { PhotoCategory, PhotoItem } from '@/types';
import { useSiteData, useVisiblePhotos } from '@/context/SiteDataContext';
import { Picture } from '@/components/ui/Picture';
import { useReveal } from '@/hooks/useReveal';

interface PortfolioIndexProps {
  onOpenPhoto: (photo: PhotoItem) => void;
}

const ORDER: PhotoCategory[] = ['weddings', 'baby', 'candid', 'portraits'];

/** Category index on the left, that category's photographs in a masonry column on the right. */
export const PortfolioIndex: React.FC<PortfolioIndexProps> = ({ onOpenPhoto }) => {
  const { settings } = useSiteData();
  const photos = useVisiblePhotos();
  const categories = useMemo(
    () => ORDER.map((id) => ({ id, ...settings.portfolio[id], photos: photos.filter((p) => p.category === id) })).filter((c) => c.photos.length),
    [photos, settings.portfolio]
  );
  const [active, setActive] = useState<PhotoCategory>('weddings');
  const current = categories.find((c) => c.id === active) ?? categories[0];
  const revealRef = useReveal<HTMLElement>([categories.length]);

  if (!current) return null;

  return (
    <section id="portfolio" ref={revealRef} className="border-t border-hairline py-20 sm:py-28">
      <div className="container-site grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28" data-reveal>
            <h2 className="font-serif text-4xl sm:text-5xl text-ink-light">Portfolio</h2>

            {/* Mobile: a scrollable row of categories */}
            <div className="lg:hidden no-scrollbar -mx-5 px-5 mt-6 flex gap-2 overflow-x-auto" role="tablist" aria-label="Portfolio categories">
              {categories.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={c.id === current.id}
                  onClick={() => setActive(c.id)}
                  className={`shrink-0 h-11 px-4 rounded-full border text-[15px] transition-colors ${
                    c.id === current.id ? 'border-ink-light text-ink-light' : 'border-hairline-strong text-ink-faint'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Desktop: a typographic index */}
            <ul className="hidden lg:block mt-10 border-t border-hairline" role="tablist" aria-label="Portfolio categories">
              {categories.map((c) => {
                const on = c.id === current.id;
                return (
                  <li key={c.id} className="border-b border-hairline">
                    <button
                      role="tab"
                      aria-selected={on}
                      onClick={() => setActive(c.id)}
                      className="w-full py-5 text-left group"
                    >
                      <span className="flex items-baseline justify-between gap-4">
                        <span className={`font-serif text-[2rem] leading-none transition-colors ${on ? 'text-ink-light' : 'text-ink-faint group-hover:text-ink-light'}`}>
                          {c.label}
                        </span>
                        <span className="text-sm text-ink-faint tabular-nums">{c.photos.length}</span>
                      </span>
                      <span
                        className={`block overflow-hidden text-[15px] text-ink-faint transition-[max-height,opacity,margin] duration-500 ${
                          on ? 'max-h-24 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
                        }`}
                      >
                        {c.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-8">
          <p className="lg:hidden text-[15px] text-ink-faint mb-6">{current.description}</p>
          <div key={current.id} className="columns-2 gap-3 sm:gap-5 animate-fade-in">
            {current.photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onOpenPhoto(photo)}
                className="group block w-full mb-3 sm:mb-5 break-inside-avoid text-left"
                style={{ animationDelay: `${i * 60}ms` }}
                aria-label={`View ${photo.title}`}
              >
                <Picture
                  photo={photo}
                  sizes="(max-width: 1024px) 50vw, 33vw"
                  className="w-full"
                  natural
                  imgClassName="transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
                />
                <span className="mt-2 block text-sm text-ink-faint group-hover:text-ink-light transition-colors">{photo.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
