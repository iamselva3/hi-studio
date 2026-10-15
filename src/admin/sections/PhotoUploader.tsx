import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Trash2, Upload } from 'lucide-react';
import { PhotoCategory, PhotoItem } from '@/types';
import { useSiteData } from '@/context/SiteDataContext';
import { useAdminData } from '../AdminDataContext';
import { processPortfolioPhoto, ACCEPTED_IMAGE_TYPES } from '../lib/images';
import { uploadWithProgress } from '../lib/upload';
import { Button, Card, IconButton, SelectField, TextAreaField, TextField, Toggle, cx, errorMessage } from '../ui';

export const PHOTO_CATEGORIES: PhotoCategory[] = ['weddings', 'baby', 'candid', 'portraits'];

type Status = 'ready' | 'processing' | 'uploading' | 'done' | 'error';

interface QueueItem {
  key: string;
  file: File;
  preview: string;
  title: string;
  alt: string;
  altTouched: boolean;
  subtitle: string;
  caption: string;
  category: PhotoCategory | '';
  featured: boolean;
  visible: boolean;
  status: Status;
  progress: number;
  error: string | null;
  fieldErrors: Partial<Record<'title' | 'alt' | 'category', string>>;
}

let keySeq = 0;

/** Lets the owner pick photos, describe them, and uploads them one by one with progress. */
export const PhotoUploader = React.forwardRef<{ addFiles: (files: FileList | File[]) => void }, { defaultCategory: PhotoCategory | '' }>(
  ({ defaultCategory }, ref) => {
    const { settings } = useSiteData();
    const { commitPhotos, refreshSummary } = useAdminData();
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [running, setRunning] = useState(false);
    const [rejected, setRejected] = useState<string[]>([]);
    const queueRef = useRef(queue);
    queueRef.current = queue;

    // Free preview memory when the uploader goes away.
    useEffect(() => () => queueRef.current.forEach((q) => URL.revokeObjectURL(q.preview)), []);

    const addFiles = (files: FileList | File[]) => {
      const list = Array.from(files);
      const bad = list.filter((f) => !ACCEPTED_IMAGE_TYPES.includes(f.type)).map((f) => f.name);
      setRejected(bad);
      const good = list.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
      setQueue((prev) => [
        ...prev,
        ...good.map<QueueItem>((file) => ({
          key: `up-${++keySeq}`,
          file,
          preview: URL.createObjectURL(file),
          title: '',
          alt: '',
          altTouched: false,
          subtitle: '',
          caption: '',
          category: defaultCategory,
          featured: false,
          visible: true,
          status: 'ready',
          progress: 0,
          error: null,
          fieldErrors: {},
        })),
      ]);
    };

    React.useImperativeHandle(ref, () => ({ addFiles }));

    const update = (key: string, patch: Partial<QueueItem>) =>
      setQueue((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));

    const remove = (key: string) =>
      setQueue((prev) => {
        const item = prev.find((q) => q.key === key);
        if (item) URL.revokeObjectURL(item.preview);
        return prev.filter((q) => q.key !== key);
      });

    const validate = (q: QueueItem) => {
      const errs: QueueItem['fieldErrors'] = {};
      if (!q.title.trim()) errs.title = 'Please add a title.';
      if (!q.alt.trim()) errs.alt = 'Please describe the photo.';
      if (!q.category) errs.category = 'Please choose a category.';
      return errs;
    };

    const uploadOne = async (q: QueueItem) => {
      update(q.key, { status: 'processing', progress: 0, error: null });
      try {
        const processed = await processPortfolioPhoto(q.file);
        update(q.key, { status: 'uploading' });
        const form = new FormData();
        form.append(
          'meta',
          JSON.stringify({
            title: q.title.trim(),
            subtitle: q.subtitle.trim() || undefined,
            caption: q.caption.trim() || undefined,
            alt: q.alt.trim(),
            category: q.category,
            featured: q.featured,
            visible: q.visible,
            width: processed.width,
            height: processed.height,
            dominantColor: processed.dominantColor,
            lqip: processed.lqip || undefined,
          })
        );
        form.append('w480', processed.files.w480, 'w480.webp');
        form.append('w1200', processed.files.w1200, 'w1200.webp');
        if (processed.files.w2000) form.append('w2000', processed.files.w2000, 'w2000.webp');
        const photo = await uploadWithProgress<PhotoItem>('/api/admin/photos', form, (f) => update(q.key, { progress: f }));
        if (!photo || !photo.id) throw new Error('The server did not confirm the upload.');
        commitPhotos((prev) => [...prev.filter((p) => p.id !== photo.id), photo]);
        update(q.key, { status: 'done', progress: 1 });
        return true;
      } catch (err) {
        update(q.key, { status: 'error', error: errorMessage(err) });
        return false;
      }
    };

    const uploadAll = async () => {
      const pending = queueRef.current.filter((q) => q.status === 'ready' || q.status === 'error');
      let invalid = false;
      pending.forEach((q) => {
        const errs = validate(q);
        update(q.key, { fieldErrors: errs });
        if (Object.keys(errs).length) invalid = true;
      });
      if (invalid) return;
      setRunning(true);
      for (const q of pending) {
        // Re-read the latest edits for this item before sending.
        const latest = queueRef.current.find((x) => x.key === q.key);
        if (latest) await uploadOne(latest);
      }
      setRunning(false);
      refreshSummary();
    };

    const clearDone = () =>
      setQueue((prev) => {
        prev.filter((q) => q.status === 'done').forEach((q) => URL.revokeObjectURL(q.preview));
        return prev.filter((q) => q.status !== 'done');
      });

    if (!queue.length && !rejected.length) return null;

    const waiting = queue.filter((q) => q.status === 'ready' || q.status === 'error').length;
    const done = queue.filter((q) => q.status === 'done').length;
    const categoryOptions = [
      { value: '', label: 'Choose…' },
      ...PHOTO_CATEGORIES.map((c) => ({ value: c, label: settings.portfolio[c]?.label || c })),
    ];

    return (
      <Card
        title="New photos"
        description="Give each photo a title, a short description for people using screen readers, and a category. Photos are resized automatically before they are uploaded."
        actions={
          <>
            {done > 0 && !running && (
              <Button size="sm" variant="ghost" onClick={clearDone}>
                Clear finished
              </Button>
            )}
            <Button variant="primary" onClick={uploadAll} busy={running} disabled={!waiting}>
              <Upload size={14} aria-hidden />
              {running ? 'Uploading…' : `Upload ${waiting || ''} photo${waiting === 1 ? '' : 's'}`}
            </Button>
          </>
        }
      >
        {rejected.length > 0 && (
          <p className="mb-4 text-sm text-red-300" role="alert">
            Skipped {rejected.join(', ')} — only JPEG, PNG or WebP images can be uploaded.
          </p>
        )}
        <ul className="space-y-4">
          {queue.map((q) => {
            const locked = q.status === 'processing' || q.status === 'uploading' || q.status === 'done';
            return (
              <li key={q.key} className="rounded-md border border-hairline-strong bg-canvas p-3 sm:p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="w-full flex-shrink-0 sm:w-40">
                    <img src={q.preview} alt="" className="h-40 w-full rounded object-cover sm:h-32" />
                    <p className="mt-1 truncate text-xs text-ink-faint" title={q.file.name}>
                      {q.file.name} · {(q.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <TextField
                      label="Title"
                      required
                      value={q.title}
                      disabled={locked}
                      error={q.fieldErrors.title}
                      placeholder="e.g. Muhurtham at dawn"
                      onChange={(v) =>
                        update(q.key, {
                          title: v,
                          alt: q.altTouched ? q.alt : v,
                          fieldErrors: { ...q.fieldErrors, title: undefined, alt: q.altTouched ? q.fieldErrors.alt : undefined },
                        })
                      }
                    />
                    <SelectField
                      label="Category"
                      required
                      value={q.category}
                      disabled={locked}
                      error={q.fieldErrors.category}
                      options={categoryOptions}
                      onChange={(v) => update(q.key, { category: v as PhotoCategory, fieldErrors: { ...q.fieldErrors, category: undefined } })}
                    />
                    <TextField
                      label="Description (alt text)"
                      required
                      fieldClassName="sm:col-span-2"
                      value={q.alt}
                      disabled={locked}
                      error={q.fieldErrors.alt}
                      hint="Describe what is in the photo, e.g. “Bride and groom exchanging garlands in the mandap”."
                      onChange={(v) => update(q.key, { alt: v, altTouched: true, fieldErrors: { ...q.fieldErrors, alt: undefined } })}
                    />
                    <TextField label="Subtitle (optional)" value={q.subtitle} disabled={locked} onChange={(v) => update(q.key, { subtitle: v })} />
                    <TextAreaField
                      label="Caption (optional)"
                      rows={1}
                      value={q.caption}
                      disabled={locked}
                      onChange={(v) => update(q.key, { caption: v })}
                    />
                    <div className="flex flex-wrap gap-6 sm:col-span-2">
                      <Toggle label="Show on website" checked={q.visible} disabled={locked} onChange={(v) => update(q.key, { visible: v })} />
                      <Toggle label="Featured" checked={q.featured} disabled={locked} onChange={(v) => update(q.key, { featured: v })} />
                    </div>
                  </div>
                  <div className="flex items-start justify-end sm:w-10">
                    {!locked && (
                      <IconButton label={`Remove ${q.file.name} from the list`} tone="danger" onClick={() => remove(q.key)}>
                        <Trash2 size={15} />
                      </IconButton>
                    )}
                  </div>
                </div>

                {(q.status !== 'ready' || q.error) && (
                  <div className="mt-3" aria-live="polite">
                    {q.status === 'processing' && <p className="text-sm text-ink-faint">Preparing image sizes…</p>}
                    {q.status === 'uploading' && (
                      <div>
                        <div className="h-2 overflow-hidden rounded bg-canvas-surface" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(q.progress * 100)} aria-label={`Uploading ${q.file.name}`}>
                          <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(q.progress * 100)}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">Uploading… {Math.round(q.progress * 100)}%</p>
                      </div>
                    )}
                    {q.status === 'done' && (
                      <p className="inline-flex items-center gap-1.5 text-sm text-emerald-300">
                        <CheckCircle2 size={15} aria-hidden /> Uploaded{q.visible ? ' and live on the website' : ' (hidden from the website)'}
                      </p>
                    )}
                    {q.status === 'error' && (
                      <p className={cx('text-sm text-red-300')} role="alert">
                        Upload failed: {q.error}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    );
  }
);
PhotoUploader.displayName = 'PhotoUploader';
