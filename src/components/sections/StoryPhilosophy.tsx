import React, { useMemo } from 'react';
import { useSiteData, useVisiblePhotos } from '@/context/SiteDataContext';
import { Picture } from '@/components/ui/Picture';
import { useReveal } from '@/hooks/useReveal';

export const StoryPhilosophy: React.FC = () => {
  const { settings } = useSiteData();
  const photos = useVisiblePhotos();
  const { story, studio_profile: profile } = settings;
  const photo = useMemo(
    () => photos.find((p) => p.id === story.photoId) ?? photos.find((p) => p.category === 'portraits') ?? photos[0],
    [photos, story.photoId]
  );
  const revealRef = useReveal<HTMLElement>([photo?.id]);

  // Only real, admin-entered numbers are shown.
  const stats = [
    { value: profile.experienceYears, label: profile.experienceYears === 1 ? 'year behind the camera' : 'years behind the camera' },
    { value: profile.weddingsDocumented, label: 'weddings photographed' },
    { value: profile.awardsCount, label: profile.awardsCount === 1 ? 'award' : 'awards' },
  ].filter((s) => Number(s.value) > 0);

  return (
    <section id="story" ref={revealRef} className="border-t border-hairline py-20 sm:py-32">
      <div className="container-site grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-0 items-start">
        <div className="lg:col-span-6 lg:pr-12" data-reveal>
          <h2 className="font-serif text-ink-light text-4xl sm:text-5xl lg:text-[3.6rem] leading-[1.05] tracking-[-0.01em]">
            {story.heading}
          </h2>
          <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-ink-faint max-w-[34rem]">
            {story.paragraphs.filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {stats.length > 0 && (
            <dl className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-8 max-w-[34rem]">
              {stats.map((s) => (
                <div key={s.label} className="border-t border-hairline pt-4">
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="block font-serif text-5xl text-ink-light tabular-nums leading-none">{s.value}</span>
                    <span className="mt-2 block text-sm text-ink-faint">{s.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {photo && (
          <figure className="lg:col-span-5 lg:col-start-8 lg:mt-24" data-reveal style={{ ['--reveal-delay' as string]: '150ms' }}>
            <Picture photo={photo} sizes="(max-width: 1024px) 100vw, 40vw" className="w-full" natural />
            <figcaption className="mt-3 text-sm text-ink-faint">{photo.title}</figcaption>
          </figure>
        )}
      </div>
    </section>
  );
};
