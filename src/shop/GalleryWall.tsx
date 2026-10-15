import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Frame3D } from '@/components/ui/Frame3D';
import { useTheme } from '@/context/ThemeContext';
import { PhotoItem, Product } from '@/types';
import { activeVariants, isBookCategory, priceLabel, printAspect, productHref } from './catalog';
import { finishSwatch } from './ui';

// Faint plaster grain, drawn as an SVG; `alpha` sets its strength.
const plaster = (alpha: number) =>
  `url("data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.35 0 0 0 0 0.3 0 0 0 ${alpha} 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const PLASTER_LIGHT = plaster(0.5);
const PLASTER_DARK = plaster(0.12);

/**
 * Background for the shop's "gallery wall": the paper-coloured inverted surface lit from above,
 * with a little plaster grain. Use together with the `surface-invert` class.
 */
export const useWallStyle = (): React.CSSProperties => {
  const { theme } = useTheme();
  const light = theme === 'light' ? 'rgba(255,236,205,0.10)' : 'rgba(255,250,240,0.55)';
  const shade = theme === 'light' ? 'rgba(0,0,0,0.35)' : 'rgba(60,45,25,0.10)';
  return {
    backgroundImage: `radial-gradient(80% 60% at 50% 0%, ${light}, transparent 70%), linear-gradient(to bottom, transparent 55%, ${shade}), ${theme === 'light' ? PLASTER_DARK : PLASTER_LIGHT}`,
    backgroundSize: 'auto, auto, 240px 240px',
  };
};

/** "drag to tilt" on touch screens, "move your pointer to tilt" elsewhere. */
export const useTiltHint = () => (useMediaQuery('(hover: none), (pointer: coarse)') ? 'drag to tilt' : 'move your pointer to tilt');

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** True while the element is within `margin` of the viewport (for mounting 3D work only when needed). */
export function useNearViewport<T extends HTMLElement>(margin = '300px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, near] as const;
}

export const isProductShot = (url: string) => /\/products\//.test(url);

/**
 * The picture to show inside a framed preview. Product images that are photos of the product itself
 * (uploaded under /products/) would show a frame inside a frame, so a portfolio photo is used instead.
 */
export const printImageFor = (product: Product, photos: PhotoItem[], index = 0) => {
  const own = (product.images || []).find((u) => u && !isProductShot(u));
  if (own) {
    const photo = photos.find((p) => p.url === own);
    return { url: own, width: photo?.width, height: photo?.height };
  }
  const pool = photos.filter((p) => p.featured).length ? photos.filter((p) => p.featured) : photos;
  const photo = pool[index % Math.max(1, pool.length)];
  if (photo) return { url: photo.url, width: photo.width, height: photo.height };
  return { url: product.images?.[0] || '', width: undefined, height: undefined };
};

export const MuseumLabel: React.FC<{ product: Product; line?: string; className?: string }> = ({ product, line, className = '' }) => (
  <Link
    to={productHref(product)}
    className={`group block bg-canvas-elevated px-4 py-3 rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.12),0_4px_14px_-6px_rgba(0,0,0,0.25)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.12),0_10px_22px_-8px_rgba(0,0,0,0.35)] transition-shadow ${className}`}
  >
    <span className="flex items-start justify-between gap-3">
      <span className="font-serif text-lg leading-snug text-ink-light">{product.name}</span>
      <ArrowRight size={16} className="mt-1 flex-shrink-0 text-accent transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </span>
    {line && <span className="block text-[13px] text-ink-faint mt-0.5 leading-snug">{line}</span>}
    <span className="block text-[14px] text-ink-light mt-1.5 tabular-nums">{priceLabel(product)}</span>
  </Link>
);

/** A plain one-line description of what the product is, made from its options. */
export const productLine = (p: Product) => {
  const vs = activeVariants(p);
  const finishes = Array.from(new Set(vs.map((v) => v.finish)));
  const sizes = Array.from(new Set(vs.map((v) => v.size)));
  const parts: string[] = [];
  if (finishes.length) parts.push(finishes.length > 2 ? `${finishes.length} finishes` : finishes.join(' or '));
  if (sizes.length) parts.push(sizes.length === 1 ? sizes[0] : `${sizes.length} sizes`);
  return parts.join(' · ');
};

interface HungPieceProps {
  product: Product;
  photos: PhotoItem[];
  index?: number;
  /** Mount the 3D frame (false keeps an empty stage of the same size). */
  live: boolean;
  /** Extra classes for the stage, e.g. a max height ("max-h-[620px]"). Book stages also take an aspect class. */
  stageClass?: string;
  showLabel?: boolean;
  className?: string;
}

/** Outer width/height of a Frame3D object (same maths as Frame3D: moulding 6%, mat 8.5% of the width). */
export const frameOuterRatio = (aspect: number, finish = '', mat = true) => {
  const canvas = /canvas|gallery wrap/i.test(finish);
  const t = canvas ? 0 : 0.06;
  const m = mat && !canvas ? 0.085 : 0;
  return (1 + 2 * (t + m)) / (1 / aspect + 2 * (t + m));
};

/** One piece on the wall: a 3D frame for frames/canvas/prints, a tilted album or diary for books. */
export const HungPiece: React.FC<HungPieceProps> = ({
  product,
  photos,
  index = 0,
  live,
  stageClass = '',
  showLabel = true,
  className = '',
}) => {
  const variant = activeVariants(product)[0];
  const book = isBookCategory(product.category);
  const print = printImageFor(product, photos, index);
  const aspect =
    (variant && printAspect(variant.size, print.width, print.height)) || (print.width && print.height ? print.width / print.height : 2 / 3);
  const mat = product.category !== 'canvas';
  // Stage shaped like the frame (plus room to tilt), so the label sits just under it.
  const stageRatio = frameOuterRatio(aspect, variant?.finish, mat) * 0.98;
  const cover = product.images?.[0] || print.url;

  return (
    <figure className={className}>
      {book ? (
        <Link to={productHref(product)} className={`group block aspect-[4/5] ${stageClass} [perspective:1200px]`} aria-label={product.name}>
          <BookObject imageUrl={cover} asBook={!isProductShot(cover)} />
        </Link>
      ) : (
        <div className={`relative w-full mx-auto ${stageClass}`} style={{ aspectRatio: String(stageRatio) }}>
          {live && print.url ? (
            <Frame3D
              imageUrl={print.url}
              finish={variant?.finish}
              mat={mat}
              aspect={aspect}
              alt={`${product.name}, ${variant?.finish ?? ''}`}
              className="w-full h-full"
            />
          ) : null}
        </div>
      )}
      {showLabel && (
        <figcaption className="mt-3 max-w-[300px] mx-auto">
          <MuseumLabel product={product} line={productLine(product)} />
        </figcaption>
      )}
    </figure>
  );
};

/** A still, flat framed print (no 3D), for small pieces such as the mobile rail. */
export const FlatFrame: React.FC<{ imageUrl: string; finish?: string; mat?: boolean; aspect?: number; className?: string }> = ({
  imageUrl,
  finish = '',
  mat = true,
  aspect = 4 / 5,
  className = '',
}) => {
  const canvas = /canvas|gallery wrap/i.test(finish);
  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <div
        className="relative max-h-full shadow-[0_2px_3px_rgba(0,0,0,0.2),0_18px_30px_-12px_rgba(0,0,0,0.45)]"
        style={{
          aspectRatio: String(aspect),
          width: aspect >= 1 ? '86%' : undefined,
          height: aspect < 1 ? '88%' : undefined,
          padding: canvas ? 0 : '6%',
          background: canvas ? '#111' : finishSwatch(finish) || '#8a5a2e',
        }}
      >
        <div className="w-full h-full overflow-hidden" style={{ padding: !canvas && mat ? '9%' : 0, background: '#F2EDE2', boxShadow: canvas ? 'none' : 'inset 0 1px 3px rgba(0,0,0,0.35)' }}>
          <img src={imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
};

/**
 * Album / diary. A portfolio photo becomes the cover of a closed book, turned slightly; a product
 * photo (a picture of the real album) is shown as a tilted print instead. Both lift on hover.
 */
export const BookObject: React.FC<{ imageUrl: string; asBook?: boolean }> = ({ imageUrl, asBook = true }) => (
  <div className="w-full h-full flex items-center justify-center">
    <div
      className={`relative ${asBook ? 'w-[72%] aspect-[4/5]' : 'w-[84%] aspect-[4/5]'} transition-transform duration-500 ease-out [transform-style:preserve-3d] [transform:rotateY(-14deg)_rotateX(4deg)] group-hover:[transform:rotateY(-6deg)_rotateX(2deg)_translateZ(24px)] motion-reduce:transition-none motion-reduce:group-hover:[transform:rotateY(-14deg)_rotateX(4deg)]`}
    >
      {asBook && (
        <div
          className="absolute inset-y-[1.5%] left-full w-[6%] bg-[#efe9dc] [transform:rotateY(90deg)] origin-left"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 3px)' }}
        />
      )}
      <div
        className={`absolute inset-0 overflow-hidden ${asBook ? 'rounded-r-[3px]' : 'rounded-[2px]'} shadow-[0_2px_4px_rgba(0,0,0,0.25),18px_24px_40px_-12px_rgba(0,0,0,0.5)] group-hover:shadow-[0_2px_4px_rgba(0,0,0,0.25),26px_34px_50px_-14px_rgba(0,0,0,0.5)] transition-shadow duration-500`}
      >
        <img src={imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        {asBook && (
          <>
            <div className="absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/45 to-transparent" />
            <div className="absolute inset-y-0 left-[7%] w-px bg-white/20" />
          </>
        )}
      </div>
    </div>
  </div>
);

/**
 * Pieces to hang: featured products first (by sort order), then the rest; never the custom-frame
 * service (it has its own call to action). The first wall product (frame/canvas/print) is put first.
 */
export const pickWallPieces = (products: Product[], count: number, isCustom: (p: Product) => boolean) => {
  const usable = products.filter((p) => !isCustom(p) && activeVariants(p).length > 0);
  const sorted = [...usable].sort(
    (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const picked = sorted.slice(0, count);
  const hero = picked.findIndex((p) => !isBookCategory(p.category));
  if (hero > 0) picked.unshift(...picked.splice(hero, 1));
  return picked;
};
