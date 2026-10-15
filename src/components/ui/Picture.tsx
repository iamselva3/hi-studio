import React, { useState } from 'react';
import { PhotoItem } from '@/types';

interface PictureProps {
  photo: Pick<PhotoItem, 'url' | 'alt' | 'width' | 'height' | 'responsive' | 'dominantColor'> & { lqip?: string };
  sizes: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  draggable?: boolean;
  // Keep the photo's own proportions instead of filling (and cropping to) the container.
  natural?: boolean;
}

// Sizes generated above the source width are only upscales, so leave them out of srcset.
const usableWidths = (set: Record<number, string> | undefined, sourceWidth: number) => {
  if (!set) return '';
  const widths = Object.keys(set)
    .map(Number)
    .sort((a, b) => a - b);
  const kept = widths.filter((w) => w <= sourceWidth * 1.15);
  const list = kept.length ? kept : widths.slice(0, 1);
  return list.map((w) => `${set[w]} ${w}w`).join(', ');
};

/** Responsive photo with AVIF/WebP sources and a blurred placeholder while it loads. */
export const Picture: React.FC<PictureProps> = ({
  photo,
  sizes,
  className = '',
  imgClassName = '',
  eager = false,
  draggable = false,
  natural = false,
}) => {
  const [loaded, setLoaded] = useState(false);
  const avif = usableWidths(photo.responsive?.avif, photo.width);
  const webp = usableWidths(photo.responsive?.webp, photo.width);

  return (
    <picture
      className={`block overflow-hidden ${className}`}
      style={{
        backgroundColor: photo.dominantColor || 'var(--canvas-elevated)',
        backgroundImage: !loaded && photo.lqip ? `url(${photo.lqip})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      <img
        src={photo.url}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={draggable}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`block w-full ${natural ? 'h-auto' : 'h-full object-cover'} transition-opacity duration-700 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
      />
    </picture>
  );
};
