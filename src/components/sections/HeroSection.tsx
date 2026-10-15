import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PhotoItem } from '@/types';
import { useSiteData, useVisiblePhotos } from '@/context/SiteDataContext';
import { Picture } from '@/components/ui/Picture';

gsap.registerPlugin(ScrollTrigger);

interface HeroSectionProps {
  // False while the splash is still playing; the prints settle once it turns true.
  ready: boolean;
  onOpenPhoto: (photo: PhotoItem) => void;
}

// Where each print rests in the scene: centre (% of stage), depth (px), tilt and width.
// Desktop keeps the lower-left clear for the headline.
const DESKTOP_SLOTS = [
  { x: 63, y: 47, z: 80, ry: -8, rz: -3, w: 23 },
  { x: 85, y: 29, z: -140, ry: -14, rz: 4, w: 17 },
  { x: 43, y: 23, z: -340, ry: 6, rz: -6, w: 14 },
  { x: 87, y: 75, z: -60, ry: -10, rz: 5, w: 16 },
  { x: 22, y: 16, z: -640, ry: 10, rz: 3, w: 13 },
  { x: 60, y: 86, z: -280, ry: -4, rz: -4, w: 13 },
  { x: 106, y: 52, z: -500, ry: -22, rz: -2, w: 15 },
];
const MOBILE_SLOTS = [
  { x: 52, y: 52, z: 40, ry: -6, rz: -3, w: 52 },
  { x: 18, y: 34, z: -220, ry: 10, rz: 5, w: 38 },
  { x: 86, y: 30, z: -300, ry: -12, rz: -5, w: 36 },
  { x: 82, y: 70, z: -120, ry: -8, rz: 6, w: 30 },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ ready, onOpenPhoto }) => {
  const { settings } = useSiteData();
  const photos = useVisiblePhotos();
  const hero = settings.hero;
  const profile = settings.studio_profile;

  const sectionRef = useRef<HTMLElement>(null);
  const dollyRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const printRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Phones and portrait tablets stack the prints above the text; wide screens spread them behind it.
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  const isCompact = isMobile || (typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches);
  const slots = useMemo(
    () => (isCompact ? MOBILE_SLOTS.map((s) => ({ ...s, w: isMobile ? s.w : s.w * 0.72 })) : DESKTOP_SLOTS),
    [isCompact, isMobile]
  );

  // Admin-picked photos first, then featured ones, then the rest.
  const prints = useMemo(() => {
    const byId = new Map(photos.map((p) => [p.id, p]));
    const picked = hero.photoIds.map((id) => byId.get(id)).filter(Boolean) as PhotoItem[];
    const rest = [...photos.filter((p) => p.featured), ...photos.filter((p) => !p.featured)].filter(
      (p) => !picked.includes(p)
    );
    return [...picked, ...rest].slice(0, slots.length);
  }, [photos, hero.photoIds, slots.length]);

  const printKey = prints.map((p) => p.id).join('|');

  // Place prints, play the settle-in once ready, then hand control to pointer + scroll.
  useEffect(() => {
    const scene = sceneRef.current;
    const dolly = dollyRef.current;
    const section = sectionRef.current;
    if (!scene || !dolly || !section || !prints.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = printRefs.current.slice(0, prints.length).filter(Boolean) as HTMLDivElement[];

    const ctx = gsap.context(() => {
      els.forEach((el, i) => {
        const s = slots[i];
        gsap.set(el, { xPercent: -50, yPercent: -50, z: s.z, rotationY: s.ry, rotation: s.rz });
      });
      gsap.set(textRef.current, { opacity: 1 });

      if (reduced) return;

      if (!ready) {
        gsap.set(els, { opacity: 0 });
        gsap.set(textRef.current?.children ?? [], { opacity: 0, y: 24 });
        return;
      }

      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro.from(els, {
        z: (i: number) => slots[i].z + 900,
        rotationX: -28,
        opacity: 0,
        duration: 1.6,
        stagger: 0.11,
      });
      intro.fromTo(
        textRef.current?.children ?? [],
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.1 },
        0.35
      );

      // Scrolling moves the camera forward through the prints.
      gsap.to(dolly, {
        z: isCompact ? 380 : 620,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
      gsap.to(textRef.current, {
        y: -60,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'center center', end: 'bottom top', scrub: 0.6 },
      });
    }, section);

    // The scene leans toward the pointer.
    let cleanupPointer = () => {};
    if (!reduced && !isCompact) {
      const rx = gsap.quickTo(scene, 'rotationX', { duration: 1.4, ease: 'power3.out' });
      const ry = gsap.quickTo(scene, 'rotationY', { duration: 1.4, ease: 'power3.out' });
      const onMove = (e: PointerEvent) => {
        const px = e.clientX / window.innerWidth - 0.5;
        const py = e.clientY / window.innerHeight - 0.5;
        ry(px * 9);
        rx(-py * 6);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      cleanupPointer = () => window.removeEventListener('pointermove', onMove);
    }

    return () => {
      cleanupPointer();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, printKey, isCompact, slots]);

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative w-full overflow-hidden bg-canvas"
      style={{ height: 'max(100svh, 640px)' }}
    >
      {/* 3D stage */}
      <div
        className={`absolute inset-x-0 top-0 ${isCompact ? 'h-[62%]' : 'h-full'}`}
        style={{ perspective: isCompact ? '1100px' : '1600px', perspectiveOrigin: '58% 42%' }}
        aria-hidden={prints.length === 0}
      >
        <div ref={dollyRef} className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
          <div ref={sceneRef} className="absolute inset-0 will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
            {prints.map((photo, i) => (
              <div
                key={photo.id}
                ref={(el) => {
                  printRefs.current[i] = el;
                }}
                className="absolute"
                style={{
                  left: `${slots[i].x}%`,
                  top: `${slots[i].y}%`,
                  width: `${slots[i].w}vw`,
                  transformStyle: 'preserve-3d',
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpenPhoto(photo)}
                  className="hero-print group block w-full text-left"
                  style={{ animationDelay: `${-i * 1.7}s`, animationDuration: `${9 + (i % 3) * 2}s` }}
                  aria-label={`View photo: ${photo.title}`}
                >
                  <span className="block bg-[#F7F3EA] p-[4.5%] pb-[5.5%] shadow-[0_40px_70px_-30px_rgba(0,0,0,0.75),0_8px_20px_-10px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-out group-hover:[transform:translateZ(70px)] group-focus-visible:[transform:translateZ(70px)]">
                    <Picture
                      photo={photo}
                      sizes={`${Math.round(slots[i].w)}vw`}
                      eager={i < 3}
                      className="w-full"
                      natural
                    />
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Keeps the headline readable where prints pass behind it */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 70% at 0% 100%, var(--canvas) 18%, transparent 62%), linear-gradient(to top, var(--canvas) 0%, transparent 38%)',
        }}
      />

      <div className="relative z-10 h-full container-site flex flex-col justify-end pb-10 sm:pb-14 md:pb-20 pointer-events-none">
        <div ref={textRef} className="max-w-[40rem] pointer-events-auto">
          <p className="text-sm text-ink-faint mb-5">
            {profile.city} ·{' '}
            {(['weddings', 'baby', 'portraits'] as const).map((c) => settings.portfolio[c].label).join(' · ')}
          </p>
          <h1 className="font-serif text-ink-light text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[5.4rem] tracking-[-0.015em]">
            {hero.headline}
          </h1>
          {hero.subheading && (
            <p className="mt-6 max-w-[32rem] text-base sm:text-[17px] leading-relaxed text-ink-faint">{hero.subheading}</p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link to="/#contact" className="btn-primary">
              {hero.primaryCtaLabel}
            </Link>
            <Link to="/shop" className="link-line">
              {hero.secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
