import React, { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { MAX_QTY } from '@/context/CartContext';

/** Approximate colour of a finish, for small swatches next to its name. */
export const finishSwatch = (finish: string): string | null => {
  const f = finish.toLowerCase();
  if (/walnut|smoked|espresso/.test(f)) return '#4b3123';
  if (/black|ebony|charcoal|obsidian/.test(f)) return '#1d1b19';
  if (/white|ivory|chalk/.test(f)) return '#ece7dc';
  if (/oak|ash|maple/.test(f)) return '#b38b5d';
  if (/gold|brass|gilt/.test(f)) return '#b08d47';
  if (/teak|burma|natural/.test(f)) return '#8a5a2e';
  if (/sand|linen|beige/.test(f)) return '#cdbb98';
  return null;
};

export const inputClass =
  'w-full h-12 px-4 bg-transparent border border-hairline-strong rounded-[3px] focus:border-accent outline-none text-ink-light text-base sm:text-[15px] placeholder:text-ink-muted transition-colors aria-[invalid=true]:border-red-400';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Field: React.FC<FieldProps> = ({ label, error, hint, id, className = '', ...rest }) => {
  const auto = useId();
  const fieldId = id || auto;
  const describedBy = [error ? `${fieldId}-error` : '', hint ? `${fieldId}-hint` : ''].filter(Boolean).join(' ');
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="block text-sm text-ink-faint mb-1.5">
        {label}
      </label>
      <input
        id={fieldId}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
      {hint && !error && (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="mt-1.5 text-[13px] text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

interface QtyStepperProps {
  value: number;
  onChange: (next: number) => void;
  label: string;
  max?: number;
  size?: 'md' | 'sm';
}

export const QtyStepper: React.FC<QtyStepperProps> = ({ value, onChange, label, max = MAX_QTY, size = 'md' }) => {
  const h = size === 'md' ? 'h-12' : 'h-11';
  return (
    <div className={`inline-flex items-center border border-hairline-strong rounded-[3px] ${h}`} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="w-11 h-full flex items-center justify-center text-ink-light disabled:text-ink-muted disabled:cursor-not-allowed hover:text-accent transition-colors"
        aria-label="Decrease quantity"
      >
        <Minus size={15} />
      </button>
      <span className="min-w-[2rem] text-center tabular-nums text-[15px]" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-11 h-full flex items-center justify-center text-ink-light disabled:text-ink-muted disabled:cursor-not-allowed hover:text-accent transition-colors"
        aria-label="Increase quantity"
      >
        <Plus size={15} />
      </button>
    </div>
  );
};

export interface ChoiceOption {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
  swatch?: string | null;
}

interface ChoiceGroupProps {
  legend: string;
  name: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  note?: React.ReactNode;
  columns?: 'auto' | 'two';
}

/** A set of native radio buttons drawn as quiet option tiles (arrow keys work as usual). */
export const ChoiceGroup: React.FC<ChoiceGroupProps> = ({ legend, name, options, value, onChange, note, columns = 'auto' }) => (
  <fieldset>
    <legend className="text-sm text-ink-faint mb-2.5">
      {legend}
      {value && <span className="text-ink-light"> · {options.find((o) => o.value === value)?.label}</span>}
    </legend>
    <div className={columns === 'two' ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2'}>
      {options.map((o) => (
        <label
          key={o.value}
          className={`relative flex items-center gap-2.5 min-h-[48px] px-4 py-2 rounded-[3px] border text-[15px] transition-colors focus-within:outline focus-within:outline-1 focus-within:outline-accent focus-within:outline-offset-2 ${
            o.disabled
              ? 'border-hairline text-ink-muted cursor-not-allowed'
              : value === o.value
                ? 'border-accent text-ink-light bg-accent/[0.07] cursor-pointer'
                : 'border-hairline-strong text-ink-light hover:border-ink-faint cursor-pointer'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.swatch && (
            <span
              className="w-4 h-4 rounded-full flex-shrink-0 border border-black/20"
              style={{ backgroundColor: o.swatch }}
              aria-hidden="true"
            />
          )}
          <span className="flex flex-col leading-tight">
            <span className={o.disabled ? 'line-through decoration-ink-muted/60' : undefined}>{o.label}</span>
            {o.detail && <span className="text-[13px] text-ink-faint no-underline mt-0.5">{o.detail}</span>}
          </span>
        </label>
      ))}
    </div>
    {note && <div className="mt-2.5 text-[13px] text-ink-faint leading-relaxed">{note}</div>}
  </fieldset>
);
