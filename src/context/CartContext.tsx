import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CartItem, ProductVariant } from '@/types';
import { useSiteData } from '@/context/SiteDataContext';

const STORAGE_KEY = 'hi_studio_cart';
// Older builds kept invented "orders" in the browser. Orders now live only on the server.
const LEGACY_ORDERS_KEY = 'hi_studio_orders';

export const MAX_QTY = 10;
// A bag preview thumbnail is ~10–30 KB; anything far larger is a full photo that slipped in.
const MAX_PREVIEW_CHARS = 120_000;

export const lineKey = (item: Pick<CartItem, 'lineId' | 'variantId'>) => item.lineId || item.variantId;

const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.round(Number(n) || 1)));

const isDataUrl = (v: unknown) => typeof v === 'string' && v.startsWith('data:');

/** Keeps only well-formed lines; drops lines from older builds that carried whole photos as base64. */
const sanitize = (raw: unknown): CartItem[] => {
  if (!Array.isArray(raw)) return [];
  const out: CartItem[] = [];
  for (const it of raw as Partial<CartItem>[]) {
    if (!it || typeof it !== 'object') continue;
    if (typeof it.variantId !== 'string' || typeof it.productName !== 'string') continue;
    if (typeof it.unitPricePaise !== 'number') continue;
    const legacyPhotos =
      it.customPhotoUrl !== undefined || it.customPhotos !== undefined || it.customUploadId !== undefined;
    if (legacyPhotos || isDataUrl(it.image)) continue;
    const uploadKeys = Array.isArray(it.uploadKeys) ? it.uploadKeys.filter((k) => typeof k === 'string') : undefined;
    const preview =
      typeof it.previewUrl === 'string' && it.previewUrl.length <= MAX_PREVIEW_CHARS ? it.previewUrl : undefined;
    out.push({
      lineId: typeof it.lineId === 'string' ? it.lineId : undefined,
      variantId: it.variantId,
      productId: String(it.productId ?? ''),
      productName: it.productName,
      productSlug: typeof it.productSlug === 'string' ? it.productSlug : undefined,
      variantSize: String(it.variantSize ?? ''),
      variantFinish: String(it.variantFinish ?? ''),
      unitPricePaise: it.unitPricePaise,
      quantity: clampQty(it.quantity ?? 1),
      image: typeof it.image === 'string' ? it.image : '',
      uploadKeys: uploadKeys?.length ? uploadKeys : undefined,
      previewUrl: preview,
      note: typeof it.note === 'string' ? it.note : undefined,
    });
  }
  return out;
};

const readCart = (): CartItem[] => {
  try {
    localStorage.removeItem(LEGACY_ORDERS_KEY);
    const saved = localStorage.getItem(STORAGE_KEY);
    return sanitize(saved ? JSON.parse(saved) : []);
  } catch {
    return [];
  }
};

const newLineId = (variantId: string) =>
  `${variantId}~${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export type CartView = 'bag' | 'track';

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalPaise: number;
  /** Adds a line (merging plain products by variant) and opens the bag. */
  add: (item: CartItem) => void;
  /** `id` is the line id (see `lineKey`); a plain variantId works for plain products. */
  updateQty: (id: string, delta: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Problems found against the live catalogue, keyed by line id (e.g. "Only 2 left"). */
  issues: Record<string, string>;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  cartView: CartView;
  setCartView: (view: CartView) => void;
  /** Opens the bag on the "Track an order" form, optionally pre-filled. */
  openTracking: (prefill?: { orderNo?: string; phone?: string }) => void;
  trackingPrefill: { orderNo?: string; phone?: string };
  isCheckoutOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { products, status } = useSiteData();
  const [items, setItems] = useState<CartItem[]>(readCart);
  const [isCartOpen, setCartOpen] = useState(false);
  const [cartView, setCartView] = useState<CartView>('bag');
  const [trackingPrefill, setTrackingPrefill] = useState<{ orderNo?: string; phone?: string }>({});
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full or unavailable: the bag still works for this visit */
    }
  }, [items]);

  // Live variants from D1, for prices and stock.
  const variantIndex = useMemo(() => {
    const map = new Map<string, { variant: ProductVariant; productName: string; productSlug: string }>();
    products.forEach((p) =>
      (p.variants || []).forEach((v) => {
        if (v.active !== 0) map.set(v.id, { variant: v, productName: p.name, productSlug: p.slug });
      })
    );
    return map;
  }, [products]);

  // Keep prices and names in step with the catalogue (the server charges catalogue prices anyway).
  useEffect(() => {
    if (status !== 'ready') return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        const hit = variantIndex.get(it.variantId);
        if (!hit) return it;
        const { variant, productName, productSlug } = hit;
        if (
          it.unitPricePaise === variant.price_paise &&
          it.productName === productName &&
          it.variantSize === variant.size &&
          it.variantFinish === variant.finish &&
          it.productSlug === productSlug
        ) {
          return it;
        }
        changed = true;
        return {
          ...it,
          unitPricePaise: variant.price_paise,
          productName,
          productSlug,
          variantSize: variant.size,
          variantFinish: variant.finish,
        };
      });
      return changed ? next : prev;
    });
  }, [status, variantIndex]);

  const issues = useMemo(() => {
    const out: Record<string, string> = {};
    if (status !== 'ready') return out;
    // Stock is per variant, so add up lines that share one.
    const perVariant = new Map<string, number>();
    items.forEach((it) => perVariant.set(it.variantId, (perVariant.get(it.variantId) || 0) + it.quantity));
    items.forEach((it) => {
      const hit = variantIndex.get(it.variantId);
      if (!hit) out[lineKey(it)] = 'No longer available. Please remove it to continue.';
      else if (hit.variant.stock <= 0) out[lineKey(it)] = 'Out of stock. Please remove it to continue.';
      else if ((perVariant.get(it.variantId) || 0) > hit.variant.stock)
        out[lineKey(it)] = `Only ${hit.variant.stock} left in this option.`;
    });
    return out;
  }, [items, variantIndex, status]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      // Lines carrying the customer's photos never merge; option notes merge per note.
      const personal = (item.uploadKeys?.length ?? 0) > 0;
      const line: CartItem = {
        ...item,
        lineId:
          item.lineId ||
          (personal ? newLineId(item.variantId) : item.note ? `${item.variantId}|${item.note}` : item.variantId),
        quantity: clampQty(item.quantity),
      };
      const existing = prev.find((i) => lineKey(i) === lineKey(line));
      if (existing) {
        return prev.map((i) =>
          lineKey(i) === lineKey(line) ? { ...i, quantity: clampQty(i.quantity + line.quantity) } : i
        );
      }
      return [...prev, line];
    });
    setCartView('bag');
    setCartOpen(true);
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (lineKey(i) === id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => prev.map((i) => (lineKey(i) === id ? { ...i, quantity: clampQty(qty) } : i)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => lineKey(i) !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const openCart = useCallback(() => {
    setCartView('bag');
    setCartOpen(true);
  }, []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const openTracking = useCallback((prefill: { orderNo?: string; phone?: string } = {}) => {
    setTrackingPrefill(prefill);
    setCartView('track');
    setCheckoutOpen(false);
    setCartOpen(true);
  }, []);
  const openCheckout = useCallback(() => {
    setCartOpen(false);
    setCheckoutOpen(true);
  }, []);
  const closeCheckout = useCallback(() => setCheckoutOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotalPaise: items.reduce((n, i) => n + i.unitPricePaise * i.quantity, 0),
      add,
      updateQty,
      setQty,
      remove,
      clear,
      issues,
      isCartOpen,
      openCart,
      closeCart,
      cartView,
      setCartView,
      openTracking,
      trackingPrefill,
      isCheckoutOpen,
      openCheckout,
      closeCheckout,
    }),
    [
      items,
      add,
      updateQty,
      setQty,
      remove,
      clear,
      issues,
      isCartOpen,
      openCart,
      closeCart,
      cartView,
      openTracking,
      trackingPrefill,
      isCheckoutOpen,
      openCheckout,
      closeCheckout,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
