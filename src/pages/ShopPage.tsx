import React, { useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useSiteData, useVisiblePhotos } from '@/context/SiteDataContext';
import { useReveal } from '@/hooks/useReveal';
import { formatINR } from '@/lib/api';
import { Product } from '@/types';
import { categoryLabel, isCustomFrameProduct, priceLabel, productHref, uniq, whatsappLink } from '@/shop/catalog';
import { HungPiece, pickWallPieces, productLine, useNearViewport, useWallStyle } from '@/shop/GalleryWall';

const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const img = product.images?.[0];
  const custom = isCustomFrameProduct(product);
  return (
    <Link to={productHref(product)} className="group block" data-reveal>
      <div className="aspect-[4/5] overflow-hidden rounded-[2px] bg-canvas-surface">
        {img && (
          <img
            src={img}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        )}
      </div>
      <h3 className="font-serif text-xl sm:text-2xl leading-snug mt-4 transition-colors group-hover:text-accent">{product.name}</h3>
      <p className="text-[13px] sm:text-sm text-ink-faint mt-1">{custom ? 'Upload your photo, choose size and frame' : productLine(product)}</p>
      <p className="text-[15px] mt-1.5 tabular-nums">{priceLabel(product)}</p>
    </Link>
  );
};

export const ShopPage: React.FC = () => {
  const { products, settings, status } = useSiteData();
  const photos = useVisiblePhotos();
  const wall = useWallStyle();
  const [params, setParams] = useSearchParams();
  const gridRef = useRef<HTMLElement>(null);
  const [stageRef, near] = useNearViewport<HTMLDivElement>('100px');
  const revealRef = useReveal<HTMLDivElement>([status, params.get('category')]);

  const sorted = useMemo(() => [...products].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [products]);
  const categories = useMemo(() => uniq(sorted.map((p) => p.category)), [sorted]);
  const requested = params.get('category') || 'all';
  const active = requested === 'all' || categories.includes(requested as Product['category']) ? requested : 'all';
  const shown = active === 'all' ? sorted : sorted.filter((p) => p.category === active);
  const [hero] = useMemo(() => pickWallPieces(products, 1, isCustomFrameProduct), [products]);

  const profile = settings.studio_profile;
  const rules = settings.shipping_rules;

  const choose = (cat: string, scroll = false) => {
    const next = new URLSearchParams(params);
    if (cat === 'all') next.delete('category');
    else next.set('category', cat);
    setParams(next, { replace: true, preventScrollReset: true });
    if (scroll) gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const count = (cat: string) => sorted.filter((p) => p.category === cat).length;

  return (
    <div className="min-h-screen bg-canvas text-ink-light">
      <Navigation />

      <main>
        {/* Storefront opening: the gallery wall */}
        <section className="surface-invert relative overflow-hidden" style={wall} aria-labelledby="shop-title">
          <div className="container-site pt-24 sm:pt-32 pb-12 lg:pb-20 grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_auto] gap-x-10 items-center">
            <div className="lg:col-span-5 lg:row-start-1 lg:self-end lg:pt-10">
              <h1 id="shop-title" className="font-serif text-[40px] sm:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.01em]">
                Frames, prints and albums from our workshop.
              </h1>
              <p className="text-[15px] sm:text-base leading-relaxed text-ink-faint mt-4 sm:mt-5 max-w-[48ch]">
                Everything is made to order{profile.city ? ` in ${profile.city}` : ''}. Choose a piece below, or upload a
                photo of your own and we’ll print and frame it.
              </p>
            </div>

            {/* On phones the piece sits between the headline and the links. */}
            <div ref={stageRef} className="mt-4 lg:mt-0 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:row-span-2 -mx-5 sm:mx-0">
              {hero ? (
                <HungPiece
                  product={hero}
                  photos={photos}
                  live={near}
                  stageClass="max-h-[440px] sm:max-h-[560px] lg:max-h-[620px]"
                  className=""
                />
              ) : (
                <div className="h-[300px] lg:h-[600px]" aria-hidden="true" />
              )}
            </div>

            <div className="mt-8 lg:mt-8 lg:col-span-5 lg:row-start-2 lg:self-start lg:pb-10">
              {categories.length > 1 && (
                <nav aria-label="Shop categories">
                  <ul className="flex flex-wrap gap-x-6 gap-y-1">
                    {categories.map((c) => (
                      <li key={c}>
                        <button type="button" onClick={() => choose(c, true)} className="link-line min-h-[44px]">
                          {categoryLabel(c)} <span className="text-ink-faint tabular-nums font-normal">{count(c)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/shop/custom-frame" className="btn-primary">
                  Frame your own photo
                </Link>
              </div>
              {rules.freeShippingThresholdPaise > 0 && (
                <p className="text-[13px] text-ink-faint mt-5">
                  Free delivery on orders over {formatINR(rules.freeShippingThresholdPaise)}
                  {rules.estimatedDeliveryDays ? ` · ${rules.estimatedDeliveryDays}` : ''}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* All products */}
        <section ref={gridRef} id="products" className="container-site py-16 sm:py-20 lg:py-24 scroll-mt-20" aria-labelledby="products-title">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-hairline pb-4">
            <h2 id="products-title" className="font-serif text-3xl sm:text-4xl">
              {active === 'all' ? 'Everything' : categoryLabel(active)}
            </h2>
            {categories.length > 1 && (
              <div className="flex gap-x-5 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Filter by category">
                {['all', ...categories].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => choose(c)}
                    aria-pressed={active === c}
                    className={`relative h-11 whitespace-nowrap text-[15px] transition-colors ${
                      active === c ? 'text-ink-light' : 'text-ink-faint hover:text-ink-light'
                    }`}
                  >
                    {c === 'all' ? 'All' : categoryLabel(c)}
                    {active === c && <span className="absolute left-0 right-0 bottom-1 h-px bg-accent" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={revealRef}>
            {status === 'loading' && !products.length ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-8 gap-y-12 mt-10" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <div className="aspect-[4/5] bg-canvas-surface rounded-[2px] animate-pulse" />
                    <div className="h-5 w-2/3 bg-canvas-surface mt-4 rounded-sm" />
                  </div>
                ))}
              </div>
            ) : shown.length ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-8 gap-y-12 sm:gap-y-16 mt-10">
                {shown.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <div className="py-16 max-w-xl">
                <p className="font-serif text-2xl">
                  {status === 'offline' ? 'The shop couldn’t be loaded just now.' : 'Nothing here at the moment.'}
                </p>
                <p className="text-[15px] text-ink-faint mt-2 leading-relaxed">
                  {status === 'offline'
                    ? 'Please refresh the page in a moment.'
                    : 'New pieces are added from time to time.'}{' '}
                  {whatsappLink(profile.whatsapp) && (
                    <>
                      You can also{' '}
                      <a href={whatsappLink(profile.whatsapp)} target="_blank" rel="noopener noreferrer" className="link-line">
                        ask us on WhatsApp
                      </a>
                      .
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ShopPage;
