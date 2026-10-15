import { useEffect, useRef } from 'react';

/**
 * Adds `is-in` to elements marked `data-reveal` inside the returned ref once they scroll into view.
 * Styling lives in index.css; with reduced motion the elements are simply visible.
 * Pass `deps` when the marked children render later (e.g. after data loads).
 */
export function useReveal<T extends HTMLElement = HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'));
    if (root.hasAttribute('data-reveal') && !root.classList.contains('is-in')) targets.push(root);

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
