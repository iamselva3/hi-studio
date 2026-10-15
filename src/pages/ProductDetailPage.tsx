import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { Frame3D } from '@/components/ui/Frame3D';
import { useCart } from '@/context/CartContext';
import { useSiteData, useVisiblePhotos } from '@/context/SiteDataContext';
import { formatINR } from '@/lib/api';
import { Product, ProductVariant } from '@/types';
import {
  MIN_PRINT_DPI,
  activeVariants,
  categoryLabel,
  deliveryNote,
  gstNote,
  isBookCategory,
  isCustomFrameProduct,
  isWallCategory,
  printAspect,
  printDpi,
  sizeShort,
  uniq,
  whatsappLink,
} from '@/shop/catalog';
import { ChoiceGroup, QtyStepper, finishSwatch } from '@/shop/ui';
import { printImageFor, useTiltHint, useWallStyle } from '@/shop/GalleryWall';
import { PhotoUploader } from '@/shop/PhotoUploader';
import { usePhotoUploads } from '@/shop/usePhotoUploads';
import { RoomMockupModal } from '@/shop/RoomMockupModal';

const inStock = (v?: ProductVariant) => !!v && v.stock > 0;

const PageFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-canvas text-ink-light">
    <Navigation />
    <main className="container-site pt-24 sm:pt-28 pb-20 sm:pb-28">{children}</main>
    <Footer />
  </div>
);

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { products, status } = useSiteData();
  const product = products.find((p) => p.slug === slug);

  if (product && isCustomFrameProduct(product)) return <Navigate to="/shop/custom-frame" replace />;

  if (!product) {
    return (
      <PageFrame>
        {status === 'loading' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10" aria-busy="true" aria-label="Loading">
            <div className="lg:col-span-7 aspect-[4/5] bg-canvas-surface rounded-[2px] animate-pulse" />
            <div className="lg:col-span-5 space-y-4">
              <div className="h-10 w-3/4 bg-canvas-surface rounded-sm" />
              <div className="h-6 w-1/3 bg-canvas-surface rounded-sm" />
            </div>
          </div>
        ) : (
          <div className="py-16 max-w-xl">
            <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05]">
              {status === 'offline' ? 'The shop couldn’t be loaded.' : 'We couldn’t find that piece.'}
            </h1>
            <p className="text-[15px] sm:text-base text-ink-faint mt-4 leading-relaxed">
              {status === 'offline'
                ? 'Please check your connection and refresh the page.'
                : 'It may have been renamed or is no longer available.'}
            </p>
            <Link to="/shop" className="btn-primary mt-8">
              Back to the shop
            </Link>
          </div>
        )}
      </PageFrame>
    );
  }

  // Re-mount per product so selections and uploads start fresh.
  return <ProductView key={product.id} product={product} />;
};

const ProductView: React.FC<{ product: Product }> = ({ product }) => {
  const { settings } = useSiteData();
  const photos = useVisiblePhotos();
  const cart = useCart();
  const wall = useWallStyle();
  const tiltHint = useTiltHint();
  const variants = useMemo(() => activeVariants(product), [product]);
  const sizes = useMemo(() => uniq(variants.map((v) => v.size)), [variants]);
  const finishes = useMemo(() => uniq(variants.map((v) => v.finish)), [variants]);
  const wallPiece = isWallCategory(product.category);
  const book = isBookCategory(product.category);
  const shop = settings.shop_config;
  const minPhotos = book
    ? Math.max(1, Number(product.category === 'albums' ? shop.weddingMonographMinPhotos ?? 10 : shop.weddingDiaryMinPhotos ?? 5) || 1)
    : 0;
  // Below the server's upload limit (300 per hour per connection) and its 200 photos per order.
  const maxPhotos = book ? Math.max(150, minPhotos) : 1;

  const first = variants.find(inStock) || variants[0];
  const [size, setSize] = useState(first?.size ?? '');
  const [finish, setFinish] = useState(first?.finish ?? '');
  const [qty, setQty] = useState(1);
  const [view, setView] = useState(0);
  const [roomOpen, setRoomOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [hint, setHint] = useState('');
  const uploaderRef = useRef<HTMLButtonElement>(null);
  const uploads = usePhotoUploads({ max: maxPhotos, withPreview: wallPiece });

  // Catalogue edits while the page is open: keep the selection valid.
  useEffect(() => {
    if (!variants.some((v) => v.size === size && v.finish === finish) && first) {
      setSize(first.size);
      setFinish(first.finish);
    }
  }, [variants, size, finish, first]);

  const variant = variants.find((v) => v.size === size && v.finish === finish);
  const maxQty = Math.max(1, Math.min(10, variant?.stock ?? 10));
  useEffect(() => setQty((q) => Math.min(q, maxQty)), [maxQty]);

  const chooseSize = (s: string) => {
    setSize(s);
    if (!inStock(variants.find((v) => v.size === s && v.finish === finish))) {
      const alt = variants.find((v) => v.size === s && inStock(v)) || variants.find((v) => v.size === s);
      if (alt) setFinish(alt.finish);
    }
  };

  // Customer photo (wall pieces) or the studio photo shown in the preview.
  const photo = wallPiece ? uploads.entries[0] : undefined;
  const sample = printImageFor(product, photos);
  const printUrl = photo?.previewUrl || photo?.thumbUrl || sample.url;
  const printW = photo?.width ?? sample.width;
  const printH = photo?.height ?? sample.height;
  const aspect = (variant && printAspect(variant.size, printW, printH)) || 2 / 3;
  const dpi = photo?.width && photo.height && variant ? printDpi(photo.width, photo.height, variant.size) : null;
  const bestSize =
    photo?.width && photo.height
      ? [...sizes].reverse().find((s) => (printDpi(photo.width as number, photo.height as number, s) ?? 0) >= MIN_PRINT_DPI)
      : undefined;

  const images = (product.images || []).filter(Boolean);
  const gallery = wallPiece ? ['__frame__', ...images] : images;
  const railRef = useRef<HTMLDivElement>(null);
  const goTo = (i: number) => {
    const rail = railRef.current;
    setView(i);
    if (!rail) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rail.scrollTo({ left: i * rail.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  };
  const onRailScroll = () => {
    const rail = railRef.current;
    if (!rail || !rail.clientWidth) return;
    const i = Math.round(rail.scrollLeft / rail.clientWidth);
    if (i !== view) setView(i);
  };

  const photosNeeded = book && uploads.doneCount < minPhotos;
  const blocked =
    !variant ||
    !inStock(variant) ||
    uploads.busy ||
    photosNeeded ||
    (wallPiece && uploads.entries.some((e) => e.status === 'error'));

  const blockReason = !variant
    ? 'Choose a size and finish.'
    : !inStock(variant)
      ? 'This option is out of stock.'
      : uploads.busy
        ? 'Please wait for your photos to finish uploading.'
        : photosNeeded
          ? `Add at least ${minPhotos} photos (${uploads.doneCount} of ${minPhotos} uploaded).`
          : uploads.failedCount
            ? 'Retry or remove the photos that didn’t upload.'
            : '';

  const addToBag = () => {
    if (blocked || !variant) {
      setHint(blockReason);
      if (photosNeeded) uploaderRef.current?.focus();
      return;
    }
    const done = uploads.done;
    cart.add({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      variantSize: variant.size,
      variantFinish: variant.finish,
      unitPricePaise: variant.price_paise,
      quantity: qty,
      image: images[0] || '',
      uploadKeys: done.length ? uploads.keys : undefined,
      previewUrl: done[0]?.thumbUrl,
    });
    uploads.reset();
    setHint('');
    setAdded(true);
    window.setTimeout(() => setAdded(false), 4000);
  };

  const lowStock = variant && variant.stock > 0 && variant.stock <= (settings.shop_config.lowStockThreshold || 3);
  const gst = gstNote(settings.gst_config);
  const wa = whatsappLink(settings.studio_profile.whatsapp);

  return (
    <PageFrame>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-faint mb-6 sm:mb-8">
        <Link to="/shop" className="hover:text-ink-light">
          Shop
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <Link to={`/shop?category=${product.category}`} className="hover:text-ink-light">
          {categoryLabel(product.category)}
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-8">
        {/* Gallery */}
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-24">
            {/* Swipeable on phones; thumbnails below jump between slides. */}
            <div
              ref={railRef}
              onScroll={onRailScroll}
              className="-mx-5 sm:mx-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar sm:rounded-[2px]"
              aria-roledescription="carousel"
              aria-label={`${product.name} images`}
            >
              {gallery.length === 0 && <div className="w-full shrink-0 h-[min(118vw,560px)] bg-canvas-surface" />}
              {gallery.map((g, i) =>
                g === '__frame__' ? (
                  <div
                    key="frame"
                    className="surface-invert relative w-full shrink-0 snap-center overflow-hidden h-[min(118vw,560px)] sm:h-[600px] lg:h-[min(76vh,720px)]"
                    style={wall}
                    aria-roledescription="slide"
                    aria-label={`${i + 1} of ${gallery.length}: framed preview`}
                  >
                    {view === 0 && (
                      <Frame3D
                        imageUrl={printUrl}
                        finish={variant?.finish}
                        mat={product.category !== 'canvas'}
                        aspect={aspect}
                        alt={`${product.name} in ${variant?.finish ?? 'the chosen finish'}, ${variant?.size ?? ''}`}
                        className="w-full h-full"
                      />
                    )}
                    <p className="absolute left-4 right-4 bottom-3 text-[12px] text-ink-faint pointer-events-none">
                      {photo ? 'Your photo' : 'Sample photo'} · {tiltHint}
                    </p>
                  </div>
                ) : (
                  <div
                    key={`${g}-${i}`}
                    className="relative w-full shrink-0 snap-center bg-canvas-surface h-[min(118vw,560px)] sm:h-[600px] lg:h-[min(76vh,720px)]"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} of ${gallery.length}`}
                  >
                    <img
                      src={g}
                      alt={i === 0 ? product.name : ''}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                )
              )}
            </div>

            {gallery.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Product images">
                {gallery.map((g, i) => (
                  <button
                    key={`${g}-${i}`}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-pressed={view === i}
                    aria-label={g === '__frame__' ? 'Framed preview' : `Image ${wallPiece ? i : i + 1}`}
                    className={`relative w-16 h-20 flex-shrink-0 rounded-[2px] overflow-hidden border transition-opacity ${
                      view === i ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    {g === '__frame__' ? (
                      <span
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: finishSwatch(variant?.finish || '') || '#8a5a2e' }}
                      >
                        <span className="absolute inset-[5px] bg-[#F2EDE2] p-[5px]">
                          <img src={printUrl} alt="" className="w-full h-full object-cover" />
                        </span>
                      </span>
                    ) : (
                      <img src={g} alt="" className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {wallPiece && variant && (
              <button type="button" onClick={() => setRoomOpen(true)} className="link-line mt-5 min-h-[44px]">
                See it on a wall, to scale
              </button>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-5">
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] tracking-[-0.01em]">{product.name}</h1>
          <p className="text-2xl mt-4 tabular-nums">{variant ? formatINR(variant.price_paise) : '—'}</p>
          <p className="text-[13px] text-ink-faint mt-1">
            {[gst, deliveryNote(settings.shipping_rules)].filter(Boolean).join(' ')}
          </p>

          {product.description && (
            <p className="text-[15px] sm:text-base leading-relaxed text-ink-faint mt-6 max-w-[60ch] whitespace-pre-line">
              {product.description}
            </p>
          )}

          <div className="mt-8 pt-8 border-t border-hairline space-y-7">
            {sizes.length > 1 && (
              <ChoiceGroup
                legend="Size"
                name="size"
                value={size}
                onChange={chooseSize}
                options={sizes.map((s) => {
                  const options = variants.filter((v) => v.size === s);
                  const prices = options.map((v) => v.price_paise);
                  const min = Math.min(...prices);
                  return {
                    value: s,
                    label: sizeShort(s),
                    detail: prices.every((p) => p === min) ? formatINR(min) : `from ${formatINR(min)}`,
                    disabled: !options.some(inStock),
                  };
                })}
              />
            )}
            {finishes.length > 1 && (
              <ChoiceGroup
                legend={wallPiece ? 'Frame' : 'Finish'}
                name="finish"
                value={finish}
                onChange={setFinish}
                columns="two"
                options={finishes.map((f) => {
                  const v = variants.find((x) => x.size === size && x.finish === f);
                  return {
                    value: f,
                    label: f,
                    swatch: wallPiece ? finishSwatch(f) : null,
                    disabled: !inStock(v),
                    detail: !v ? `Not in ${sizeShort(size)}` : !inStock(v) ? 'Out of stock' : undefined,
                  };
                })}
              />
            )}
            {(sizes.length === 1 || finishes.length === 1) && variant && (
              <p className="text-[15px] text-ink-faint">
                {sizes.length === 1 && <span className="block">Size: <span className="text-ink-light">{variant.size}</span></span>}
                {finishes.length === 1 && <span className="block">Finish: <span className="text-ink-light">{variant.finish}</span></span>}
              </p>
            )}

            {wallPiece && (
              <PhotoUploader
                ref={uploaderRef}
                uploads={uploads}
                label="Your photo (optional)"
                hint={
                  photo?.width && photo.height && variant && dpi !== null ? (
                    dpi < MIN_PRINT_DPI ? (
                      <span className="text-ink-light">
                        At {sizeShort(variant.size)} this photo ({photo.width.toLocaleString('en-IN')} ×{' '}
                        {photo.height.toLocaleString('en-IN')} px) prints at about {dpi} DPI and may look soft.
                        {bestSize ? ` It will print sharply up to ${sizeShort(bestSize)}.` : ' A larger original would print better.'}
                      </span>
                    ) : (
                      <>
                        {photo.width.toLocaleString('en-IN')} × {photo.height.toLocaleString('en-IN')} px — sharp at{' '}
                        {sizeShort(variant.size)}.{photo.resized ? ' We reduced it to fit the 25 MB upload limit.' : ''}
                      </>
                    )
                  ) : (
                    'Upload the photo you want printed. You can also send it to us after ordering — just mention your order number.'
                  )
                }
              />
            )}

            {book && (
              <PhotoUploader
                ref={uploaderRef}
                uploads={uploads}
                label="Your photos"
                min={minPhotos}
                hint={`We need at least ${minPhotos} photos to design your ${product.category === 'albums' ? 'album' : 'diary'}. You can add up to ${maxPhotos} here.`}
              />
            )}

            <div>
              <div className="flex gap-3">
                <QtyStepper value={qty} onChange={setQty} max={maxQty} label="Quantity" />
                <button
                  type="button"
                  onClick={addToBag}
                  aria-disabled={blocked}
                  className={`btn-primary flex-1 ${blocked ? 'opacity-50 cursor-not-allowed hover:bg-accent' : ''}`}
                >
                  {variant ? `Add to bag · ${formatINR(variant.price_paise * qty)}` : 'Add to bag'}
                </button>
              </div>
              <div aria-live="polite" className="min-h-[1.25rem] mt-3 text-[13px]">
                {added ? (
                  <span className="text-ink-light">
                    Added to your bag.{' '}
                    <button type="button" onClick={cart.openCart} className="link-line text-[13px]">
                      View bag
                    </button>
                  </span>
                ) : blocked && blockReason ? (
                  <span className={hint ? 'text-red-400' : 'text-ink-faint'}>{blockReason}</span>
                ) : lowStock ? (
                  <span className="text-ink-faint">Only {variant?.stock} left in this option.</span>
                ) : null}
              </div>
            </div>

            {wa && (
              <p className="text-[14px] text-ink-faint border-t border-hairline pt-6">
                Questions about sizes or finishes?{' '}
                <a
                  href={whatsappLink(settings.studio_profile.whatsapp, `Hello, I have a question about ${product.name}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-line text-[14px]"
                >
                  Ask us on WhatsApp
                </a>
              </p>
            )}
          </div>
        </div>
      </div>

      {wallPiece && variant && (
        <RoomMockupModal
          isOpen={roomOpen}
          onClose={() => setRoomOpen(false)}
          imageUrl={printUrl}
          frameTitle={product.name}
          finish={variant.finish}
          size={variant.size}
          mat={product.category !== 'canvas'}
          landscape={!!printW && !!printH && printW > printH}
        />
      )}
    </PageFrame>
  );
};

export default ProductDetailPage;
