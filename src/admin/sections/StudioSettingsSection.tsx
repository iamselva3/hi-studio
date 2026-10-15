import React, { useEffect, useState } from 'react';
import { formatINR } from '@/lib/api';
import { useSiteData } from '@/context/SiteDataContext';
import { StudioSettings } from '@/types';
import { SettingsCard, useSettingDraft } from '../useSettingDraft';
import { ErrorBanner, Field, PageHeader, Spinner, TextAreaField, TextField, Toggle, cx, inputClass, paiseToRupeesText, rupeesToPaise } from '../ui';

/* ------------------------------------------------------------------ */
/* Number inputs that keep what the owner types, and report NaN when invalid */
/* ------------------------------------------------------------------ */

const NumberInput: React.FC<{
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: React.ReactNode;
  /** 'rupees' shows ₹ and converts to paise. */
  mode?: 'int' | 'decimal' | 'rupees';
  min?: number;
  max?: number;
  className?: string;
}> = ({ label, value, onChange, hint, mode = 'int', min = 0, max, className }) => {
  const toText = (n: number) => (Number.isFinite(n) ? (mode === 'rupees' ? paiseToRupeesText(n) : String(n)) : '');
  const parse = (t: string): number => {
    if (mode === 'rupees') return rupeesToPaise(t) ?? NaN;
    const trimmed = t.trim();
    if (trimmed === '') return NaN;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return NaN;
    if (mode === 'int' && !Number.isInteger(n)) return NaN;
    return n;
  };
  const [text, setText] = useState(() => toText(value));

  // Follow outside changes (load, discard, reset) without fighting the owner's typing.
  useEffect(() => {
    const current = parse(text);
    if (!(Number.isNaN(current) && Number.isNaN(value)) && current !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const n = parse(text);
  const outOfRange = !Number.isNaN(n) && (n < (mode === 'rupees' ? min * 100 : min) || (max !== undefined && n > max));
  const error =
    text.trim() === ''
      ? 'Required'
      : Number.isNaN(n)
        ? mode === 'int'
          ? 'Enter a whole number'
          : 'Enter a valid number'
        : outOfRange
          ? max !== undefined
            ? `Enter a number from ${min} to ${max}`
            : `Enter ${min} or more`
          : null;

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <div className="relative">
          {mode === 'rupees' && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-faint">₹</span>}
          <input
            id={id}
            inputMode={mode === 'int' ? 'numeric' : 'decimal'}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const parsed = parse(e.target.value);
              onChange(parsed);
            }}
            className={cx(inputClass, mode === 'rupees' && 'pl-7', error && 'border-red-700')}
          />
        </div>
      )}
    </Field>
  );
};

const validNumber = (n: number, min = 0, max = Infinity) => Number.isFinite(n) && n >= min && n <= max;

/* ------------------------------------------------------------------ */

const ProfileCard: React.FC = () => {
  const s = useSettingDraft('studio_profile');
  const d = s.draft;
  const set = (patch: Partial<StudioSettings['studio_profile']>) => s.setDraft({ ...d, ...patch });

  return (
    <SettingsCard
      title="Studio details"
      description="Your name and contact details, shown in the footer, contact section and policies."
      state={s}
      validate={(v) => {
        if (!v.name.trim()) return 'Please enter the studio name.';
        if (v.whatsapp.trim() && !/^\d{10,15}$/.test(v.whatsapp.trim())) return 'WhatsApp number: digits only, including the country code (e.g. 917904140477).';
        if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return 'Please check the email address.';
        if (v.pincode.trim() && !/^\d{6}$/.test(v.pincode.trim())) return 'Pincode should be 6 digits.';
        if (![v.experienceYears, v.weddingsDocumented, v.awardsCount].every((n) => validNumber(n) && Number.isInteger(n)))
          return 'The numbers must be whole numbers, 0 or more.';
        return null;
      }}
      prepare={(v) => ({
        ...v,
        name: v.name.trim(),
        legalName: v.legalName.trim(),
        tagline: v.tagline.trim(),
        phone: v.phone.trim(),
        whatsapp: v.whatsapp.replace(/\D/g, ''),
        email: v.email.trim(),
        address: v.address.trim(),
        city: v.city.trim(),
        state: v.state.trim(),
        pincode: v.pincode.trim(),
        country: v.country.trim(),
        hours: v.hours.trim(),
        instagram: v.instagram.trim(),
        bio: v.bio.trim(),
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Studio name" required value={d.name} onChange={(v) => set({ name: v })} maxLength={80} />
        <TextField label="Registered business name" value={d.legalName} onChange={(v) => set({ legalName: v })} hint="Used in policies and on invoices." maxLength={120} />
        <TextField label="Tagline" fieldClassName="sm:col-span-2" value={d.tagline} onChange={(v) => set({ tagline: v })} maxLength={140} />
        <TextField label="Phone" type="tel" value={d.phone} onChange={(v) => set({ phone: v })} placeholder="+91 79041 40477" />
        <TextField
          label="WhatsApp number"
          inputMode="numeric"
          value={d.whatsapp}
          onChange={(v) => set({ whatsapp: v })}
          hint="Digits only, with country code, e.g. 917904140477."
        />
        <TextField label="Email" type="email" value={d.email} onChange={(v) => set({ email: v })} />
        <TextField label="Instagram" value={d.instagram} onChange={(v) => set({ instagram: v })} hint="Your handle, e.g. @histudio.visuals" />
        <TextField label="Street address" fieldClassName="sm:col-span-2" value={d.address} onChange={(v) => set({ address: v })} />
        <TextField label="City" value={d.city} onChange={(v) => set({ city: v })} />
        <TextField label="State" value={d.state} onChange={(v) => set({ state: v })} />
        <TextField label="Pincode" inputMode="numeric" value={d.pincode} onChange={(v) => set({ pincode: v })} />
        <TextField label="Country" value={d.country} onChange={(v) => set({ country: v })} />
        <TextField label="Opening hours" fieldClassName="sm:col-span-2" value={d.hours} onChange={(v) => set({ hours: v })} placeholder="Mon – Sat, 9:30 am – 8:00 pm" />
        <TextAreaField label="About the studio" fieldClassName="sm:col-span-2" value={d.bio} onChange={(v) => set({ bio: v })} rows={3} maxLength={800} />
      </div>
      <div className="space-y-2">
        <p className="text-sm text-ink-faint">Numbers shown on the website. Leave a number at 0 to hide it — only enter true figures.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberInput label="Years of experience" value={d.experienceYears} onChange={(n) => set({ experienceYears: n })} />
          <NumberInput label="Weddings photographed" value={d.weddingsDocumented} onChange={(n) => set({ weddingsDocumented: n })} />
          <NumberInput label="Awards" value={d.awardsCount} onChange={(n) => set({ awardsCount: n })} />
        </div>
      </div>
    </SettingsCard>
  );
};

const ShippingCard: React.FC = () => {
  const s = useSettingDraft('shipping_rules');
  const d = s.draft;
  const set = (patch: Partial<StudioSettings['shipping_rules']>) => s.setDraft({ ...d, ...patch });
  const ok = (n: number) => validNumber(n);
  return (
    <SettingsCard
      title="Delivery charges"
      description="Used at checkout. The customer pays the delivery charge shown here."
      state={s}
      validate={(v) =>
        ok(v.baseStandardRatePaise) && ok(v.freeShippingThresholdPaise) && ok(v.expressDeliveryRatePaise) ? null : 'Please enter valid amounts (0 or more).'
      }
      prepare={(v) => ({
        ...v,
        baseStandardRatePaise: Math.round(v.baseStandardRatePaise),
        freeShippingThresholdPaise: Math.round(v.freeShippingThresholdPaise),
        expressDeliveryRatePaise: Math.round(v.expressDeliveryRatePaise),
        estimatedDeliveryDays: v.estimatedDeliveryDays.trim(),
      })}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput label="Standard delivery" mode="rupees" value={d.baseStandardRatePaise} onChange={(n) => set({ baseStandardRatePaise: n })} hint="Set 0 for free standard delivery." />
        <NumberInput
          label="Free delivery from"
          mode="rupees"
          value={d.freeShippingThresholdPaise}
          onChange={(n) => set({ freeShippingThresholdPaise: n })}
          hint={
            Number.isFinite(d.freeShippingThresholdPaise) && d.freeShippingThresholdPaise > 0
              ? `Standard delivery is free when the order is ${formatINR(d.freeShippingThresholdPaise)} or more.`
              : 'Set 0 to switch off free delivery.'
          }
        />
        <NumberInput label="Express delivery" mode="rupees" value={d.expressDeliveryRatePaise} onChange={(n) => set({ expressDeliveryRatePaise: n })} />
      </div>
      <TextField
        label="Delivery time"
        value={d.estimatedDeliveryDays}
        onChange={(v) => set({ estimatedDeliveryDays: v })}
        hint="Shown to customers, e.g. “5–7 business days for custom frames”."
      />
    </SettingsCard>
  );
};

const GstCard: React.FC = () => {
  const s = useSettingDraft('gst_config');
  const d = s.draft;
  const set = (patch: Partial<StudioSettings['gst_config']>) => s.setDraft({ ...d, ...patch });
  return (
    <SettingsCard
      title="GST"
      description="Your tax details. Product prices are what the customer pays."
      state={s}
      validate={(v) => {
        if (!validNumber(v.ratePercentage, 0, 28)) return 'GST rate must be between 0 and 28 %.';
        if (v.gstin.trim() && !/^[0-9]{2}[A-Z0-9]{13}$/.test(v.gstin.trim().toUpperCase())) return 'GSTIN should be 15 characters, e.g. 33ABCDE1234F1Z5.';
        if (v.hsnCode.trim() && !/^\d{4,8}$/.test(v.hsnCode.trim())) return 'HSN code should be 4 to 8 digits.';
        return null;
      }}
      prepare={(v) => ({ ...v, gstin: v.gstin.trim().toUpperCase(), hsnCode: v.hsnCode.trim() })}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput label="GST rate (%)" mode="decimal" max={28} value={d.ratePercentage} onChange={(n) => set({ ratePercentage: n })} hint="0 if you are not registered for GST." />
        <TextField label="GSTIN" value={d.gstin} onChange={(v) => set({ gstin: v })} maxLength={15} />
        <TextField label="HSN code" inputMode="numeric" value={d.hsnCode} onChange={(v) => set({ hsnCode: v })} />
      </div>
      <Toggle
        label="Prices include GST"
        checked={d.isPriceInclusive}
        onChange={(v) => set({ isPriceInclusive: v })}
        hint="When on (and the rate is above 0), the shop says “Prices include GST”."
      />
    </SettingsCard>
  );
};

const ShopCard: React.FC = () => {
  const s = useSettingDraft('shop_config');
  const d = s.draft;
  const albumMin = d.weddingMonographMinPhotos ?? 10;
  const diaryMin = d.weddingDiaryMinPhotos ?? 5;
  const wholeIn = (n: number, min: number, max: number) => validNumber(n, min, max) && Number.isInteger(n);
  return (
    <SettingsCard
      title="Shop"
      state={s}
      validate={(v) => {
        if (!wholeIn(v.lowStockThreshold, 0, 1_000_000)) return 'Low-stock level must be a whole number, 0 or more.';
        if (!wholeIn(v.weddingMonographMinPhotos ?? 10, 1, 60) || !wholeIn(v.weddingDiaryMinPhotos ?? 5, 1, 60))
          return 'Minimum photos must be a whole number from 1 to 60.';
        return null;
      }}
      prepare={(v) => ({ ...v, weddingMonographMinPhotos: v.weddingMonographMinPhotos ?? 10, weddingDiaryMinPhotos: v.weddingDiaryMinPhotos ?? 5 })}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput
          label="Low-stock warning at"
          value={d.lowStockThreshold}
          onChange={(n) => s.setDraft({ ...d, lowStockThreshold: n })}
          hint="The dashboard lists sizes with this many or fewer left."
        />
        <NumberInput
          label="Album: minimum photos"
          min={1}
          max={60}
          value={albumMin}
          onChange={(n) => s.setDraft({ ...d, weddingMonographMinPhotos: n })}
          hint="Customers must upload at least this many photos to order an album."
        />
        <NumberInput
          label="Diary: minimum photos"
          min={1}
          max={60}
          value={diaryMin}
          onChange={(n) => s.setDraft({ ...d, weddingDiaryMinPhotos: n })}
          hint="Customers must upload at least this many photos to order a diary."
        />
      </div>
    </SettingsCard>
  );
};

/* ------------------------------------------------------------------ */

export const StudioSettingsSection: React.FC = () => {
  const { status, refresh } = useSiteData();
  return (
    <div className="space-y-6">
      <PageHeader title="Studio & shop settings" description="Each card saves on its own and is live on the website as soon as it says “Saved”." />
      {status === 'loading' && <Spinner label="Loading the current settings…" />}
      {status === 'offline' && (
        <ErrorBanner message="The current settings could not be loaded, so editing is paused to avoid overwriting them." onRetry={() => refresh()} />
      )}
      <ProfileCard />
      <ShippingCard />
      <GstCard />
      <ShopCard />
    </div>
  );
};
