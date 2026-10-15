import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Frame3DProps {
  imageUrl: string;
  // Free-text finish name from the product variant; matched by keyword (teak, walnut, black, white, oak, gold, canvas…).
  finish?: string;
  mat?: boolean;
  // Print width / height.
  aspect?: number;
  alt?: string;
  className?: string;
}

interface Wood {
  base: string;
  light: string;
  dark: string;
  grain: string;
}

const WOODS: { match: RegExp; wood: Wood }[] = [
  { match: /walnut|smoked|espresso/i, wood: { base: '#4b3123', light: '#6b4632', dark: '#2c1c13', grain: 'rgba(0,0,0,0.18)' } },
  { match: /black|ebony|charcoal/i, wood: { base: '#1d1b19', light: '#34312d', dark: '#0d0c0b', grain: 'rgba(255,255,255,0.03)' } },
  { match: /white|ivory|chalk/i, wood: { base: '#e9e4d9', light: '#f7f4ee', dark: '#c9c2b4', grain: 'rgba(0,0,0,0.04)' } },
  { match: /oak|natural ash|maple/i, wood: { base: '#b38b5d', light: '#cfa877', dark: '#7f603d', grain: 'rgba(60,35,10,0.16)' } },
  { match: /gold|brass|gilt/i, wood: { base: '#b08d47', light: '#d9b867', dark: '#7a5f2a', grain: 'rgba(255,240,200,0.10)' } },
  { match: /teak|burma|natural/i, wood: { base: '#8a5a2e', light: '#a87443', dark: '#5c3a1c', grain: 'rgba(40,20,5,0.20)' } },
];

const woodFor = (finish = '') => WOODS.find((w) => w.match.test(finish))?.wood ?? WOODS[WOODS.length - 1].wood;

const grain = (w: Wood, angle: number) =>
  `repeating-linear-gradient(${angle}deg, ${w.grain} 0 1px, transparent 1px 7px), ` +
  `repeating-linear-gradient(${angle}deg, transparent 0 13px, ${w.grain} 13px 14px, transparent 14px 31px)`;

/**
 * A framed print rendered in CSS 3D: mitred moulding, side depth, mat and glass glare.
 * Tilts toward the pointer (or with a drag on touch screens) and sways gently when idle.
 */
export const Frame3D: React.FC<Frame3DProps> = ({
  imageUrl,
  finish,
  mat = true,
  aspect = 2 / 3,
  alt = 'Framed print preview',
  className = '',
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const isCanvas = /canvas|gallery wrap/i.test(finish || '');
  const wood = woodFor(finish);

  // Size the frame to the stage while keeping the print's aspect ratio.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const sw = stage.clientWidth;
      const sh = stage.clientHeight || sw * 1.2;
      const t = isCanvas ? 0 : 0.06;
      const m = mat && !isCanvas ? 0.085 : 0;
      const ratio = (1 + 2 * (t + m)) / (1 / aspect + 2 * (t + m));
      let w = sw * 0.78;
      let h = w / ratio;
      if (h > sh * 0.82) {
        h = sh * 0.82;
        w = h * ratio;
      }
      setBox({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [aspect, mat, isCanvas]);

  // Pointer-driven tilt with easing; idle sway when the pointer is away.
  useEffect(() => {
    const stage = stageRef.current;
    const obj = objectRef.current;
    if (!stage || !obj) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let target = { x: -6, y: 14 };
    let current = { ...target };
    let active = false;
    let dragging = false;
    let raf = 0;
    const started = performance.now();

    const apply = () => {
      obj.style.transform = `rotateX(${current.x}deg) rotateY(${current.y}deg)`;
      if (glareRef.current) glareRef.current.style.backgroundPosition = `${50 - current.y * 2.2}% 0`;
      if (shadowRef.current) shadowRef.current.style.transform = `translate(${-current.y * 1.2}px, ${18 + current.x * 0.8}px)`;
    };

    const tick = (now: number) => {
      if (!active && !dragging) {
        const t = (now - started) / 1000;
        target = { x: -4 + Math.sin(t * 0.6) * 3, y: 12 + Math.sin(t * 0.45) * 10 };
      }
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      apply();
      raf = requestAnimationFrame(tick);
    };

    const fromEvent = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      target = { x: -py * 24, y: px * 40 };
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || dragging) {
        active = true;
        fromEvent(e);
      }
    };
    const onLeave = () => {
      active = false;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        dragging = true;
        fromEvent(e);
      }
    };
    const onUp = () => {
      dragging = false;
      active = false;
    };

    if (reduced) {
      apply();
      return;
    }
    raf = requestAnimationFrame(tick);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    stage.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const T = isCanvas ? 0 : box.w * 0.06; // moulding width
  const D = Math.max(10, box.w * (isCanvas ? 0.05 : 0.07)); // depth
  const sideBg = isCanvas
    ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${imageUrl}) center / cover`
    : `${grain(wood, 0)}, ${wood.dark}`;

  const piece = (clip: string, shade: string, angle: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    clipPath: clip,
    background: `${shade}, ${grain(wood, angle)}, ${wood.base}`,
  });

  return (
    <div
      ref={stageRef}
      className={`relative flex items-center justify-center select-none touch-pan-y ${className}`}
      style={{ perspective: '1400px' }}
      role="img"
      aria-label={alt}
    >
      {box.w > 0 && (
        <>
          <div
            ref={shadowRef}
            className="absolute rounded-[2px] pointer-events-none"
            style={{
              width: box.w * 0.94,
              height: box.h * 0.94,
              background: 'rgba(0,0,0,0.55)',
              filter: `blur(${Math.round(box.w * 0.05)}px)`,
              opacity: 0.55,
            }}
          />
          <div
            ref={objectRef}
            className="relative"
            style={{ width: box.w, height: box.h, transformStyle: 'preserve-3d', willChange: 'transform' }}
          >
            {/* Sides, extending back from the face */}
            <div className="absolute left-0 top-0 w-full" style={{ height: D, transformOrigin: 'top', transform: 'rotateX(-90deg)', background: sideBg, filter: 'brightness(1.15)' }} />
            <div className="absolute left-0 bottom-0 w-full" style={{ height: D, transformOrigin: 'bottom', transform: 'rotateX(90deg)', background: sideBg, filter: 'brightness(0.7)' }} />
            <div className="absolute left-0 top-0 h-full" style={{ width: D, transformOrigin: 'left', transform: 'rotateY(90deg)', background: sideBg, filter: 'brightness(0.9)' }} />
            <div className="absolute right-0 top-0 h-full" style={{ width: D, transformOrigin: 'right', transform: 'rotateY(-90deg)', background: sideBg, filter: 'brightness(0.8)' }} />
            <div className="absolute inset-0" style={{ transform: `translateZ(${-D}px)`, background: '#1a1714' }} />

            {/* Face */}
            <div className="absolute inset-0" style={{ transform: 'translateZ(0.5px)' }}>
              {!isCanvas && (
                <>
                  <div style={piece(`polygon(0 0, 100% 0, calc(100% - ${T}px) ${T}px, ${T}px ${T}px)`, `linear-gradient(180deg, ${wood.light}cc, ${wood.base}00)`, 90)} />
                  <div style={piece(`polygon(0 0, ${T}px ${T}px, ${T}px calc(100% - ${T}px), 0 100%)`, `linear-gradient(90deg, ${wood.light}99, ${wood.base}00)`, 0)} />
                  <div style={piece(`polygon(100% 0, 100% 100%, calc(100% - ${T}px) calc(100% - ${T}px), calc(100% - ${T}px) ${T}px)`, `linear-gradient(270deg, ${wood.dark}aa, ${wood.base}00)`, 0)} />
                  <div style={piece(`polygon(${T}px calc(100% - ${T}px), calc(100% - ${T}px) calc(100% - ${T}px), 100% 100%, 0 100%)`, `linear-gradient(0deg, ${wood.dark}cc, ${wood.base}00)`, 90)} />
                </>
              )}

              {/* Mat + print, set slightly into the frame */}
              <div
                className="absolute overflow-hidden"
                style={{
                  inset: T,
                  background: mat && !isCanvas ? '#F2EDE2' : '#111',
                  boxShadow: isCanvas ? 'none' : 'inset 0 2px 6px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.25)',
                  padding: mat && !isCanvas ? box.w * 0.085 : 0,
                }}
              >
                <div
                  className="relative w-full h-full overflow-hidden"
                  style={{ boxShadow: mat && !isCanvas ? 'inset 0 1px 3px rgba(0,0,0,0.35)' : 'none' }}
                >
                  <img src={imageUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
                </div>
              </div>

              {/* Glass glare */}
              {!isCanvas && (
                <div
                  ref={glareRef}
                  className="absolute pointer-events-none mix-blend-screen"
                  style={{
                    inset: T,
                    backgroundImage:
                      'linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.16) 47%, rgba(255,255,255,0.04) 53%, rgba(255,255,255,0) 62%)',
                    backgroundSize: '250% 100%',
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
