import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useSiteData } from '@/context/SiteDataContext';
import { PhotoItem, Product } from '@/types';
import { errorMessage } from './ui';

export interface AdminSummary {
  ordersPaid: number;
  revenuePaise: number;
  ordersPending: number;
  inquiriesNew: number;
  photos: number;
  lowStock: { productName: string; size: string; finish: string; stock: number }[];
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface AdminDataValue {
  /** Every photo, hidden ones included, in display order. */
  photos: PhotoItem[];
  photosState: LoadState;
  photosError: string | null;
  loadPhotos: (force?: boolean) => Promise<void>;
  /** Replace the admin photo list and push the visible ones to the public site. */
  commitPhotos: (next: PhotoItem[] | ((prev: PhotoItem[]) => PhotoItem[])) => PhotoItem[];
  summary: AdminSummary | null;
  refreshSummary: () => Promise<void>;
}

const AdminDataContext = createContext<AdminDataValue | null>(null);

export const sortPhotos = (list: PhotoItem[]) => [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Mirrors the server's public catalogue: active products with their active variants (none → left out), by sort order. */
export const publicProducts = (list: Product[]) =>
  list
    .filter((p) => Number(p.active) === 1)
    .map((p) => ({ ...p, variants: (p.variants || []).filter((v) => Number(v.active) === 1) }))
    .filter((p) => p.variants.length > 0)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

export const AdminDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const site = useSiteData();
  const setSitePhotos = site.setPhotos;
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photosState, setPhotosState] = useState<LoadState>('idle');
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const loading = useRef<Promise<void> | null>(null);
  const loaded = useRef(false);
  // Latest list, so async work (uploads, rollbacks) always builds on the current state.
  const photosRef = useRef<PhotoItem[]>([]);

  const loadPhotos = useCallback(async (force = false) => {
    if (loaded.current && !force) return;
    if (loading.current) return loading.current;
    setPhotosState('loading');
    setPhotosError(null);
    loading.current = api<PhotoItem[]>('/api/admin/photos')
      .then((list) => {
        photosRef.current = sortPhotos(Array.isArray(list) ? list : []);
        setPhotos(photosRef.current);
        setPhotosState('ready');
        loaded.current = true;
      })
      .catch((err) => {
        setPhotosError(errorMessage(err));
        setPhotosState('error');
      })
      .finally(() => {
        loading.current = null;
      });
    return loading.current;
  }, []);

  const commitPhotos = useCallback(
    (next: PhotoItem[] | ((prev: PhotoItem[]) => PhotoItem[])) => {
      const ordered = sortPhotos(typeof next === 'function' ? next(photosRef.current) : next);
      photosRef.current = ordered;
      setPhotos(ordered);
      setSitePhotos(ordered.filter((p) => p.visible !== false));
      return ordered;
    },
    [setSitePhotos]
  );

  const refreshSummary = useCallback(async () => {
    try {
      setSummary(await api<AdminSummary>('/api/admin/summary'));
    } catch {
      /* the dashboard shows its own error; the nav badge just stays as it was */
    }
  }, []);

  const value = useMemo(
    () => ({ photos, photosState, photosError, loadPhotos, commitPhotos, summary, refreshSummary }),
    [photos, photosState, photosError, loadPhotos, commitPhotos, summary, refreshSummary]
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
};

export const useAdminData = () => {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be used inside AdminDataProvider');
  return ctx;
};
