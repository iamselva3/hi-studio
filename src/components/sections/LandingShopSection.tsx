import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSiteData, useVisiblePhotos } from '@/context/SiteDataContext';
import { useReveal } from '@/hooks/useReveal';
import { formatINR } from '@/lib/api';
import { Product } from '@/types';
import { activeVariants, categoryLabel, isBookCategory, isCustomFrameProduct, productHref, uniq } from '@/shop/catalog';
import {
  BookObject,
  FlatFrame,
  HungPiece,
  MuseumLabel,
  isProductShot,
  pickWallPieces,
  printImageFor,
  productLine,
  useMediaQuery,
  useNearViewport,
  useWallStyle,
} from '@/shop/GalleryWall';

/** "Frames, canvas, albums and diaries" from the categories actually on sale. */
const categoryList = (products: Product[]) => {
  const names = uniq(products.filter((p) => !isCustomFrameProduct(p)).map((p) => categoryLabel(p.category).toLowerCase()));
  if (!names.length) return '';
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return list.charAt(0).toUpperCase() + list.slice(1);
};

/**
 * Homepage shop section: a lit gallery wall with three pieces hung on it (3D frames are mounted only
 * near the viewport), plain labels, and the two ways into the shop. Reads everything from context.
 */
// Props are accepted (and ignored) only so older callers still compile.
export const LandingShopSection: React.FC<Record<string, unknown>> = () => {
  const { products, settings, status } = useSiteData();
  const photos = useVisiblePhotos();
  const wall = useWallStyle();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [stageRef, near] = useNearViewport<HTMLDivElement>('250px');
  const revealRef = useReveal<HTMLDivElement>([status]);

  const pieces = useMemo(() => pickWallPieces(products, 3, isCustomFrameProduct), [products]);
  const [hero, ...rest] = pieces;
  const rules = settings.shipping_rules;
  const city = settings.studio_profile.city;
  const cats = categoryList(products);

  const facts = [
    rules.freeShippingThresholdPaise > 0 ? `Free delivery on orders over ${formatINR(rules.freeShippingThresholdPaise)}` : '',
    rules.estimatedDeliveryDays ? rules.estimatedDeliveryDays.charAt(0).toUpperCase() + rules.estimatedDeliveryDays.slice(1) : '',
  ].filter(Boolean);

  const actions = (
    <div className="flex flex-col sm:flex-row gap-3">
      <Link to="/shop" className="btn-primary">
        Visit the shop
      </Link>
      <Link to="/shop/custom-frame" className="btn-quiet">
        Frame your own photo
      </Link>
    </div>
  );

  return (
    <section id="shop-landing" aria-labelledby="shop-landing-title" className="surface-invert relative overflow-hidden" style={wall}>
      <div ref={revealRef} className="container-site pt-20 pb-20 sm:pt-28 sm:pb-24 lg:pt-32 lg:pb-28">
        <div className="lg:flex lg:items-end lg:justify-between lg:gap-12" data-reveal>
          <div className="max-w-[720px]">
            <h2 id="shop-landing-title" className="font-serif text-[40px] leading-[1.04] sm:text-5xl lg:text-[64px] tracking-[-0.01em]">
              Your photographs, framed and bound in our workshop.
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-ink-faint mt-5 max-w-[56ch]">
              {cats ? `${cats}, made to order${city ? ` in ${city}` : ''}.` : `Made to order${city ? ` in ${city}` : ''}.`} Pick a
              piece from the shop, or send us a photo of your own to frame.
            </p>
          </div>
          <div className="hidden lg:block flex-shrink-0">{actions}</div>
        </div>

        {/* The wall */}
        <div ref={stageRef} className="mt-6 sm:mt-12 lg:mt-20">
          {pieces.length === 0 ? (
            status === 'loading' ? <div className="h-[420px] lg:h-[560px]" aria-hidden="true" /> : null
          ) : desktop ? (
            <div className="grid grid-cols-12 gap-8 items-start">
              {rest[0] && (
                <WallSlot product={rest[0]} photos={photos} index={1} live={near} className="col-span-3 mt-28" stageClass="" />
              )}
              <WallSlot
                product={hero}
                photos={photos}
                index={0}
                live={near}
                className={`col-span-6 ${rest[0] ? '' : 'col-start-4'}`}
                stageClass="max-h-[560px]"
              />
              {rest[1] && (
                <WallSlot product={rest[1]} photos={photos} index={2} live={near} className="col-span-3 mt-12" stageClass="" />
              )}
            </div>
          ) : (
            <>
              <WallSlot
                product={hero}
                photos={photos}
                index={0}
                live={near}
                stageClass="max-h-[68vh]"
                className="-mx-5 sm:-mx-8"
              />
              {rest.length > 0 && (
                <div className="mt-10 -mx-5 sm:-mx-8">
                  <ul
                    className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-5 sm:scroll-px-8 px-5 sm:px-8 pb-4 no-scrollbar"
                    aria-label="More from the shop"
                  >
                    {rest.map((p, i) => (
                      <li key={p.id} className="snap-start shrink-0 w-[72%] sm:w-[44%]">
                        <RailCard product={p} photos={photos} index={i + 1} />
                      </li>
                    ))}
                    <li className="snap-start shrink-0 w-[72%] sm:w-[44%]">
                      <Link
                        to="/shop/custom-frame"
                        className="h-full min-h-[280px] flex flex-col justify-end rounded-[2px] border border-hairline-strong p-5 hover:border-accent transition-colors"
                      >
                        <span className="font-serif text-2xl leading-snug">Have a photo of your own?</span>
                        <span className="text-[14px] text-ink-faint mt-2">Upload it, choose a size and frame, and see it framed before you order.</span>
                        <span className="link-line mt-4 self-start">Frame your own photo</span>
                      </Link>
                    </li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-10 lg:mt-16 lg:flex lg:items-center lg:justify-between gap-8">
          <div className="lg:hidden">{actions}</div>
          {facts.length > 0 && (
            <p className="mt-6 lg:mt-0 text-[13px] sm:text-sm text-ink-faint">{facts.join(' · ')}</p>
          )}
          <Link to="/shop" className="hidden lg:inline-flex link-line">
            See everything in the shop
          </Link>
        </div>
      </div>
    </section>
  );
};

const WallSlot: React.FC<{
  product: Product;
  photos: ReturnType<typeof useVisiblePhotos>;
  index: number;
  live: boolean;
  className?: string;
  stageClass: string;
}> = ({ product, photos, index, live, className = '', stageClass }) => (
  <HungPiece product={product} photos={photos} index={index} live={live} stageClass={stageClass} className={className} />
);

/** Small still piece for the mobile rail. */
const RailCard: React.FC<{ product: Product; photos: ReturnType<typeof useVisiblePhotos>; index: number }> = ({
  product,
  photos,
  index,
}) => {
  const variant = activeVariants(product)[0];
  const print = printImageFor(product, photos, index);
  return (
    <div>
      <Link to={productHref(product)} className="group block aspect-[4/5] [perspective:1000px]" aria-label={product.name} tabIndex={-1}>
        {isBookCategory(product.category) ? (
          <BookObject imageUrl={product.images?.[0] || print.url} asBook={!isProductShot(product.images?.[0] || print.url)} />
        ) : (
          <FlatFrame
            imageUrl={print.url}
            finish={variant?.finish}
            mat={product.category !== 'canvas'}
            aspect={print.width && print.height && print.width > print.height ? 5 / 4 : 4 / 5}
          />
        )}
      </Link>
      <MuseumLabel product={product} line={productLine(product)} className="mt-4" />
    </div>
  );
};

export default LandingShopSection;
