import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
  deliveryNote,
  gstNote,
  isCustomFrameProduct,
  printAspect,
  printDpi,
  requiredPixelsLabel,
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

export const CustomFramePage: React.FC = () => {
  const { products, status, settings } = useSiteData();
  const product = products.find((p) => isCustomFrameProduct(p) && p.active !== 0 && activeVariants(p).length > 0);
  const wa = whatsappLink(settings.studio_profile.whatsapp, 'Hello, I’d like to frame a photo of my own.');

  return (
    <div className="min-h-screen bg-canvas text-ink-light">
      <Navigation />
      <main className="container-site pt-24 sm:pt-28 pb-20 sm:pb-28">
        {product ? (
          <Configurator product={product} />
        ) : status === 'loading' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10" aria-busy="true" aria-label="Loading">
            <div className="lg:col-span-7 h-[460px] lg:h-[680px] bg-canvas-surface rounded-[2px] animate-pulse" />
            <div className="lg:col-span-5 space-y-4">
              <div className="h-12 w-3/4 bg-canvas-surface rounded-sm" />
              <div className="h-24 w-full bg-canvas-surface rounded-sm" />
            </div>
          </div>
        ) : (
          <div className="py-16 max-w-xl">
            <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05]">Framing your own photo isn’t available right now.</h1>
            <p className="text-[15px] sm:text-base text-ink-faint mt-4 leading-relaxed">
              {status === 'offline'
                ? 'The shop couldn’t be loaded. Please check your connection and refresh the page.'
                : 'Please check back soon, or message us and we’ll help you directly.'}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  Message us on WhatsApp
                </a>
              )}
              <Link to="/shop" className="btn-quiet">
                Back to the shop
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

const Configurator: React.FC<{ product: Product }> = ({ product }) => {
  const { settings } = useSiteData();
  const photos = useVisiblePhotos();
  const cart = useCart();
  const wall = useWallStyle();
  const tiltHint = useTiltHint();
  const variants = useMemo(() => activeVariants(product), [product]);
  const sizes = useMemo(() => uniq(variants.map((v) => v.size)), [variants]);
  const finishes = useMemo(() => uniq(variants.map((v) => v.finish)), [variants]);
  const uploads = usePhotoUploads({ max: 1, withPreview: true });
  const uploaderRef = useRef<HTMLButtonElement>(null);

  const first = variants.find(inStock) || variants[0];
  const [size, setSize] = useState(first.size);
  const [finish, setFinish] = useState(first.finish);
  const [mat, setMat] = useState(true);
  const [qty, setQty] = useState(1);
  const [roomOpen, setRoomOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);

  useEffect(() => {
    if (!variants.some((v) => v.size === size && v.finish === finish)) {
      setSize(first.size);
      setFinish(first.finish);
    }
  }, [variants, size, finish, first]);

  const variant = variants.find((v) => v.size === size && v.finish === finish);
  const isCanvas = /canvas|gallery wrap/i.test(finish);
  const maxQty = Math.max(1, Math.min(10, variant?.stock ?? 10));
  useEffect(() => setQty((q) => Math.min(q, maxQty)), [maxQty]);

  const chooseSize = (s: string) => {
    setSize(s);
    setMessage(null);
    if (!inStock(variants.find((v) => v.size === s && v.finish === finish))) {
      const alt = variants.find((v) => v.size === s && inStock(v)) || variants.find((v) => v.size === s);
      if (alt) setFinish(alt.finish);
    }
  };

  const photo = uploads.entries[0];
  const sample = printImageFor(product, photos);
  const imgW = photo?.width ?? sample.width;
  const imgH = photo?.height ?? sample.height;
  const previewUrl = photo?.previewUrl || photo?.thumbUrl || sample.url;
  const aspect = printAspect(size, imgW, imgH) || (imgW && imgH ? imgW / imgH : 2 / 3);
  const hasPhotoSize = !!(photo?.width && photo.height);
  const dpiAt = (s: string) => (hasPhotoSize ? printDpi(photo.width as number, photo.height as number, s) : null);
  const dpi = dpiAt(size);
  const sharpUpTo = hasPhotoSize ? [...sizes].reverse().find((s) => (dpiAt(s) ?? 0) >= MIN_PRINT_DPI) : undefined;
  const cropNote = (() => {
    if (!hasPhotoSize) return '';
    const target = printAspect(size, photo.width, photo.height);
    const actual = (photo.width as number) / (photo.height as number);
    return target && Math.abs(target - actual) / actual > 0.03
      ? `Your photo’s shape differs a little from ${sizeShort(size)}, so its edges are trimmed to fit, as shown.`
      : '';
  })();

  const done = photo?.status === 'done';
  const addToBag = () => {
    if (!photo) {
      setMessage({ tone: 'error', text: 'Add your photo first.' });
      uploaderRef.current?.focus();
      return;
    }
    if (photo.status === 'error') {
      setMessage({ tone: 'error', text: 'Your photo didn’t upload. Retry it or choose another.' });
      return;
    }
    if (!done) {
      setMessage({ tone: 'error', text: 'Please wait for your photo to finish uploading.' });
      return;
    }
    if (!variant || !inStock(variant)) {
      setMessage({ tone: 'error', text: 'This size and frame are out of stock. Please choose another.' });
      return;
    }
    cart.add({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      variantSize: variant.size,
      variantFinish: variant.finish,
      unitPricePaise: variant.price_paise,
      quantity: qty,
      image: product.images?.[0] || '',
      uploadKeys: [photo.key as string],
      previewUrl: photo.thumbUrl,
      note: isCanvas ? undefined : mat ? 'With white mat' : 'No mat',
    });
    // Each uploaded photo belongs to one bag line; a second frame needs its own upload.
    uploads.reset();
    setMessage({ tone: 'ok', text: 'Added to your bag.' });
  };

  const ready = done && variant && inStock(variant);
  const gst = gstNote(settings.gst_config);
  const city = settings.studio_profile.city;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-8">
        <header className="lg:col-start-8 lg:col-span-5 lg:row-start-1">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-faint mb-5">
            <Link to="/shop" className="hover:text-ink-light">
              Shop
            </Link>
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            <span className="text-ink-light">Frame your own photo</span>
          </nav>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-[56px] leading-[1.04] tracking-[-0.01em]">Frame your own photo</h1>
          <p className="text-[15px] sm:text-base leading-relaxed text-ink-faint mt-4 max-w-[52ch]">
            Upload a photo, choose the size and frame, and see it framed before you order. We print and frame it
            {city ? ` in our ${city} workshop` : ' in our workshop'}.
          </p>
        </header>

        {/* Live preview */}
        <div className="lg:col-start-1 lg:col-span-7 lg:row-start-1 lg:row-span-2">
          <div className="lg:sticky lg:top-24">
            <div
              className="surface-invert relative -mx-5 sm:mx-0 sm:rounded-[2px] overflow-hidden h-[440px] sm:h-[600px] lg:h-[min(80vh,760px)]"
              style={wall}
            >
              <Frame3D
                imageUrl={previewUrl}
                finish={finish}
                mat={mat && !isCanvas}
                aspect={aspect}
                alt={`Preview: ${photo ? 'your photo' : 'sample photo'} framed in ${finish}, ${size}${mat && !isCanvas ? ', with mat' : ''}`}
                className="w-full h-full"
              />
              <p className="absolute left-4 right-4 bottom-3 text-[12px] text-ink-faint pointer-events-none">
                {photo ? 'Your photo' : 'Sample photo — add yours to see it here'} · {tiltHint}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
              <p className="text-sm text-ink-faint">
                {sizeShort(size)} · {finish}
                {!isCanvas && (mat ? ' · white mat' : ' · no mat')}
              </p>
              <button type="button" onClick={() => setRoomOpen(true)} className="link-line min-h-[44px]">
                See it on a wall, to scale
              </button>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="lg:col-start-8 lg:col-span-5 lg:row-start-2 space-y-8">
          <section aria-labelledby="step-photo">
            <h2 id="step-photo" className="font-serif text-2xl mb-4">
              1. Your photo
            </h2>
            <PhotoUploader
              ref={uploaderRef}
              uploads={uploads}
              label="The photo to print"
              hint={
                hasPhotoSize ? (
                  <>
                    {dpi !== null && dpi < MIN_PRINT_DPI ? (
                      <span className="block text-ink-light">
                        At {sizeShort(size)} this photo prints at about {dpi} DPI and may look soft (we suggest at least{' '}
                        {requiredPixelsLabel(size, (photo.width as number) > (photo.height as number))}).{' '}
                        {sharpUpTo ? `It will print sharply up to ${sizeShort(sharpUpTo)}.` : 'A larger original would print better.'}
                      </span>
                    ) : (
                      <span className="block">
                        {(photo.width as number).toLocaleString('en-IN')} × {(photo.height as number).toLocaleString('en-IN')} px —
                        sharp at {sizeShort(size)}.
                      </span>
                    )}
                    {photo.resized && (
                      <span className="block mt-1">
                        The original was over 25 MB, so we reduced it to{' '}
                        {(photo.width as number).toLocaleString('en-IN')} × {(photo.height as number).toLocaleString('en-IN')} px before
                        uploading.
                      </span>
                    )}
                    {cropNote && <span className="block mt-1">{cropNote}</span>}
                  </>
                ) : (
                  'Use the largest original you have. It is uploaded to private storage and never shown on the site.'
                )
              }
            />
          </section>

          <section aria-labelledby="step-size" className="pt-8 border-t border-hairline">
            <h2 id="step-size" className="font-serif text-2xl mb-4">
              2. Size
            </h2>
            <ChoiceGroup
              legend="Print size"
              name="cf-size"
              value={size}
              onChange={chooseSize}
              columns="two"
              options={sizes.map((s) => {
                const opts = variants.filter((v) => v.size === s);
                const min = Math.min(...opts.map((v) => v.price_paise));
                const sameForAll = opts.every((v) => v.price_paise === min);
                const d = dpiAt(s);
                return {
                  value: s,
                  label: sizeShort(s),
                  detail: `${sameForAll ? '' : 'from '}${formatINR(min)}${d !== null && d < MIN_PRINT_DPI ? ' · may look soft' : ''}`,
                  disabled: !opts.some(inStock),
                };
              })}
            />
          </section>

          <section aria-labelledby="step-frame" className="pt-8 border-t border-hairline space-y-6">
            <h2 id="step-frame" className="font-serif text-2xl">
              3. Frame
            </h2>
            {finishes.length > 1 ? (
              <ChoiceGroup
                legend="Moulding"
                name="cf-finish"
                value={finish}
                onChange={(f) => {
                  setFinish(f);
                  setMessage(null);
                }}
                columns="two"
                options={finishes.map((f) => {
                  const v = variants.find((x) => x.size === size && x.finish === f);
                  return {
                    value: f,
                    label: f,
                    swatch: finishSwatch(f),
                    disabled: !inStock(v),
                    detail: !v ? `Not in ${sizeShort(size)}` : !inStock(v) ? 'Out of stock' : undefined,
                  };
                })}
              />
            ) : (
              <p className="text-[15px] text-ink-faint">
                Moulding: <span className="text-ink-light">{finish}</span>
              </p>
            )}
            {!isCanvas && (
              <ChoiceGroup
                legend="Mat"
                name="cf-mat"
                value={mat ? 'mat' : 'none'}
                onChange={(v) => setMat(v === 'mat')}
                options={[
                  { value: 'mat', label: 'White mat', detail: 'A border around the print' },
                  { value: 'none', label: 'No mat', detail: 'Print fills the frame' },
                ]}
                columns="two"
              />
            )}
          </section>

          <section aria-labelledby="step-order" className="pt-8 border-t border-hairline">
            <h2 id="step-order" className="sr-only">
              Add to bag
            </h2>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[15px] text-ink-faint">Price</span>
              <span className="text-2xl tabular-nums">{variant ? formatINR(variant.price_paise * qty) : '—'}</span>
            </div>
            <p className="text-[13px] text-ink-faint mt-1 sm:text-right">
              {[gst, deliveryNote(settings.shipping_rules)].filter(Boolean).join(' ')}
            </p>
            <div className="mt-5 flex gap-3">
              <QtyStepper value={qty} onChange={setQty} max={maxQty} label="Quantity" />
              <button
                type="button"
                onClick={addToBag}
                aria-disabled={!ready}
                className={`btn-primary flex-1 ${ready ? '' : 'opacity-50 hover:bg-accent'}`}
              >
                {photo && !done && photo.status !== 'error' ? 'Uploading your photo…' : 'Add to bag'}
              </button>
            </div>
            <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-[13px]">
              {message ? (
                <span className={message.tone === 'error' ? 'text-red-400' : 'text-ink-light'}>
                  {message.text}{' '}
                  {message.tone === 'ok' && (
                    <button type="button" onClick={cart.openCart} className="link-line text-[13px]">
                      View bag
                    </button>
                  )}
                </span>
              ) : !photo ? (
                <span className="text-ink-faint">Add your photo to continue.</span>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <RoomMockupModal
        isOpen={roomOpen}
        onClose={() => setRoomOpen(false)}
        imageUrl={previewUrl}
        frameTitle={photo ? 'Your photo' : 'Sample photo'}
        finish={finish}
        size={size}
        mat={mat && !isCanvas}
        landscape={!!imgW && !!imgH && imgW > imgH}
      />
    </>
  );
};

export default CustomFramePage;
