import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { HI_STROKES } from '@/components/brand/hiStrokes';

interface SplashScreenProps {
  onComplete: () => void;
  tagline?: string;
  subtitle?: string;
}

// Logo line is ~23px wide; the brush adds a small margin for anti-aliased edges.
const HI_BRUSH = 36;
// Logo units per second, so long strokes take longer, like a real pen.
const PEN_SPEED = 1100;

// Hide a stroke so it can be drawn on by animating strokeDashoffset to 0.
// The gap is slightly longer than the path so round caps never leave a dot at either end.
const hideStroke = (el: SVGGeometryElement) => {
  const length = el.getTotalLength();
  gsap.set(el, { strokeDasharray: `${length} ${length + 2}`, strokeDashoffset: length + 1 });
  return length;
};

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  tagline = 'The moment the shutter closes and time holds still.',
  subtitle = 'Photography · Coimbatore',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<SVGRectElement>(null);
  const topBarRef = useRef<SVGRectElement>(null);
  const boxBorderRef = useRef<SVGRectElement>(null);
  const strokeRefs = useRef<(SVGPathElement | null)[]>([]);
  const dotIRef = useRef<SVGCircleElement>(null);
  const studioRef = useRef<SVGGElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [hasSkipped, setHasSkipped] = useState(false);

  // Parent re-renders pass a new onComplete; keep the latest without restarting the animation.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      onCompleteRef.current();
      return;
    }

    if (boxBorderRef.current) hideStroke(boxBorderRef.current);
    const strokeLengths = strokeRefs.current.map((p) => (p ? hideStroke(p) : 0));

    if (dotIRef.current) gsap.set(dotIRef.current, { scale: 0, opacity: 0, svgOrigin: '708 400' });
    if (boxRef.current) gsap.set(boxRef.current, { opacity: 0, scale: 0.96, transformOrigin: 'center' });
    if (topBarRef.current) gsap.set(topBarRef.current, { opacity: 0, y: -8 });
    if (studioRef.current) gsap.set(studioRef.current, { opacity: 0, y: 12 });
    if (subtitleRef.current) gsap.set(subtitleRef.current, { opacity: 0, y: 10 });

    const tl = gsap.timeline({
      onComplete: () => {
        onCompleteRef.current();
      },
    });
    timelineRef.current = tl;

    // 1. Serene Sandalwood background appears smoothly (0.0s - 0.5s)
    tl.to(containerRef.current, {
      opacity: 1,
      duration: 0.5,
      ease: 'power2.out',
    });

    // 2. Calm ivory card backing & top bar fade in softly (0.3s - 0.9s)
    tl.to(
      boxRef.current,
      {
        opacity: 0.92,
        scale: 1,
        duration: 0.6,
        ease: 'power2.out',
      },
      '-=0.2'
    );
    tl.to(
      topBarRef.current,
      {
        opacity: 0.85,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
      },
      '-=0.4'
    );

    // 3. Delicate box outline draws smoothly
    if (boxBorderRef.current) {
      tl.to(
        boxBorderRef.current,
        {
          strokeDashoffset: 0,
          duration: 0.6,
          ease: 'power1.inOut',
        },
        '-=0.2'
      );
    }

    // 4. "Hi" writes itself stroke by stroke at a steady pen speed, with a short lift between strokes
    strokeRefs.current.forEach((path, i) => {
      if (!path) return;
      tl.to(
        path,
        {
          strokeDashoffset: 0,
          duration: strokeLengths[i] / PEN_SPEED,
          ease: 'sine.inOut',
        },
        i === 0 ? '-=0.1' : '+=0.08'
      );
    });

    // 4e. The 'i' dot taps onto paper
    if (dotIRef.current) {
      tl.to(
        dotIRef.current,
        {
          scale: 1,
          opacity: 1,
          duration: 0.3,
          ease: 'back.out(2)',
        },
        '+=0.05'
      );
    }

    // 5. "STUDIO" exact wordmark & underline reveal with serene luxury presence
    if (studioRef.current) {
      tl.to(
        studioRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          ease: 'power2.out',
        },
        '+=0.1'
      );
    }

    // 6. Subtitle & studio location dissolve in
    tl.to(
      subtitleRef.current,
      {
        opacity: 0.9,
        y: 0,
        duration: 0.6,
        ease: 'power2.out',
      },
      '-=0.35'
    );

    // 7. Tranquil contemplative hold (no flash, no jarring boom)
    tl.to({}, { duration: 0.85 });

    // 8. Silk dissolution into the gallery site
    tl.to(containerRef.current, {
      opacity: 0,
      scale: 1.015,
      duration: 0.8,
      ease: 'power2.inOut',
    });

    return () => {
      tl.kill();
      timelineRef.current = null;
    };
  }, []);

  const handleSkip = () => {
    if (hasSkipped) return;
    setHasSkipped(true);
    timelineRef.current?.kill();
    gsap.to(containerRef.current, {
      opacity: 0,
      duration: 0.35,
      ease: 'power2.out',
      onComplete: () => onCompleteRef.current(),
    });
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none"
      style={{
        backgroundColor: '#D6C098', // Calm warm sandal hue
        backgroundImage: 'radial-gradient(circle at 50% 45%, #EADBCA 0%, #D6C098 70%, #C4AE84 100%)',
      }}
    >
      {/* Delicate artisanal paper texture vignette */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, transparent 55%, rgba(20, 18, 14, 0.28) 100%)`,
        }}
      />

      {/* Main Signature Branding Composition */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md sm:max-w-lg px-6">
        <svg
          viewBox="0 0 1254 1100"
          className="w-72 sm:w-96 md:w-[420px] max-w-full h-auto drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Calligraphic stroke mask that uncovers the EXACT logo monogram */}
            <mask id="hi-exact-mask">
              <rect width="1254" height="1254" fill="black" />
              {/* Box border stroke (thin, centered on the logo's own outline) */}
              <rect
                ref={boxBorderRef}
                x="318.5"
                y="272.5"
                width="603.5"
                height="546.5"
                fill="none"
                stroke="white"
                strokeWidth="10"
              />
              {/* Keep the border from uncovering letter pieces where strokes cross it; the pen reveals those spots */}
              {HI_STROKES.map((d, i) => (
                <path
                  key={`cut-${i}`}
                  d={d}
                  fill="none"
                  stroke="black"
                  strokeWidth={HI_BRUSH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {/* Pen strokes: H & 'i', H right stem, underline sweep */}
              {HI_STROKES.map((d, i) => (
                <path
                  key={i}
                  ref={(el) => {
                    strokeRefs.current[i] = el;
                  }}
                  d={d}
                  fill="none"
                  stroke="white"
                  strokeWidth={HI_BRUSH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {/* 'i' Dot */}
              <circle
                ref={dotIRef}
                cx="708"
                cy="400"
                r="32"
                fill="white"
              />
            </mask>
          </defs>

          {/* Top Ivory Bar */}
          <rect
            ref={topBarRef}
            x="318"
            y="226"
            width="180"
            height="18"
            rx="3"
            fill="#FAF4E7"
          />

          {/* Calm Ivory Insignia Canvas Plinth */}
          <rect
            ref={boxRef}
            x="318"
            y="272"
            width="605"
            height="549"
            rx="4"
            fill="#FAF4E7"
          />

          {/* The Exact "Hi" Monogram from Logo.jpeg uncovered by authentic calligraphic strokes */}
          <image
            href="/brand/hi-monogram-exact.png"
            x="0"
            y="0"
            width="1254"
            height="1254"
            mask="url(#hi-exact-mask)"
          />

          {/* Exact STUDIO wordmark and underline layer */}
          <g ref={studioRef}>
            <image
              href="/brand/studio-exact.png"
              x="0"
              y="0"
              width="1254"
              height="1254"
            />
          </g>
        </svg>

        {/* Refined Artisanal Line & Location */}
        <div
          ref={subtitleRef}
          className="mt-1 flex flex-col items-center gap-2 text-center"
        >
          <div className="w-12 h-[1.5px] bg-[#8F7449]" />
          <p className="font-sans text-[13px] sm:text-sm tracking-[0.04em] text-[#3D3529]">{subtitle}</p>
          <p className="font-serif italic text-xs sm:text-sm text-[#4E4435] mt-0.5">
            "{tagline}"
          </p>
        </div>
      </div>

      {/* Understated Minimalist Skip Action */}
      {/* <button
        onClick={handleSkip}
        className="absolute bottom-8 right-8 z-20 px-4 py-2 rounded-full border border-[#8F7449]/40 bg-[#E8DCC4]/60 hover:bg-[#E8DCC4] text-[#2C2419] font-mono text-[11px] uppercase tracking-widest transition-all duration-300"
      >
        Skip Intro →
      </button> */}
    </div>
  );
};
