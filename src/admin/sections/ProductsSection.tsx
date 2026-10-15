import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, formatINR } from '@/lib/api';
import { useSiteData } from '@/context/SiteDataContext';
import { Product } from '@/types';
import { publicProducts } from '../AdminDataContext';
import { Button, EmptyState, ErrorBanner, IconButton, PageHeader, SavedNote, Spinner, Toggle, cx, errorMessage } from '../ui';
import { PRODUCT_CATEGORIES, ProductEditor } from './ProductEditor';

const sortProducts = (list: Product[]) => [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

export const ProductsSection: React.FC = () => {
  const { setProducts: setSiteProducts } = useSiteData();
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  // Latest list, so saves that finish out of order never undo each other.
  const productsRef = useRef<Product[]>([]);

  const load = useCallback(async () => {
    setState('loading');
    setLoadError(null);
    try {
      const list = await api<Product[]>('/api/admin/products');
      productsRef.current = sortProducts(Array.isArray(list) ? list : []);
      setProducts(productsRef.current);
      setState('ready');
    } catch (err) {
      setLoadError(errorMessage(err));
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const commit = (update: (prev: Product[]) => Product[]) => {
    const sorted = sortProducts(update(productsRef.current));
    productsRef.current = sorted;
    setProducts(sorted);
    setSiteProducts(publicProducts(sorted));
  };

  const upsertLocal = (saved: Product) =>
    commit((prev) => (prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]));

  const toggleActive = async (p: Product) => {
    const nextActive = Number(p.active) === 1 ? 0 : 1;
    if (nextActive === 1 && !(p.variants || []).some((v) => Number(v.active) === 1)) {
      setError(`“${p.name}” has no available sizes. Edit it and add a size before making it active.`);
      return;
    }
    setError(null);
    setBusyIds((b) => ({ ...b, [p.id]: true }));
    try {
      const saved = await api<Product>('/api/admin/products', { method: 'POST', body: { product: { ...p, active: nextActive, variants: p.variants || [] } } });
      upsertLocal(saved);
      setNotice(nextActive ? `“${p.name}” is now in the shop.` : `“${p.name}” is now a draft and hidden from the shop.`);
    } catch (err) {
      setError(`Could not update “${p.name}”: ${errorMessage(err)}`);
    } finally {
      setBusyIds((b) => ({ ...b, [p.id]: false }));
    }
  };

  const remove = async (p: Product) => {
    if (
      !window.confirm(
        `Delete “${p.name}” and all its sizes?\n\nIt will disappear from the shop. Past orders keep their details. This cannot be undone.\n\nTip: switch it to Draft instead if you may sell it again.`
      )
    )
      return;
    setError(null);
    setBusyIds((b) => ({ ...b, [p.id]: true }));
    try {
      await api(`/api/admin/products/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      commit((prev) => prev.filter((x) => x.id !== p.id));
      setNotice(`Deleted “${p.name}”.`);
    } catch (err) {
      setError(`Could not delete “${p.name}”: ${errorMessage(err)}`);
    } finally {
      setBusyIds((b) => ({ ...b, [p.id]: false }));
    }
  };

  const nextSortOrder = useMemo(() => (products.length ? Math.max(...products.map((p) => p.sort_order || 0)) + 1 : 1), [products]);
  const categoryLabel = (c: string) => PRODUCT_CATEGORIES.find((x) => x.value === c)?.label || c;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Frames, prints, albums and diaries sold in the shop. Draft products are hidden from customers."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus size={15} aria-hidden /> New product
          </Button>
        }
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <SavedNote show={!!notice} text={notice || ''} />

      {state === 'loading' && <Spinner label="Loading products…" />}
      {state === 'error' && <ErrorBanner message={loadError} onRetry={load} />}
      {state === 'ready' && products.length === 0 && (
        <EmptyState title="No products yet">Use “New product” to add your first frame, print or album.</EmptyState>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {products.map((p) => {
          const variants = p.variants || [];
          const live = variants.filter((v) => Number(v.active) === 1);
          const prices = live.map((v) => v.price_paise);
          const stock = live.reduce((n, v) => n + (Number(v.stock) || 0), 0);
          const busy = !!busyIds[p.id];
          const active = Number(p.active) === 1;
          return (
            <li key={p.id} className={cx('flex flex-col gap-3 rounded-lg border bg-canvas-elevated p-4', active ? 'border-hairline-strong' : 'border-dashed border-hairline-strong')}>
              <div className="flex gap-3">
                <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded border border-hairline bg-canvas">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-ink-faint">No photo</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-faint">
                    {categoryLabel(p.category)}
                    {Number(p.featured) === 1 && <span className="text-accent"> · Featured</span>}
                  </p>
                  <p className="font-serif text-lg leading-tight text-ink-light">{p.name}</p>
                  <p className="mt-1 text-sm text-ink-faint">
                    {prices.length
                      ? prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
                        ? `${formatINR(Math.min(...prices))} – ${formatINR(Math.max(...prices))}`
                        : formatINR(prices[0])
                      : 'No available sizes'}
                    {' · '}
                    {live.length} size{live.length === 1 ? '' : 's'}
                    {variants.length > live.length && ` (+${variants.length - live.length} unavailable)`}
                    {' · '}
                    <span className={stock === 0 && live.length ? 'text-red-300' : undefined}>{stock} in stock</span>
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-ink-faint">/shop/{p.slug}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
                <Toggle label={active ? 'Active in shop' : 'Draft (hidden)'} checked={active} disabled={busy} onChange={() => toggleActive(p)} />
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => setEditing(p)} disabled={busy}>
                    <Pencil size={13} aria-hidden /> Edit
                  </Button>
                  <IconButton label={`Delete ${p.name}`} tone="danger" disabled={busy} onClick={() => remove(p)}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            upsertLocal(saved);
            setEditing(null);
            setNotice(`Saved “${saved.name}”.`);
          }}
        />
      )}
    </div>
  );
};
