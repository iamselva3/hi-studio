import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from 'lucide-react';
import { PhotoItem } from '@/types';
import { useAdminData } from './AdminDataContext';
import { Button, ErrorBanner, IconButton, Modal, Spinner, cx, inputClass } from './ui';

/* ------------------------------------------------------------------ */
/* Ordered list editor                                                 */
/* ------------------------------------------------------------------ */

export function ListEditor<T>({
  items,
  onChange,
  renderItem,
  makeItem,
  itemLabel,
  addLabel,
  max,
  min = 0,
  emptyText,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  renderItem: (item: T, update: (next: T) => void, index: number) => React.ReactNode;
  makeItem: () => T;
  itemLabel: (item: T, index: number) => string;
  addLabel: string;
  max?: number;
  min?: number;
  emptyText?: string;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.length === 0 && emptyText && <p className="text-sm text-ink-faint">{emptyText}</p>}
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded-md border border-hairline-strong bg-canvas p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">{itemLabel(item, i)}</span>
              <div className="flex gap-1.5">
                <IconButton label={`Move ${itemLabel(item, i)} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton label={`Move ${itemLabel(item, i)} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown size={14} />
                </IconButton>
                <IconButton
                  label={`Remove ${itemLabel(item, i)}`}
                  tone="danger"
                  disabled={items.length <= min}
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
            {renderItem(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))), i)}
          </li>
        ))}
      </ol>
      {(max === undefined || items.length < max) && (
        <Button onClick={() => onChange([...items, makeItem()])}>
          <Plus size={14} aria-hidden /> {addLabel}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Photo picker                                                        */
/* ------------------------------------------------------------------ */

const Thumb: React.FC<{ photo?: PhotoItem; id: string; className?: string }> = ({ photo, id, className }) =>
  photo ? (
    <img
      src={photo.thumbnailUrl || photo.url}
      alt=""
      className={cx('h-full w-full object-cover', className)}
      style={{ backgroundColor: photo.dominantColor }}
      loading="lazy"
    />
  ) : (
    <div className={cx('flex h-full w-full items-center justify-center bg-red-950/40 p-1 text-center text-[10px] text-red-200', className)} title={id}>
      Hidden or deleted
    </div>
  );

/** Choose photos from the library (visible photos only, since hidden ones never reach the site). */
export const PhotoPicker: React.FC<{
  label: string;
  hint?: React.ReactNode;
  value: string[];
  onChange: (ids: string[]) => void;
  max: number;
}> = ({ label, hint, value, onChange, max }) => {
  const { photos, photosState, photosError, loadPhotos } = useAdminData();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const visible = useMemo(() => photos.filter((p) => p.visible !== false), [photos]);
  const byId = useMemo(() => new Map(visible.map((p) => [p.id, p])), [visible]);
  const single = max === 1;
  const labelId = React.useId();

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2" role="group" aria-labelledby={labelId}>
      <p id={labelId} className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      {hint && <p className="text-xs text-ink-faint/80">{hint}</p>}
      {photosState === 'error' && <ErrorBanner message={photosError} onRetry={() => loadPhotos(true)} />}

      {value.length > 0 && (
        <ol className="flex flex-wrap gap-3">
          {value.map((id, i) => {
            const p = byId.get(id);
            const name = p?.title || 'missing photo';
            return (
              <li key={`${id}-${i}`} className="w-28 overflow-hidden rounded border border-hairline-strong bg-canvas">
                <div className="relative aspect-[4/5]">
                  <Thumb photo={p} id={id} />
                  {!single && (
                    <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 text-[10px] text-white">{i + 1}</span>
                  )}
                </div>
                <p className="truncate px-1.5 pt-1 text-[11px] text-ink-faint" title={name}>
                  {name}
                </p>
                <div className="flex justify-between p-1">
                  {!single && (
                    <>
                      <IconButton label={`Move ${name} earlier`} className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp size={12} className="-rotate-90" />
                      </IconButton>
                      <IconButton label={`Move ${name} later`} className="h-7 w-7" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown size={12} className="-rotate-90" />
                      </IconButton>
                    </>
                  )}
                  <IconButton label={`Remove ${name}`} tone="danger" className="h-7 w-7" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                    <X size={12} />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Button onClick={() => setOpen(true)} disabled={!single && value.length >= max}>
        {single ? (value.length ? 'Change photo' : 'Choose photo') : value.length >= max ? `Maximum ${max} photos` : 'Add photos'}
      </Button>

      {open && (
        <PickerModal
          title={single ? 'Choose a photo' : `Choose up to ${max} photos`}
          photos={visible}
          loading={photosState === 'loading' || photosState === 'idle'}
          initial={value}
          max={max}
          onClose={() => setOpen(false)}
          onDone={(ids) => {
            onChange(ids);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
};

const PickerModal: React.FC<{
  title: string;
  photos: PhotoItem[];
  loading: boolean;
  initial: string[];
  max: number;
  onClose: () => void;
  onDone: (ids: string[]) => void;
}> = ({ title, photos, loading, initial, max, onClose, onDone }) => {
  const [selected, setSelected] = useState<string[]>(initial);
  const [search, setSearch] = useState('');
  const single = max === 1;
  const term = search.trim().toLowerCase();
  const list = term ? photos.filter((p) => `${p.title} ${p.alt} ${p.category}`.toLowerCase().includes(term)) : photos;

  const toggle = (id: string) => {
    if (single) {
      onDone([id]);
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= max ? prev : [...prev, id]));
  };

  return (
    <Modal
      title={title}
      subtitle={single ? 'Only photos shown on the website can be picked.' : `${selected.length} of ${max} chosen. Only photos shown on the website can be picked.`}
      onClose={onClose}
      size="xl"
      footer={
        single ? (
          <Button onClick={onClose}>Cancel</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => onDone(selected)}>
              Use {selected.length} photo{selected.length === 1 ? '' : 's'}
            </Button>
          </>
        )
      }
    >
      <label className="block">
        <span className="sr-only">Search photos</span>
        <input type="search" className={inputClass} placeholder="Search photos" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {loading && <Spinner label="Loading photos…" />}
      {!loading && list.length === 0 && <p className="text-sm text-ink-faint">No photos found.</p>}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {list.map((p) => {
          const idx = selected.indexOf(p.id);
          const on = idx >= 0;
          const full = !single && !on && selected.length >= max;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => toggle(p.id)}
                className={cx(
                  'relative block aspect-[4/5] w-full overflow-hidden rounded border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40',
                  on ? 'border-accent' : 'border-transparent hover:border-hairline-strong'
                )}
                title={p.title}
              >
                <Thumb photo={p} id={p.id} />
                <span className="sr-only">{p.title}</span>
                {on && (
                  <span className="absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-[#0D0C0B]">
                    {single ? <Check size={13} /> : idx + 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
};
