import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useSiteData } from '@/context/SiteDataContext';
import { PhotoCategory, PhotoItem } from '@/types';
import { useAdminData } from '../AdminDataContext';
import {
  Button,
  EmptyState,
  ErrorBanner,
  IconButton,
  Modal,
  Notice,
  PageHeader,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
  Toggle,
  cx,
  errorMessage,
  inputClass,
} from '../ui';
import { PHOTO_CATEGORIES, PhotoUploader } from './PhotoUploader';

type Filter = 'all' | PhotoCategory | 'hidden';

interface EditDraft {
  title: string;
  subtitle: string;
  caption: string;
  alt: string;
  category: PhotoCategory;
  featured: boolean;
  visible: boolean;
}

const toDraft = (p: PhotoItem): EditDraft => ({
  title: p.title || '',
  subtitle: p.subtitle || '',
  caption: p.caption || '',
  alt: p.alt || '',
  category: p.category,
  featured: !!p.featured,
  visible: p.visible !== false,
});

export const PhotoLibrarySection: React.FC = () => {
  const { settings } = useSiteData();
  const { photos, photosState, photosError, loadPhotos, commitPhotos, refreshSummary } = useAdminData();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [reordering, setReordering] = useState(false);
  const [editing, setEditing] = useState<PhotoItem | null>(null);
  const uploaderRef = useRef<{ addFiles: (files: FileList | File[]) => void }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const label = (c: PhotoCategory) => settings.portfolio[c]?.label || c;

  const usage = useMemo(() => {
    const map: Record<string, string[]> = {};
    (settings.hero.photoIds || []).forEach((id) => (map[id] = [...(map[id] || []), 'Home hero']));
    if (settings.story.photoId) map[settings.story.photoId] = [...(map[settings.story.photoId] || []), 'Story section'];
    return map;
  }, [settings.hero.photoIds, settings.story.photoId]);

  const view = useMemo(() => {
    const term = search.trim().toLowerCase();
    return photos.filter((p) => {
      if (filter === 'hidden' && p.visible !== false) return false;
      if (filter !== 'all' && filter !== 'hidden' && p.category !== filter) return false;
      if (!term) return true;
      return [p.title, p.alt, p.subtitle, p.caption].some((t) => (t || '').toLowerCase().includes(term));
    });
  }, [photos, filter, search]);

  const setBusy = (id: string, v: boolean) => setBusyIds((prev) => ({ ...prev, [id]: v }));

  const patchPhoto = async (photo: PhotoItem, patch: Partial<EditDraft>) => {
    setError(null);
    setBusy(photo.id, true);
    const before = { ...photo };
    commitPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, ...patch } : p)));
    try {
      const saved = await api<PhotoItem>(`/api/admin/photos/${encodeURIComponent(photo.id)}`, { method: 'PATCH', body: patch });
      if (!saved || !saved.id) throw new Error('The server did not confirm the change.');
      // Replace the whole photo: the server leaves out fields that were cleared.
      commitPhotos((prev) => prev.map((p) => (p.id === photo.id ? saved : p)));
      return true;
    } catch (err) {
      commitPhotos((prev) => prev.map((p) => (p.id === photo.id ? before : p)));
      setError(`Could not update “${photo.title}”: ${errorMessage(err)}`);
      return false;
    } finally {
      setBusy(photo.id, false);
    }
  };

  const move = async (photo: PhotoItem, dir: -1 | 1) => {
    const idx = view.findIndex((p) => p.id === photo.id);
    const neighbour = view[idx + dir];
    if (!neighbour) return;
    const before = photos;
    const next = [...photos];
    const a = next.findIndex((p) => p.id === photo.id);
    const b = next.findIndex((p) => p.id === neighbour.id);
    [next[a], next[b]] = [next[b], next[a]];
    const renumbered = next.map((p, i) => ({ ...p, order: i }));
    setError(null);
    setReordering(true);
    commitPhotos(renumbered);
    try {
      await api('/api/admin/photos/reorder', { method: 'POST', body: { ids: renumbered.map((p) => p.id) } });
    } catch (err) {
      commitPhotos(before);
      setError(`Could not save the new order: ${errorMessage(err)}`);
    } finally {
      setReordering(false);
    }
  };

  const remove = async (photo: PhotoItem) => {
    const usedIn = usage[photo.id];
    const msg =
      `Delete “${photo.title}”?\n\nIt will be removed from the website` +
      (photo.url.startsWith('/api/media/') ? ' and its image files will be deleted' : '') +
      '. This cannot be undone.' +
      (usedIn ? `\n\nThis photo is currently used in: ${usedIn.join(', ')}.` : '');
    if (!window.confirm(msg)) return;
    setError(null);
    setBusy(photo.id, true);
    try {
      await api(`/api/admin/photos/${encodeURIComponent(photo.id)}`, { method: 'DELETE' });
      commitPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      refreshSummary();
    } catch (err) {
      setError(`Could not delete “${photo.title}”: ${errorMessage(err)}`);
    } finally {
      setBusy(photo.id, false);
    }
  };

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: photos.length },
    ...PHOTO_CATEGORIES.map((c) => ({ id: c as Filter, label: label(c), count: photos.filter((p) => p.category === c).length })),
    { id: 'hidden', label: 'Hidden', count: photos.filter((p) => p.visible === false).length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Photos"
        description="Photos shown in the portfolio and around the website. Hidden photos stay here but are not shown to visitors. The order here is the order on the website."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                if (e.target.files?.length) uploaderRef.current?.addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
              <Plus size={15} aria-hidden /> Add photos
            </Button>
          </>
        }
      />

      <PhotoUploader ref={uploaderRef} defaultCategory={filter !== 'all' && filter !== 'hidden' ? filter : ''} />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter photos">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                'rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                filter === f.id ? 'border-accent bg-accent font-medium text-[#0D0C0B]' : 'border-hairline-strong text-ink-faint hover:text-ink-light'
              )}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
        <label className="block w-full lg:w-64">
          <span className="sr-only">Search photos</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles and descriptions"
            className={inputClass}
          />
        </label>
      </div>

      {photosState === 'loading' && !photos.length && <Spinner label="Loading photos…" />}
      {photosState === 'error' && <ErrorBanner message={photosError} onRetry={() => loadPhotos(true)} />}

      {photosState === 'ready' && photos.length === 0 && (
        <EmptyState title="No photos yet">Use “Add photos” to upload your first pictures.</EmptyState>
      )}
      {photos.length > 0 && view.length === 0 && <EmptyState title="No photos match">Try another category or clear the search.</EmptyState>}

      {(filter !== 'all' || search) && view.length > 1 && (
        <Notice>Moving photos up or down while filtered moves them past the neighbouring photo in this filtered list.</Notice>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {view.map((photo, i) => {
          const busy = !!busyIds[photo.id];
          const hidden = photo.visible === false;
          return (
            <li
              key={photo.id}
              className={cx(
                'flex overflow-hidden rounded-lg border bg-canvas-elevated sm:flex-col',
                hidden ? 'border-dashed border-hairline-strong' : 'border-hairline-strong'
              )}
            >
              <div
                className="relative min-h-[7rem] w-28 flex-shrink-0 overflow-hidden bg-canvas sm:aspect-[4/3] sm:min-h-0 sm:w-full"
                style={{ backgroundColor: photo.dominantColor || undefined }}
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt=""
                  loading="lazy"
                  className={cx('absolute inset-0 h-full w-full object-cover', hidden && 'opacity-40')}
                />
                <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                  {photo.featured && (
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-[#0D0C0B]">Featured</span>
                  )}
                  {hidden && <span className="rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-ink-light">Hidden</span>}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate font-serif text-base text-ink-light" title={photo.title}>
                    {photo.title}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {label(photo.category)}
                    {usage[photo.id] && <span className="text-accent"> · {usage[photo.id].join(', ')}</span>}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <IconButton
                    label={photo.featured ? `Unfeature ${photo.title}` : `Feature ${photo.title}`}
                    tone={photo.featured ? 'active' : 'default'}
                    aria-pressed={photo.featured}
                    disabled={busy}
                    onClick={() => patchPhoto(photo, { featured: !photo.featured })}
                  >
                    <Star size={15} fill={photo.featured ? 'currentColor' : 'none'} />
                  </IconButton>
                  <IconButton
                    label={hidden ? `Show ${photo.title} on the website` : `Hide ${photo.title} from the website`}
                    tone={hidden ? 'default' : 'active'}
                    aria-pressed={!hidden}
                    disabled={busy}
                    onClick={() => patchPhoto(photo, { visible: hidden })}
                  >
                    {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                  </IconButton>
                  <IconButton label={`Move ${photo.title} earlier`} disabled={reordering || i === 0} onClick={() => move(photo, -1)}>
                    <ArrowUp size={15} />
                  </IconButton>
                  <IconButton label={`Move ${photo.title} later`} disabled={reordering || i === view.length - 1} onClick={() => move(photo, 1)}>
                    <ArrowDown size={15} />
                  </IconButton>
                  <IconButton label={`Edit ${photo.title}`} disabled={busy} onClick={() => setEditing(photo)}>
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton label={`Delete ${photo.title}`} tone="danger" disabled={busy} onClick={() => remove(photo)}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-faint">
        Featured photos are highlighted on the home page — for example in the hero when you have not picked hero photos in Website text.
      </p>

      {editing && (
        <EditPhotoModal
          photo={editing}
          categoryLabel={label}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            const ok = await patchPhoto(editing, draft);
            if (ok) setEditing(null);
            return ok;
          }}
        />
      )}
    </div>
  );
};

const EditPhotoModal: React.FC<{
  photo: PhotoItem;
  categoryLabel: (c: PhotoCategory) => string;
  onClose: () => void;
  onSave: (draft: EditDraft) => Promise<boolean>;
}> = ({ photo, categoryLabel, onClose, onSave }) => {
  const [draft, setDraft] = useState<EditDraft>(() => toDraft(photo));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'title' | 'alt', string>>>({});
  const set = <K extends keyof EditDraft>(k: K, v: EditDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(photo));

  const close = () => {
    if (dirty && !window.confirm('Discard your changes to this photo?')) return;
    onClose();
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs: typeof errors = {};
    if (!draft.title.trim()) errs.title = 'Please add a title.';
    if (!draft.alt.trim()) errs.alt = 'Please describe the photo.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    await onSave({
      ...draft,
      title: draft.title.trim(),
      alt: draft.alt.trim(),
      subtitle: draft.subtitle.trim(),
      caption: draft.caption.trim(),
    });
    setSaving(false);
  };

  return (
    <Modal
      title="Edit photo"
      subtitle={photo.title}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={() => save()} busy={saving} disabled={!dirty}>
            Save changes
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <img src={photo.thumbnailUrl || photo.url} alt="" className="max-h-56 w-full rounded object-contain" style={{ backgroundColor: photo.dominantColor }} />
        <TextField label="Title" required value={draft.title} error={errors.title} onChange={(v) => set('title', v)} />
        <TextField label="Subtitle" value={draft.subtitle} onChange={(v) => set('subtitle', v)} />
        <TextAreaField label="Caption" value={draft.caption} onChange={(v) => set('caption', v)} />
        <TextField
          label="Description (alt text)"
          required
          value={draft.alt}
          error={errors.alt}
          hint="Read aloud to people using screen readers, and used by search engines."
          onChange={(v) => set('alt', v)}
        />
        <SelectField
          label="Category"
          value={draft.category}
          options={PHOTO_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))}
          onChange={(v) => set('category', v as PhotoCategory)}
        />
        <div className="flex flex-wrap gap-6">
          <Toggle label="Show on website" checked={draft.visible} onChange={(v) => set('visible', v)} />
          <Toggle label="Featured" checked={draft.featured} onChange={(v) => set('featured', v)} />
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
};
