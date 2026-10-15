import { useEffect, useRef } from 'react';

/**
 * Lets a mouse drag a horizontal scroller (touch already scrolls natively).
 * Returns the ref and a `wasDrag()` check so clicks that ended a drag can be ignored.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const moved = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startX = 0;
    let startLeft = 0;
    let down = false;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      moved.current = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) {
        moved.current = true;
        el.classList.add('cursor-grabbing');
      }
      el.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      down = false;
      el.classList.remove('cursor-grabbing');
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  return { ref, wasDrag: () => moved.current };
}
