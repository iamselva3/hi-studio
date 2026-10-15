import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PhotoItem } from '@/types';
import { Picture } from './Picture';

interface LightboxProps {
  photos: PhotoItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ photos, currentIndex, isOpen, onClose, onNavigate }) => {
  const photo = photos[currentIndex];
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const [shown, setShown] = useState(false);
  const count = photos.length;
  const go = (delta: number) => count && onNavigate((currentIndex + delta + count) % count);

  useEffect(() => {
    if (!isOpen) {
      setShown(false);
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!isOpen || !photo) return null;

  return (
    <div
      className={`fixed inset-0 z-[10000] bg-canvas/[0.97] flex flex-col transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="flex items-center justify-between px-4 sm:px-8 h-16 shrink-0 text-sm text-ink-faint">
        <span className="tabular-nums">
          {currentIndex + 1} / {count}
        </span>
        <button
          ref={closeRef}
          onClick={onClose}
          className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-full text-ink-light hover:text-accent"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 sm:px-20" onClick={onClose}>
        <div
          key={photo.id}
          className="max-h-full animate-fade-in"
          style={{ width: `min(100%, calc((100vh - 11rem) * ${photo.width / photo.height}))` }}
          onClick={(e) => e.stopPropagation()}
        >
          <Picture photo={photo} sizes="90vw" eager natural className="w-full" />
        </div>

        {count > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="hidden sm:inline-flex absolute left-4 w-12 h-12 items-center justify-center rounded-full text-ink-faint hover:text-ink-light"
              aria-label="Previous photo"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="hidden sm:inline-flex absolute right-4 w-12 h-12 items-center justify-center rounded-full text-ink-faint hover:text-ink-light"
              aria-label="Next photo"
            >
              <ChevronRight size={28} />
            </button>
          </>
        )}
      </div>

      <div className="shrink-0 px-4 sm:px-8 py-5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <p className="font-serif text-xl text-ink-light">{photo.title}</p>
        {(photo.caption || photo.subtitle) && <p className="text-sm text-ink-faint max-w-xl">{photo.caption || photo.subtitle}</p>}
      </div>
    </div>
  );
};
