import React, { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDialog } from './useDialog';
import { parseSizeInches } from './catalog';
import { finishSwatch } from './ui';

interface RoomMockupModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  frameTitle: string;
  finish: string;
  /** Variant size, e.g. "16x24 in". */
  size: string;
  mat?: boolean;
  /** Photo orientation, so a landscape print hangs landscape. */
  landscape?: boolean;
}

const WALLS = [
  { id: 'white', label: 'White wall', wall: '#ECE6DB', floor: '#9C7A57', sofa: '#7E786E' },
  { id: 'grey', label: 'Grey wall', wall: '#C9C5BE', floor: '#7D6247', sofa: '#4F4A44' },
  { id: 'dark', label: 'Dark wall', wall: '#2E2B27', floor: '#5B4532', sofa: '#A59D90' },
] as const;

// Assumptions for drawing only (stated as approximate under the picture).
const SOFA_W = 84;
const SOFA_H = 33;
const GAP_ABOVE_SOFA = 9;
const MOULDING = 1.25;
const MAT = 2.5;

const Sofa: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="0 0 84 33" className="w-full h-full" aria-hidden="true">
    <rect x="0" y="12" width="9" height="17" rx="2.5" fill={color} />
    <rect x="75" y="12" width="9" height="17" rx="2.5" fill={color} />
    <rect x="5" y="2" width="74" height="17" rx="3" fill={color} />
    <rect x="5" y="2" width="74" height="17" rx="3" fill="black" opacity="0.12" />
    <rect x="7" y="17" width="70" height="9" rx="2" fill={color} />
    <line x1="42" y1="4" x2="42" y2="18" stroke="black" strokeOpacity="0.15" strokeWidth="0.4" />
    <line x1="42" y1="18" x2="42" y2="25" stroke="black" strokeOpacity="0.15" strokeWidth="0.4" />
    <rect x="0" y="26" width="84" height="3.5" rx="1" fill="black" opacity="0.18" />
    <rect x="6" y="29" width="2" height="4" fill="#2b2622" />
    <rect x="76" y="29" width="2" height="4" fill="#2b2622" />
  </svg>
);

/** "See it on a wall": the framed print drawn to scale above a sofa. */
export const RoomMockupModal: React.FC<RoomMockupModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  frameTitle,
  finish,
  size,
  mat = true,
  landscape = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [wallId, setWallId] = useState<(typeof WALLS)[number]['id']>('white');
  const [stage, setStage] = useState({ w: 0, h: 0 });
  useDialog(isOpen, dialogRef, onClose);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  if (!isOpen) return null;

  const wall = WALLS.find((w) => w.id === wallId) ?? WALLS[0];
  const isCanvas = /canvas|gallery wrap/i.test(finish);
  const inches = parseSizeInches(size) ?? [16, 24];
  const [shortIn, longIn] = [Math.min(...inches), Math.max(...inches)];
  const printW = landscape ? longIn : shortIn;
  const printH = landscape ? shortIn : longIn;
  const border = isCanvas ? 0 : MOULDING + (mat ? MAT : 0);
  const frameW = printW + border * 2;
  const frameH = printH + border * 2;

  // Fit sofa + frame + some wall around them into the stage.
  const floorPx = stage.h * 0.86;
  // Narrow screens: less wall either side, so the piece isn't tiny.
  const side = stage.w < 600 ? 8 : 30;
  const needW = Math.max(SOFA_W + side, frameW + side);
  const needH = SOFA_H + GAP_ABOVE_SOFA + frameH + 14;
  const ppi = stage.w ? Math.min(stage.w / needW, floorPx / needH) : 0;
  const sofaW = SOFA_W * ppi;
  const sofaH = SOFA_H * ppi;
  const frameBottom = stage.h - floorPx + (SOFA_H + GAP_ABOVE_SOFA) * ppi;
  const wood = finishSwatch(finish) || '#8a5a2e';

  return (
    <div className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center sm:p-6">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-title"
        className="relative w-full sm:max-w-5xl bg-canvas-elevated text-ink-light rounded-t-[8px] sm:rounded-[4px] shadow-2xl flex flex-col max-h-[100dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-4 pb-3">
          <div className="pt-2">
            <h2 id="room-title" className="font-serif text-2xl leading-tight">
              {frameTitle} on a wall
            </h2>
            <p className="text-sm text-ink-faint mt-1">
              {size} · {finish}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 -mr-2 flex items-center justify-center text-ink-faint hover:text-ink-light rounded-[3px]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div
          ref={stageRef}
          className="relative w-full h-[min(52vh,440px)] sm:h-auto sm:aspect-[16/9] overflow-hidden transition-colors duration-500"
          style={{
            backgroundColor: wall.wall,
            backgroundImage: 'radial-gradient(90% 70% at 50% 0%, rgba(255,250,240,0.22), transparent 70%)',
          }}
        >
          {/* Floor and skirting */}
          <div className="absolute inset-x-0 bottom-0" style={{ height: stage.h - floorPx, backgroundColor: wall.floor }}>
            <div className="absolute inset-x-0 top-0 h-[3px] bg-black/15" />
          </div>

          {ppi > 0 && (
            <>
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ width: sofaW, height: sofaH, bottom: stage.h - floorPx - 2 }}
              >
                <Sofa color={wall.sofa} />
              </div>

              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  width: frameW * ppi,
                  height: frameH * ppi,
                  bottom: frameBottom,
                  backgroundColor: isCanvas ? '#111' : wood,
                  padding: isCanvas ? 0 : MOULDING * ppi,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.25), 0 12px 24px -6px rgba(0,0,0,0.45)',
                }}
              >
                <div
                  className="w-full h-full overflow-hidden"
                  style={{
                    padding: !isCanvas && mat ? MAT * ppi : 0,
                    backgroundColor: '#F2EDE2',
                    boxShadow: isCanvas ? 'none' : 'inset 0 1px 3px rgba(0,0,0,0.35)',
                  }}
                >
                  <img src={imageUrl} alt={`${frameTitle} preview`} className="w-full h-full object-cover" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[13px] text-ink-faint max-w-[60ch]">
            Drawn to scale above a 7-foot sofa. Frame and mat widths are approximate.
          </p>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Wall colour">
            {WALLS.map((w) => (
              <button
                key={w.id}
                type="button"
                role="radio"
                aria-checked={wallId === w.id}
                aria-label={w.label}
                title={w.label}
                onClick={() => setWallId(w.id)}
                className="w-11 h-11 flex items-center justify-center rounded-full"
              >
                <span
                  className={`w-7 h-7 rounded-full border ${wallId === w.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas-elevated border-transparent' : 'border-hairline-strong'}`}
                  style={{ backgroundColor: w.wall }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
