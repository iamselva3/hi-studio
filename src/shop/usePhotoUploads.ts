import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PreparedPhoto, UploadError, preparePhoto, rejectReason, uploadPhoto } from './uploads';

export type PhotoStatus = 'preparing' | 'queued' | 'uploading' | 'done' | 'error';

export interface PhotoEntry {
  id: string;
  name: string;
  status: PhotoStatus;
  progress: number;
  error?: string;
  /** Storage key once uploaded. */
  key?: string;
  /** Tiny data URL (≤ 320px). */
  thumbUrl?: string;
  /** Object URL of a ~1600px copy (only when `withPreview`). */
  previewUrl?: string;
  width?: number;
  height?: number;
  originalWidth?: number;
  originalHeight?: number;
  resized?: boolean;
}

type Phase = 'waitPrep' | 'prepping' | 'waitUpload' | 'uploading' | 'done' | 'failedPrep' | 'failedUpload';

interface Job {
  /** name + size + date, to skip a photo picked twice. */
  sig: string;
  file?: File;
  prepared?: PreparedPhoto;
  controller?: AbortController;
  phase: Phase;
  lastProgress: number;
}

interface Options {
  /** Most photos this uploader holds. With 1, a new pick replaces the current photo. */
  max: number;
  withPreview?: boolean;
  uploadConcurrency?: number;
}

const PREP_CONCURRENCY = 2;
const sigOf = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
let seq = 0;

/**
 * Picks, prepares and uploads customer photos in the background (a few at a time),
 * with per-photo progress, retry and remove.
 */
export function usePhotoUploads({ max, withPreview = false, uploadConcurrency = 3 }: Options) {
  const [entries, setEntries] = useState<PhotoEntry[]>([]);
  const [notice, setNotice] = useState('');
  const jobs = useRef(new Map<string, Job>());
  const running = useRef({ prep: 0, upload: 0 });
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const mounted = useRef(true);

  const update = useCallback((id: string, patch: Partial<PhotoEntry>) => {
    if (!mounted.current) return;
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const pumpRef = useRef<() => void>(() => {});

  const runPrep = useCallback(
    async (id: string, job: Job) => {
      try {
        const prepared = await preparePhoto(job.file as File, { withPreview });
        if (!jobs.current.has(id)) {
          if (prepared.previewUrl) URL.revokeObjectURL(prepared.previewUrl);
          return;
        }
        job.prepared = prepared;
        job.file = undefined;
        job.phase = 'waitUpload';
        update(id, {
          status: 'queued',
          thumbUrl: prepared.thumbUrl,
          previewUrl: prepared.previewUrl,
          width: prepared.width,
          height: prepared.height,
          originalWidth: prepared.originalWidth,
          originalHeight: prepared.originalHeight,
          resized: prepared.resized,
        });
      } catch (err) {
        job.phase = 'failedPrep';
        update(id, { status: 'error', error: (err as Error).message || 'Could not read this photo.' });
      } finally {
        running.current.prep--;
        pumpRef.current();
      }
    },
    [update, withPreview]
  );

  const runUpload = useCallback(
    async (id: string, job: Job) => {
      const controller = new AbortController();
      job.controller = controller;
      job.lastProgress = 0;
      update(id, { status: 'uploading', progress: 0, error: undefined });
      try {
        const key = await uploadPhoto(
          job.prepared as PreparedPhoto,
          (f) => {
            if (f === 1 || f - job.lastProgress >= 0.02) {
              job.lastProgress = f;
              update(id, { progress: f });
            }
          },
          controller.signal
        );
        if (!jobs.current.has(id)) return;
        job.phase = 'done';
        // The bytes are on the server now; let the browser free them.
        if (job.prepared) job.prepared = { ...job.prepared, blob: new Blob() };
        update(id, { status: 'done', progress: 1, key });
      } catch (err) {
        if (!jobs.current.has(id) || (err instanceof UploadError && err.status === -1)) return;
        job.phase = 'failedUpload';
        update(id, { status: 'error', error: (err as Error).message || 'Upload failed. Please retry.' });
      } finally {
        job.controller = undefined;
        running.current.upload--;
        pumpRef.current();
      }
    },
    [update]
  );

  pumpRef.current = () => {
    if (!mounted.current) return;
    for (const [id, job] of jobs.current) {
      if (job.phase === 'waitPrep' && running.current.prep < PREP_CONCURRENCY) {
        running.current.prep++;
        job.phase = 'prepping';
        void runPrep(id, job);
      } else if (job.phase === 'waitUpload' && running.current.upload < uploadConcurrency) {
        running.current.upload++;
        job.phase = 'uploading';
        void runUpload(id, job);
      }
    }
  };

  const dropJob = useCallback((id: string) => {
    const job = jobs.current.get(id);
    job?.controller?.abort();
    jobs.current.delete(id);
    const entry = entriesRef.current.find((e) => e.id === id);
    if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  }, []);

  const remove = useCallback(
    (id: string) => {
      dropJob(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setNotice('');
    },
    [dropJob]
  );

  const reset = useCallback(() => {
    Array.from(jobs.current.keys()).forEach(dropJob);
    setEntries([]);
    setNotice('');
  }, [dropJob]);

  const addFiles = useCallback(
    (list: FileList | File[] | null) => {
      const files = Array.from(list || []);
      if (!files.length) return;
      const rejected: string[] = [];
      const ok = files.filter((f) => {
        const reason = rejectReason(f);
        if (reason) rejected.push(reason);
        return !reason;
      });

      let toAdd = ok;
      const messages: string[] = [];
      if (max === 1) {
        if (ok.length) {
          Array.from(jobs.current.keys()).forEach(dropJob);
          entriesRef.current = [];
        }
        toAdd = ok.slice(0, 1);
      } else {
        const existing = new Set(Array.from(jobs.current.values()).map((j) => j.sig));
        const fresh = ok.filter((f) => !existing.has(sigOf(f)));
        if (fresh.length < ok.length) messages.push(`${ok.length - fresh.length} already added.`);
        const room = Math.max(0, max - entriesRef.current.length);
        if (fresh.length > room) messages.push(`You can add up to ${max} photos here; ${fresh.length - room} not added.`);
        toAdd = fresh.slice(0, room);
      }
      if (rejected.length) messages.unshift(rejected.length === 1 ? rejected[0] : `${rejected.length} files skipped: please use JPEG, PNG or WebP.`);
      setNotice(messages.join(' '));

      if (!toAdd.length) return;
      const added: PhotoEntry[] = toAdd.map((file) => {
        const id = `p${Date.now().toString(36)}${(seq++).toString(36)}`;
        jobs.current.set(id, { sig: sigOf(file), file, phase: 'waitPrep', lastProgress: 0 });
        return { id, name: file.name, status: 'preparing', progress: 0 };
      });
      setEntries((prev) => (max === 1 ? added : [...prev, ...added]));
      // Let React commit the new entries before work starts updating them.
      window.setTimeout(() => pumpRef.current(), 0);
    },
    [max, dropJob]
  );

  const retry = useCallback(
    (id: string) => {
      const job = jobs.current.get(id);
      if (!job) return;
      if (job.phase === 'failedUpload') {
        job.phase = 'waitUpload';
        update(id, { status: 'queued', error: undefined, progress: 0 });
      } else if (job.phase === 'failedPrep' && job.file) {
        job.phase = 'waitPrep';
        update(id, { status: 'preparing', error: undefined });
      } else return;
      pumpRef.current();
    },
    [update]
  );

  const retryAll = useCallback(() => {
    entriesRef.current.filter((e) => e.status === 'error').forEach((e) => retry(e.id));
  }, [retry]);

  useEffect(() => {
    mounted.current = true;
    const map = jobs.current;
    return () => {
      mounted.current = false;
      map.forEach((job) => job.controller?.abort());
      entriesRef.current.forEach((e) => e.previewUrl && URL.revokeObjectURL(e.previewUrl));
      map.clear();
    };
  }, []);

  const summary = useMemo(() => {
    const done = entries.filter((e) => e.status === 'done');
    return {
      done,
      keys: done.map((e) => e.key as string),
      doneCount: done.length,
      failedCount: entries.filter((e) => e.status === 'error').length,
      busy: entries.some((e) => e.status === 'preparing' || e.status === 'queued' || e.status === 'uploading'),
    };
  }, [entries]);

  return { entries, notice, addFiles, remove, retry, retryAll, reset, max, ...summary };
}

export type PhotoUploads = ReturnType<typeof usePhotoUploads>;
