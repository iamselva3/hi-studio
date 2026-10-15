import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PhotoItem } from '@/types';
import { useSiteData, useVisiblePhotos } from '@/context/SiteDataContext';
import { Picture } from '@/components/ui/Picture';
import { useDragScroll } from '@/hooks/useDragScroll';
import { useReveal } from '@/hooks/useReveal';

interface SelectedWorkProps {
  onOpenPhoto: (photo: PhotoItem) => void;
}

/** A horizontal run of featured photographs at their real proportions. */
export const SelectedWork: React.FC<SelectedWorkProps> = ({ onOpenPhoto }) => {
  const { settings } = useSiteData();
  const photos = useVisiblePhotos();
  const featured = useMemo(() => {
    const f = photos.filter((p) => p.featured);
    return f.length >= 4 ? f : photos.slice(0, 8);
  }, [photos]);
  const { ref: scrollerRef, wasDrag } = useDragScroll<HTMLDivElement>();
  const revealRef = useReveal<HTMLDivElement>([featured.length]);

  const nudge = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' });
  };

  if (!featured.length) return null;

  return (
    <section id="work" className="pt-24 sm:pt-32 pb-20 sm:pb-28" ref={revealRef}>
      <div className="container-site flex items-end justify-between gap-6 mb-10 sm:mb-14" data-reveal>
        <div>
          <h2 className="font-serif text-4xl sm:text-5xl text-ink-light">Selected work</h2>
          <p className="mt-3 text-ink-faint max-w-md">
            A few recent favourites. Drag sideways, or tap a picture to see it larger.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button onClick={() => nudge(-1)} className="w-11 h-11 rounded-full border border-hairline-strong text-ink-faint hover:text-ink-light hover:border-ink-faint inline-flex items-center justify-center transition-colors" aria-label="Scroll back">
            <ArrowLeft size={18} />
          </button>
          <button onClick={() => nudge(1)} className="w-11 h-11 rounded-full border border-hairline-strong text-ink-faint hover:text-ink-light hover:border-ink-faint inline-flex items-center justify-center transition-colors" aria-label="Scroll forward">
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="no-scrollbar gutter-x flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-proximity cursor-grab select-none"
        data-reveal
        style={{ ['--reveal-delay' as string]: '120ms' }}
      >
        {featured.map((photo) => (
          <figure key={photo.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => !wasDrag() && onOpenPhoto(photo)}
              // Phones: even 4:5 cards. Larger screens: one row height, each photo at its real proportions.
              className="block overflow-hidden group w-[78vw] aspect-[4/5] sm:w-auto sm:h-[var(--row-h)] sm:[aspect-ratio:var(--ar)]"
              aria-label={`View ${photo.title}`}
              style={
                {
                  '--ar': `${photo.width} / ${photo.height}`,
                  '--row-h': `min(clamp(300px, 56vh, 560px), calc(85vw * ${photo.height / photo.width}))`,
                } as React.CSSProperties
              }
            >
              <Picture
                photo={photo}
                sizes="(max-width: 640px) 80vw, 40vw"
                className="w-full h-full"
                imgClassName="transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
              />
            </button>
            {/* Zero width + full min-width: the caption never makes the figure wider than its photo */}
            <figcaption className="mt-3 flex items-baseline justify-between gap-6 text-sm w-0 min-w-full">
              <span className="text-ink-light">{photo.title}</span>
              <span className="text-ink-faint">{settings.portfolio[photo.category]?.label}</span>
            </figcaption>
          </figure>
        ))}
        <div className="shrink-0 w-1" aria-hidden />
      </div>
    </section>
  );
};
