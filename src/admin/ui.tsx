import React, { useEffect, useId, useRef } from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { ApiError } from '@/lib/api';

/** Turn any thrown value into a sentence the studio owner can act on. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Your session has expired. Please sign in again.';
    if (err.status === 413) return err.message || 'That file is too large.';
    if (err.status >= 500 && /^Request failed/.test(err.message)) return 'The server had a problem. Please try again.';
    return err.message;
  }
  if (err instanceof TypeError) return 'Could not reach the server. Check your internet connection and try again.';
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export const PageHeader: React.FC<{ title: string; description?: React.ReactNode; actions?: React.ReactNode }> = ({
  title,
  description,
  actions,
}) => (
  <div className="flex flex-col gap-4 border-b border-hairline-strong pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="font-serif text-3xl text-ink-light">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-ink-faint">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Card: React.FC<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, children, className }) => (
  <section className={cx('rounded-lg border border-hairline-strong bg-canvas-elevated p-4 sm:p-6', className)}>
    {(title || actions) && (
      <div className="mb-5 flex flex-col gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {title && <h2 className="font-serif text-xl text-ink-light">{title}</h2>}
          {description && <p className="mt-1 text-sm text-ink-faint">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export const ErrorBanner: React.FC<{ message: string | null | undefined; onRetry?: () => void; onDismiss?: () => void }> = ({
  message,
  onRetry,
  onDismiss,
}) => {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-red-800/70 bg-red-950/40 p-3 text-sm text-red-200">
      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" aria-hidden />
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded border border-red-700 px-2 py-0.5 text-xs hover:bg-red-900/60">
          Try again
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="rounded p-0.5 hover:bg-red-900/60" aria-label="Dismiss message">
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export const Notice: React.FC<{ children: React.ReactNode; tone?: 'info' | 'warn' }> = ({ children, tone = 'info' }) => (
  <div
    className={cx(
      'rounded-md border p-3 text-sm',
      tone === 'warn' ? 'border-amber-800/70 bg-amber-950/30 text-amber-200' : 'border-hairline-strong bg-canvas text-ink-faint'
    )}
  >
    {children}
  </div>
);

export const Spinner: React.FC<{ label?: string; className?: string }> = ({ label = 'Loading…', className }) => (
  <div className={cx('flex items-center gap-2 text-sm text-ink-faint', className)} role="status">
    <Loader2 size={16} className="animate-spin" aria-hidden />
    <span>{label}</span>
  </div>
);

export const EmptyState: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg border border-dashed border-hairline-strong bg-canvas-elevated/50 p-8 text-center">
    <p className="font-serif text-lg text-ink-light">{title}</p>
    {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-faint">{children}</div>}
  </div>
);

export const SavedNote: React.FC<{ show: boolean; text?: string }> = ({ show, text = 'Saved' }) =>
  show ? (
    <span className="inline-flex items-center gap-1 text-sm text-emerald-300" role="status">
      <Check size={14} aria-hidden /> {text}
    </span>
  ) : null;

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-[#0D0C0B] font-semibold hover:bg-accent-hover border border-accent',
  secondary: 'bg-canvas text-ink-light border border-hairline-strong hover:border-accent',
  danger: 'bg-red-950/50 text-red-200 border border-red-800/80 hover:bg-red-900/70',
  ghost: 'bg-transparent text-ink-faint border border-transparent hover:text-ink-light hover:bg-canvas',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean; size?: 'sm' | 'md' }
> = ({ variant = 'secondary', busy, size = 'md', className, children, disabled, type = 'button', ...rest }) => (
  <button
    type={type}
    disabled={disabled || busy}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
      size === 'sm' ? 'min-h-[36px] px-3 py-1.5 text-sm sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs' : 'min-h-[44px] px-4 py-2 text-sm sm:min-h-[38px]',
      buttonStyles[variant],
      className
    )}
    {...rest}
  >
    {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
    {children}
  </button>
);

export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'default' | 'danger' | 'active' }
> = ({ label, tone = 'default', className, children, type = 'button', ...rest }) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={cx(
      'inline-flex h-11 w-11 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      tone === 'danger' && 'border-hairline-strong bg-canvas text-red-300 hover:border-red-700 hover:bg-red-950/50',
      tone === 'active' && 'border-accent/70 bg-accent/15 text-accent hover:bg-accent/25',
      tone === 'default' && 'border-hairline-strong bg-canvas text-ink-light hover:border-accent',
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

// 16px text on phones stops iOS from zooming into the field; taller fields are easier to tap.
export const inputClass =
  'w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2.5 text-base text-ink-light placeholder:text-ink-faint/50 outline-none transition-colors focus:border-accent disabled:opacity-60 sm:py-2 sm:text-sm';

interface FieldProps {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, required, className, children }) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('space-y-1', className)}>
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p id={hintId} className="text-xs text-ink-faint/80">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
};

export const TextField: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
    label: string;
    value: string;
    onChange: (value: string) => void;
    hint?: React.ReactNode;
    error?: string | null;
    fieldClassName?: string;
  }
> = ({ label, value, onChange, hint, error, required, fieldClassName, className, ...rest }) => (
  <Field label={label} hint={hint} error={error} required={required} className={fieldClassName}>
    {(id, describedBy) => (
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={cx(inputClass, error && 'border-red-700', className)}
        {...rest}
      />
    )}
  </Field>
);

export const TextAreaField: React.FC<
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
    label: string;
    value: string;
    onChange: (value: string) => void;
    hint?: React.ReactNode;
    error?: string | null;
    fieldClassName?: string;
  }
> = ({ label, value, onChange, hint, error, required, fieldClassName, className, rows = 3, ...rest }) => (
  <Field label={label} hint={hint} error={error} required={required} className={fieldClassName}>
    {(id, describedBy) => (
      <textarea
        id={id}
        rows={rows}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={cx(inputClass, 'leading-relaxed', error && 'border-red-700', className)}
        {...rest}
      />
    )}
  </Field>
);

export const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  fieldClassName?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, options, hint, error, required, fieldClassName, disabled }) => (
  <Field label={label} hint={hint} error={error} required={required} className={fieldClassName}>
    {(id, describedBy) => (
      <select
        id={id}
        aria-describedby={describedBy}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputClass, 'pr-8')}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )}
  </Field>
);

/** Accessible on/off switch with a visible label. */
export const Toggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}> = ({ label, checked, onChange, hint, disabled, className }) => {
  const id = useId();
  return (
    <div className={cx('flex min-h-[44px] items-start gap-3 sm:min-h-0', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
          checked ? 'border-accent bg-accent' : 'border-hairline-strong bg-canvas'
        )}
      >
        <span
          className={cx(
            'inline-block h-4 w-4 rounded-full shadow transition-transform',
            checked ? 'translate-x-6 bg-[#0D0C0B]' : 'translate-x-1 bg-ink-faint'
          )}
        />
      </button>
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm text-ink-light">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-ink-faint">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export const Modal: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}> = ({ title, subtitle, onClose, children, footer, size = 'md' }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('input, textarea, select, button:not([data-modal-close])');
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])')
        ).filter((el) => el.offsetParent !== null);
        if (!focusables.length) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const width = size === 'xl' ? 'max-w-5xl' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-xl border border-hairline-strong bg-canvas-elevated shadow-2xl outline-none sm:max-h-[90vh] sm:rounded-xl',
          width
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline-strong px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-xl text-ink-light">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-sm text-ink-faint">{subtitle}</div>}
          </div>
          <IconButton label="Close" onClick={onClose} data-modal-close>
            <X size={16} />
          </IconButton>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline-strong px-4 py-3 sm:px-6">{footer}</div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Format a D1 timestamp ("2026-10-14 09:12:00", UTC) or ISO string in Indian locale. */
export function formatDateTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  let d: Date;
  if (typeof value === 'number') d = new Date(value);
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) d = new Date(value.replace(' ', 'T') + 'Z');
  else d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return formatDateTime(value).replace(/,?\s*\d{1,2}:\d{2}\s*(am|pm)?$/i, '');
}

/** WhatsApp click-to-chat link. 10-digit Indian numbers get the 91 country code. */
export function whatsappLink(phone: string, text?: string): string | null {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function telLink(phone: string): string {
  return `tel:${(phone || '').replace(/[^\d+]/g, '')}`;
}

/** Rupee text input → integer paise (null when not a valid number). */
export function rupeesToPaise(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function paiseToRupeesText(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) return '';
  const r = paise / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
