import React from 'react';
import { useSiteData } from '@/context/SiteDataContext';
import { useReveal } from '@/hooks/useReveal';

/** Client words entered in the admin panel. Hidden until there is at least one. */
export const KindWords: React.FC = () => {
  const { settings } = useSiteData();
  const words = settings.testimonials.filter((t) => t.quote?.trim());
  const revealRef = useReveal<HTMLElement>([words.length]);

  if (!words.length) return null;
  const [lead, ...rest] = words;

  return (
    <section id="words" ref={revealRef} className="border-t border-hairline py-20 sm:py-28">
      <div className="container-site">
        <h2 className="text-sm text-ink-faint" data-reveal>
          From the families we've photographed
        </h2>

        <figure className="mt-8 max-w-4xl" data-reveal>
          <blockquote className="font-serif text-ink-light text-3xl sm:text-4xl lg:text-[2.9rem] leading-[1.2]">
            “{lead.quote}”
          </blockquote>
          <figcaption className="mt-6 text-[15px] text-ink-faint">
            <span className="text-ink-light">{lead.name}</span>
            {lead.event && <> · {lead.event}</>}
          </figcaption>
        </figure>

        {rest.length > 0 && (
          <div className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((t, i) => (
              <figure
                key={t.id}
                className="border-t border-hairline pt-6"
                data-reveal
                style={{ ['--reveal-delay' as string]: `${i * 80}ms` }}
              >
                <blockquote className="font-serif text-xl leading-snug text-ink-light">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm text-ink-faint">
                  <span className="text-ink-light">{t.name}</span>
                  {t.event && <> · {t.event}</>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
