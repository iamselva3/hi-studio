import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useSiteData } from '@/context/SiteDataContext';
import { DEFAULT_SETTINGS, mergeSetting } from '@/content/defaults';
import { SettingsKey, StudioSettings } from '@/types';
import { Button, Card, ErrorBanner, SavedNote, deepEqual, errorMessage } from './ui';

interface SaveResponse<K extends SettingsKey> {
  ok: boolean;
  key: K;
  value: StudioSettings[K];
}

export interface SettingDraft<T> {
  draft: T;
  setDraft: React.Dispatch<React.SetStateAction<T>>;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  justSaved: boolean;
  save: (value: T) => Promise<boolean>;
  resetToDefault: () => Promise<void>;
  discard: () => void;
  /** False until the live site content has loaded; editing is paused so defaults never overwrite real content. */
  ready: boolean;
  isDefault: boolean;
}

/**
 * Draft state for one settings key. Saves with POST /api/admin/settings and, only once the
 * server confirms, pushes the saved value into the public site's data.
 */
export function useSettingDraft<K extends SettingsKey>(key: K): SettingDraft<StudioSettings[K]> {
  const { settings, applySetting, status } = useSiteData();
  const live = settings[key];
  const [draft, setDraft] = useState<StudioSettings[K]>(live);
  const [baseline, setBaseline] = useState<StudioSettings[K]>(live);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = !deepEqual(draft, baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Follow the live value (first load, refresh) unless the owner is mid-edit.
  useEffect(() => {
    if (!dirtyRef.current) {
      setDraft(live);
      setBaseline(live);
    }
  }, [live]);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (dirty) setJustSaved(false);
  }, [dirty]);

  const save = useCallback(
    async (value: StudioSettings[K]) => {
      setSaving(true);
      setError(null);
      setJustSaved(false);
      try {
        const res = await api<SaveResponse<K>>('/api/admin/settings', { method: 'POST', body: { key, value } });
        if (!res || res.ok === false) throw new Error('The server did not confirm the save.');
        const saved = mergeSetting(DEFAULT_SETTINGS[key], res.value !== undefined ? res.value : value);
        dirtyRef.current = false;
        setBaseline(saved);
        setDraft(saved);
        applySetting(key, saved);
        setJustSaved(true);
        return true;
      } catch (err) {
        setError(errorMessage(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [key, applySetting]
  );

  const resetToDefault = useCallback(async () => {
    if (!window.confirm('Replace this section with the original default content? Your current text for this section will be lost.')) return;
    await save(DEFAULT_SETTINGS[key]);
  }, [key, save]);

  const discard = useCallback(() => {
    setDraft(baseline);
    setError(null);
  }, [baseline]);

  return {
    draft,
    setDraft,
    dirty,
    saving,
    error,
    setError,
    justSaved,
    save,
    resetToDefault,
    discard,
    ready: status === 'ready',
    isDefault: deepEqual(baseline, DEFAULT_SETTINGS[key]),
  };
}

/** Card with Save / Discard / Reset-to-default controls for one settings key. */
export function SettingsCard<T>({
  title,
  description,
  state,
  validate,
  prepare,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  state: SettingDraft<T>;
  /** Return an error message to block saving. */
  validate?: (draft: T) => string | null;
  /** Clean up the draft (trim etc.) before it is sent. */
  prepare?: (draft: T) => T;
  children: React.ReactNode;
}) {
  const { draft, dirty, saving, error, setError, justSaved, save, resetToDefault, discard, ready, isDefault } = state;

  const onSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const problem = validate?.(draft);
    if (problem) {
      setError(problem);
      return;
    }
    await save(prepare ? prepare(draft) : draft);
  };

  return (
    <Card title={title} description={description}>
      <form onSubmit={onSave} className="space-y-5" noValidate>
        <fieldset disabled={!ready || saving} className="space-y-5 disabled:opacity-70">
          {children}
        </fieldset>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        {/* Sticks to the bottom of the screen while the card is being edited, so Save is always in reach on a phone. */}
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-hairline-strong bg-canvas-elevated/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Button type="submit" variant="primary" busy={saving} disabled={!dirty || !ready}>
            <Save size={14} aria-hidden /> {saving ? 'Saving…' : 'Save'}
          </Button>
          {dirty && !saving && (
            <Button variant="ghost" onClick={discard}>
              Discard changes
            </Button>
          )}
          <SavedNote show={justSaved && !dirty} text="Saved — live on the website" />
          {dirty && !saving && <span className="text-sm text-amber-200">Unsaved changes</span>}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={resetToDefault} disabled={saving || !ready || (isDefault && !dirty)}>
            <RotateCcw size={13} aria-hidden /> Reset to default
          </Button>
        </div>
      </form>
    </Card>
  );
}
