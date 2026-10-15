import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PhotoItem, Product, SettingsKey, StudioSettings } from '@/types';
import { DEFAULT_SETTINGS, mergeSetting, mergeSettings } from '@/content/defaults';
import { api } from '@/lib/api';

interface SiteResponse {
  settings: Partial<Record<SettingsKey, unknown>>;
  photos: PhotoItem[];
  products: Product[];
}

interface SiteDataContextValue {
  settings: StudioSettings;
  photos: PhotoItem[];
  products: Product[];
  status: 'loading' | 'ready' | 'offline';
  refresh: () => Promise<void>;
  // Used by the admin panel after a successful save so the site updates without a reload.
  applySetting: <K extends SettingsKey>(key: K, value: StudioSettings[K]) => void;
  setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

const SiteDataContext = createContext<SiteDataContextValue | null>(null);

async function loadManifest(): Promise<PhotoItem[]> {
  try {
    const res = await fetch('/data/manifest.json');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export const SiteDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<SiteDataContextValue['status']>('loading');

  const refresh = useCallback(async () => {
    try {
      const data = await api<SiteResponse>('/api/site');
      setSettings(mergeSettings(data.settings || {}));
      setProducts(Array.isArray(data.products) ? data.products : []);
      // The database is the source of truth: if the admin hides every photo, show none.
      setPhotos(Array.isArray(data.photos) ? data.photos : []);
      setStatus('ready');
    } catch {
      // API unreachable (e.g. plain `vite` without Functions): show the bundled photos and defaults.
      setPhotos(await loadManifest());
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applySetting = useCallback(<K extends SettingsKey>(key: K, value: StudioSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: mergeSetting(DEFAULT_SETTINGS[key], value) }));
  }, []);

  const value = useMemo(
    () => ({ settings, photos, products, status, refresh, applySetting, setPhotos, setProducts }),
    [settings, photos, products, status, refresh, applySetting]
  );

  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
};

export const useSiteData = () => {
  const ctx = useContext(SiteDataContext);
  if (!ctx) throw new Error('useSiteData must be used inside SiteDataProvider');
  return ctx;
};

/** Visible photos in display order. */
export const useVisiblePhotos = () => {
  const { photos } = useSiteData();
  return useMemo(
    () => photos.filter((p) => p.visible !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [photos]
  );
};
