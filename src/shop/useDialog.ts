import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusables = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );

/**
 * Modal behaviour for drawers and dialogs: moves focus inside (to `[data-autofocus]` or the first
 * control), keeps Tab inside, closes on Escape, locks page scroll and gives focus back on close.
 * Tab is trapped with keydown only, so third-party overlays (e.g. the Razorpay window) keep focus.
 */
export function useDialog(open: boolean, ref: RefObject<HTMLElement>, onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirst = () => {
      const root = ref.current;
      if (!root) return;
      const target = root.querySelector<HTMLElement>('[data-autofocus]') || focusables(root)[0] || root;
      target.focus({ preventScroll: true });
    };
    // Wait a frame so entering animations have mounted the content.
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      const root = ref.current;
      if (!root) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables(root);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
