import React, { forwardRef, useRef, useState } from 'react';
import { AlertCircle, Check, ImagePlus, RotateCcw, X } from 'lucide-react';
import { ACCEPT_ATTR } from './uploads';
import { PhotoEntry, PhotoUploads } from './usePhotoUploads';

interface PhotoUploaderProps {
  uploads: PhotoUploads;
  /** Visible heading for the control. */
  label: string;
  hint?: React.ReactNode;
  /** Minimum photos needed (multi mode), shown as "7 of 10 photos uploaded". */
  min?: number;
  className?: string;
}

const statusText = (e: PhotoEntry) => {
  switch (e.status) {
    case 'preparing':
      return 'Preparing…';
    case 'queued':
      return 'Waiting to upload…';
    case 'uploading':
      return `Uploading… ${Math.round(e.progress * 100)}%`;
    case 'done':
      return 'Uploaded';
    default:
      return e.error || 'Upload failed';
  }
};

const ProgressBar: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => (
  <div className={`h-1 bg-hairline-strong rounded-full overflow-hidden ${className}`} aria-hidden="true">
    <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(value * 100)}%` }} />
  </div>
);

/**
 * Drop zone + file picker for customer photos. Single mode (max 1) shows one row with
 * replace/remove; multi mode shows a grid of thumbnails with per-photo progress, retry and remove.
 */
export const PhotoUploader = forwardRef<HTMLButtonElement, PhotoUploaderProps>(
  ({ uploads, label, hint, min, className = '' }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const multi = uploads.max > 1;
    const { entries } = uploads;
    const full = multi && entries.length >= uploads.max;

    const pick = () => inputRef.current?.click();

    const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      uploads.addFiles(e.dataTransfer.files);
    };

    const countLine = multi
      ? min && uploads.doneCount < min
        ? `${uploads.doneCount} of ${min} photos uploaded`
        : `${uploads.doneCount} ${uploads.doneCount === 1 ? 'photo' : 'photos'} uploaded`
      : '';

    return (
      <div className={className}>
        <div className="flex items-baseline justify-between gap-4 mb-2.5">
          <h3 className="text-sm text-ink-faint">{label}</h3>
          {multi && (entries.length > 0 || !!min) && (
            <span className="text-sm text-ink-light tabular-nums" aria-live="polite">
              {countLine}
            </span>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple={multi}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            uploads.addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {(!entries.length || multi) && !full && (
          <button
            ref={ref}
            type="button"
            onClick={pick}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`w-full flex items-center gap-4 text-left rounded-[3px] border border-dashed px-5 transition-colors ${
              entries.length ? 'py-4' : 'py-6'
            } ${dragging ? 'border-accent bg-accent/[0.06]' : 'border-hairline-strong hover:border-accent'}`}
          >
            <ImagePlus size={22} className="text-accent flex-shrink-0" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-[15px] text-ink-light">
                {multi ? (entries.length ? 'Add more photos' : 'Choose photos') : 'Choose a photo'}
                <span className="hidden sm:inline text-ink-faint"> or drop {multi ? 'them' : 'it'} here</span>
              </span>
              <span className="text-[13px] text-ink-faint mt-0.5">JPEG, PNG or WebP, up to 25 MB each</span>
            </span>
          </button>
        )}

        {uploads.notice && (
          <p className="mt-2 text-[13px] text-red-400" role="alert">
            {uploads.notice}
          </p>
        )}

        {!multi &&
          entries.map((e) => (
            <div key={e.id} className="flex items-center gap-4 py-2">
              <div className="w-16 h-16 rounded-[2px] overflow-hidden bg-canvas-surface flex-shrink-0">
                {e.thumbUrl && <img src={e.thumbUrl} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-ink-light truncate">{e.name}</p>
                <p
                  className={`text-[13px] mt-0.5 flex items-center gap-1.5 ${e.status === 'error' ? 'text-red-400' : 'text-ink-faint'}`}
                  aria-live="polite"
                >
                  {e.status === 'done' && <Check size={14} className="text-accent" aria-hidden="true" />}
                  {statusText(e)}
                </p>
                {(e.status === 'uploading' || e.status === 'queued') && <ProgressBar value={e.progress} className="mt-2" />}
                <div className="flex flex-wrap gap-x-5 mt-1">
                  {e.status === 'error' && (
                    <button type="button" onClick={() => uploads.retry(e.id)} className="link-line min-h-[44px]">
                      Retry
                    </button>
                  )}
                  <button ref={ref} type="button" onClick={pick} className="link-line min-h-[44px]">
                    Choose another photo
                  </button>
                </div>
              </div>
            </div>
          ))}

        {multi && entries.length > 0 && (
          <>
            <ul className="mt-4 grid grid-cols-4 sm:grid-cols-5 gap-2" aria-label="Your photos">
              {entries.map((e, i) => (
                <li key={e.id} className="relative aspect-square rounded-[2px] overflow-hidden bg-canvas-surface">
                  {e.thumbUrl && <img src={e.thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  {e.status !== 'done' && e.status !== 'error' && (
                    <div className="absolute inset-0 bg-black/35 flex items-end p-1.5">
                      <ProgressBar value={e.status === 'uploading' ? e.progress : 0} className="w-full" />
                    </div>
                  )}
                  {e.status === 'done' && (
                    <span className="absolute left-1.5 bottom-1.5 w-5 h-5 rounded-full bg-accent text-canvas flex items-center justify-center">
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                  )}
                  {e.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => uploads.retry(e.id)}
                      className="absolute inset-0 bg-black/60 text-white flex flex-col items-center justify-center gap-1 text-[12px]"
                      title={e.error}
                      aria-label={`Retry photo ${i + 1}: ${e.error || 'upload failed'}`}
                    >
                      <AlertCircle size={16} aria-hidden="true" />
                      <span className="flex items-center gap-1">
                        <RotateCcw size={11} aria-hidden="true" /> Retry
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => uploads.remove(e.id)}
                    className="absolute top-0 right-0 w-11 h-11 flex items-start justify-end p-1.5"
                    aria-label={`Remove photo ${i + 1} (${e.name})`}
                  >
                    <span className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <X size={13} aria-hidden="true" />
                    </span>
                  </button>
                  <span className="sr-only">{statusText(e)}</span>
                </li>
              ))}
            </ul>
            {uploads.failedCount > 0 && (
              <p className="mt-3 text-[13px] text-red-400 flex flex-wrap items-center gap-x-3">
                <span>
                  {uploads.failedCount} {uploads.failedCount === 1 ? 'photo' : 'photos'} didn’t upload.
                  {(() => {
                    const first = entries.find((e) => e.status === 'error');
                    return first?.error ? ` ${first.error}` : '';
                  })()}
                </span>
                <button type="button" onClick={uploads.retryAll} className="link-line min-h-[44px] !text-red-400">
                  Retry all
                </button>
              </p>
            )}
          </>
        )}

        {hint && <div className="mt-2.5 text-[13px] text-ink-faint leading-relaxed">{hint}</div>}
      </div>
    );
  }
);
PhotoUploader.displayName = 'PhotoUploader';
