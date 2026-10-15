import React from 'react';
import { useSiteData } from '@/context/SiteDataContext';
import { useReveal } from '@/hooks/useReveal';

export const ProcessTimeline: React.FC = () => {
  const { settings } = useSiteData();
  const { heading, steps } = settings.process;
  const revealRef = useReveal<HTMLElement>([steps.length]);
  const visible = steps.filter((s) => s.title);

  if (!visible.length) return null;

  return (
    <section id="process" ref={revealRef} className="border-t border-hairline py-20 sm:py-28">
      <div className="container-site">
        <h2 className="font-serif text-4xl sm:text-5xl text-ink-light max-w-2xl" data-reveal>
          {heading}
        </h2>

        <ol className={`mt-10 sm:mt-14 grid grid-cols-1 gap-y-8 sm:gap-x-10 sm:gap-y-12 sm:grid-cols-2 ${visible.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {visible.map((step, i) => (
            <li
              key={i}
              // Phones: number beside the text to keep the list short. Larger screens: number above.
              className="relative border-t border-hairline-strong pt-5 sm:pt-6 grid grid-cols-[3rem_1fr] sm:block"
              data-reveal
              style={{ ['--reveal-delay' as string]: `${i * 90}ms` }}
            >
              <span className="absolute -top-px left-0 h-px w-10 bg-accent" aria-hidden />
              <span className="font-serif text-[2.6rem] sm:text-[4.5rem] leading-none text-ink-light/20 tabular-nums" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h3 className="sm:mt-2 font-serif text-2xl text-ink-light">{step.title}</h3>
                {step.when && <p className="mt-1 text-sm text-accent">{step.when}</p>}
                <p className="mt-3 sm:mt-4 text-[15px] leading-relaxed text-ink-faint">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
