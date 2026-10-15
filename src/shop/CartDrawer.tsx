import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import { useCart, lineKey } from '@/context/CartContext';
import { useSiteData } from '@/context/SiteDataContext';
import { formatINR } from '@/lib/api';
import { CartItem } from '@/types';
import { useDialog } from './useDialog';
import { QtyStepper } from './ui';
import { TrackOrder } from './TrackOrder';
import { deliveryNote, gstNote, CUSTOM_FRAME_SLUG } from './catalog';

const lineHref = (it: CartItem) =>
  !it.productSlug ? null : it.productSlug === CUSTOM_FRAME_SLUG ? '/shop/custom-frame' : `/shop/${it.productSlug}`;

const photosLabel = (n: number) => (n === 1 ? 'Your photo attached' : `${n} of your photos attached`);

export const CartDrawer: React.FC = () => {
  const cart = useCart();
  const { settings } = useSiteData();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { items, isCartOpen, closeCart, cartView, setCartView, issues } = cart;
  useDialog(isCartOpen, panelRef, closeCart);

  const hasIssues = Object.keys(issues).length > 0;
  const gst = gstNote(settings.gst_config);

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-[10000] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 bg-black/60"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bag-title"
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'tween', duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative w-full max-w-[440px] h-full bg-canvas-elevated text-ink-light flex flex-col shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 px-5 sm:px-7 h-16 sm:h-[72px] border-b border-hairline flex-shrink-0">
              {cartView === 'track' ? (
                <button
                  type="button"
                  onClick={() => setCartView('bag')}
                  className="-ml-2 h-11 px-2 inline-flex items-center gap-2 text-[15px] text-ink-faint hover:text-ink-light"
                >
                  <ArrowLeft size={17} aria-hidden="true" /> Bag
                </button>
              ) : null}
              <h2 id="bag-title" className="font-serif text-2xl leading-none mr-auto">
                {cartView === 'track' ? 'Track an order' : 'Your bag'}
              </h2>
              <button
                type="button"
                onClick={closeCart}
                className="-mr-2 w-11 h-11 flex items-center justify-center text-ink-faint hover:text-ink-light rounded-[3px]"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>

            {cartView === 'track' ? (
              <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6">
                <TrackOrder key={cart.trackingPrefill.orderNo || "track"} prefill={cart.trackingPrefill} />
              </div>
            ) : items.length === 0 ? (
              <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-10">
                <p className="font-serif text-2xl">Your bag is empty.</p>
                <p className="text-[15px] text-ink-faint mt-2 leading-relaxed">
                  Frames, prints and albums from our workshop — or frame a photo of your own.
                </p>
                <div className="mt-6 flex flex-col items-start gap-4">
                  <Link to="/shop" onClick={closeCart} className="btn-primary" data-autofocus>
                    Browse the shop
                  </Link>
                  <button type="button" onClick={() => setCartView('track')} className="link-line min-h-[44px]">
                    Track an order
                  </button>
                </div>
              </div>
            ) : (
              <>
                <ul className="flex-1 overflow-y-auto px-5 sm:px-7" aria-label="Items in your bag">
                  {items.map((it) => {
                    const id = lineKey(it);
                    const href = lineHref(it);
                    const photos = it.uploadKeys?.length ?? 0;
                    return (
                      <li key={id} className="py-5 border-b border-hairline flex gap-4">
                        <div className="w-20 sm:w-24 aspect-[4/5] bg-canvas-surface rounded-[2px] overflow-hidden flex-shrink-0">
                          {(it.previewUrl || it.image) && (
                            <img src={it.previewUrl || it.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                              {href ? (
                                <Link to={href} onClick={closeCart} className="text-[15px] text-ink-light hover:text-accent leading-snug">
                                  {it.productName}
                                </Link>
                              ) : (
                                <p className="text-[15px] text-ink-light leading-snug">{it.productName}</p>
                              )}
                              <p className="text-[13px] text-ink-faint mt-0.5">
                                {[it.variantSize, it.variantFinish].filter(Boolean).join(' · ')}
                              </p>
                              {it.note && <p className="text-[13px] text-ink-faint">{it.note}</p>}
                              {photos > 0 && <p className="text-[13px] text-ink-faint">{photosLabel(photos)}</p>}
                            </div>
                            <p className="text-[15px] tabular-nums text-ink-light whitespace-nowrap">
                              {formatINR(it.unitPricePaise * it.quantity)}
                            </p>
                          </div>
                          {it.quantity > 1 && (
                            <p className="text-[13px] text-ink-muted tabular-nums">{formatINR(it.unitPricePaise)} each</p>
                          )}
                          {issues[id] && (
                            <p className="text-[13px] text-red-400 mt-1" role="alert">
                              {issues[id]}
                            </p>
                          )}
                          <div className="mt-auto pt-3 flex items-center justify-between gap-3">
                            <QtyStepper
                              size="sm"
                              value={it.quantity}
                              onChange={(n) => cart.setQty(id, n)}
                              label={`Quantity of ${it.productName}`}
                            />
                            <button
                              type="button"
                              onClick={() => cart.remove(id)}
                              className="h-11 px-1 text-[13px] text-ink-faint hover:text-ink-light underline underline-offset-4 decoration-hairline-strong"
                              aria-label={`Remove ${it.productName} from bag`}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <footer className="flex-shrink-0 border-t border-hairline px-5 sm:px-7 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-canvas-elevated">
                  <div className="flex justify-between items-baseline text-[15px]">
                    <span className="text-ink-faint">Subtotal</span>
                    <span className="text-lg tabular-nums">{formatINR(cart.subtotalPaise)}</span>
                  </div>
                  <p className="text-[13px] text-ink-faint mt-1.5 leading-relaxed">
                    {deliveryNote(settings.shipping_rules, cart.subtotalPaise)} {gst}
                  </p>
                  <button
                    type="button"
                    onClick={cart.openCheckout}
                    disabled={hasIssues}
                    className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Checkout
                  </button>
                  {hasIssues && (
                    <p className="text-[13px] text-red-400 mt-2">Please fix the items marked above to continue.</p>
                  )}
                  <div className="mt-2 flex justify-between">
                    <button type="button" onClick={closeCart} className="h-11 text-[14px] text-ink-faint hover:text-ink-light">
                      Continue shopping
                    </button>
                    <button type="button" onClick={() => setCartView('track')} className="h-11 text-[14px] text-ink-faint hover:text-ink-light">
                      Track an order
                    </button>
                  </div>
                </footer>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
