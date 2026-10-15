import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PhotoItem } from '@/types';
import { useVisiblePhotos } from '@/context/SiteDataContext';
import { Picture } from '@/components/ui/Picture';
import { useReveal } from '@/hooks/useReveal';

interface PhotoRingProps {
  onOpenPhoto: (photo: PhotoItem) => void;
}

const MIN_CARDS = 10;

/**
 * The archive as a ring of prints in 3D. It turns slowly on its own; drag (mouse or touch) to spin it,
 * with momentum. Cards facing away dim so the front of the ring stays readable.
 */
export const PhotoRing: React.FC<PhotoRingProps> = ({ onOpenPhoto }) => {
  const photos = useVisiblePhotos();
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragged = useRef(false);
  const revealRef = useReveal<HTMLElement>([photos.length]);
  const [cardW, setCardW] = useState(240);

  // Repeat photos when there are too few to close the ring.
  const cards = useMemo(() => {
    if (!photos.length) return [];
    const out: PhotoItem[] = [];
    while (out.length < Math.max(MIN_CARDS, photos.length)) out.push(...photos);
    return out.slice(0, Math.max(MIN_CARDS, photos.length));
  }, [photos]);

  const n = cards.length;
  const step = 360 / Math.max(n, 1);
  const radius = Math.round(((cardW + cardW * 0.18) * n) / (2 * Math.PI));

  useEffect(() => {
    const update = () => setCardW(window.innerWidth < 640 ? 150 : window.innerWidth < 1024 ? 200 : 240);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const ring = ringRef.current;
    if (!stage || !ring || !n) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let angle = 0;
    let velocity = 0;
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    let visible = false;
    let raf = 0;
    const idleSpeed = reduced ? 0 : -0.035; // degrees per ms

    const paint = () => {
      ring.style.transform = `translateZ(${-radius}px) rotateX(-7deg) rotateY(${angle}deg)`;
      // Dim cards by how far they face away from the viewer.
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const a = (((i * step + angle) % 360) + 360) % 360;
        const facing = Math.cos((a * Math.PI) / 180); // 1 = facing us, -1 = away
        el.style.opacity = String(0.25 + 0.75 * Math.max(0, (facing + 0.35) / 1.35));
      });
    };

    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - prev);
      prev = now;
      if (!dragging) {
        velocity *= 0.95;
        if (Math.abs(velocity) < Math.abs(idleSpeed)) velocity = idleSpeed;
        angle += velocity * dt;
      }
      paint();
      raf = visible ? requestAnimationFrame(tick) : 0;
    };

    const start = () => {
      if (!raf) {
        prev = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    // Only animate while the section is on screen.
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(stage);

    const onDown = (e: PointerEvent) => {
      dragging = true;
      dragged.current = false;
      lastX = e.clientX;
      lastT = performance.now();
      velocity = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      if (Math.abs(dx) > 2) dragged.current = true;
      const delta = dx * 0.22;
      angle += delta;
      velocity = delta / Math.max(1, now - lastT);
      lastX = e.clientX;
      lastT = now;
      if (!visible) paint();
    };
    const onUp = () => {
      dragging = false;
    };

    paint();
    stage.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [n, radius, step]);

  if (!n) return null;

  return (
    <section id="reel" ref={revealRef} className="relative overflow-hidden bg-canvas-subtle border-t border-hairline py-20 sm:py-28">
      <div className="container-site grid grid-cols-1 gap-6 md:grid-cols-12 md:items-end" data-reveal>
        <h2 className="md:col-span-7 font-serif text-4xl sm:text-5xl text-ink-light">Every family, a different day</h2>
        <p className="md:col-span-5 text-ink-faint md:text-right">
          The whole archive in one turn. Drag to spin it, tap a print to open it.
        </p>
      </div>

      <div
        ref={stageRef}
        className="relative mt-2 sm:mt-10 cursor-grab active:cursor-grabbing touch-pan-y select-none"
        style={{ height: cardW * 1.25 + (cardW < 200 ? 80 : 160), perspective: `${Math.max(900, radius * 2.2)}px` }}
      >
        <div
          ref={ringRef}
          className="absolute left-1/2 top-1/2"
          style={{ transformStyle: 'preserve-3d', width: 0, height: 0 }}
        >
          {cards.map((photo, i) => (
            <div
              key={`${photo.id}-${i}`}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="absolute"
              style={{
                width: cardW,
                height: cardW * 1.25,
                left: -cardW / 2,
                top: (-cardW * 1.25) / 2,
                transform: `rotateY(${i * step}deg) translateZ(${radius}px)`,
              }}
            >
              <button
                type="button"
                onClick={() => !dragged.current && onOpenPhoto(photo)}
                className="block w-full h-full bg-[#F7F3EA] p-[5%] shadow-[0_30px_50px_-25px_rgba(0,0,0,0.7)] transition-transform duration-300 hover:-translate-y-2"
                aria-label={`View ${photo.title}`}
                tabIndex={i < photos.length ? 0 : -1}
              >
                <Picture photo={photo} sizes={`${cardW}px`} className="w-full h-full" draggable={false} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
