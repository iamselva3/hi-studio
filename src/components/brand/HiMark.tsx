import React, { useId } from 'react';
import { HI_BOX, HI_DOT, HI_LINE_WIDTH, HI_STROKES } from './hiStrokes';

interface HiMarkProps {
  className?: string;
  title?: string;
}

/**
 * Vector "Hi" monogram built from the traced logo strokes, so it stays sharp at any size.
 * Inside the ivory box the strokes are ink; where they run outside it they take `currentColor`,
 * the same way the printed logo switches to ivory on its dark background.
 */
export const HiMark: React.FC<HiMarkProps> = ({ className = '', title = 'Hi Studio' }) => {
  const id = useId().replace(/:/g, '');
  const strokeProps = {
    fill: 'none',
    strokeWidth: HI_LINE_WIDTH,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg viewBox="248 262 766 572" className={className} role="img" aria-label={title}>
      <defs>
        <clipPath id={`${id}-in`}>
          <rect {...HI_BOX} />
        </clipPath>
        <mask id={`${id}-out`}>
          <rect x="0" y="0" width="1254" height="1254" fill="white" />
          <rect {...HI_BOX} fill="black" />
        </mask>
      </defs>

      <rect {...HI_BOX} rx="6" fill="#FAF4E7" />

      <g clipPath={`url(#${id}-in)`} stroke="#15130F">
        {HI_STROKES.map((d, i) => (
          <path key={i} d={d} {...strokeProps} />
        ))}
        <circle {...HI_DOT} fill="#15130F" stroke="none" />
      </g>

      <g mask={`url(#${id}-out)`} stroke="currentColor">
        {HI_STROKES.map((d, i) => (
          <path key={i} d={d} {...strokeProps} />
        ))}
      </g>
    </svg>
  );
};
