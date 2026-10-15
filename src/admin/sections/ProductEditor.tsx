import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload } from 'lucide-react';
import { api, ApiError, formatINR } from '@/lib/api';
import { Product, ProductVariant } from '@/types';
import { processProductImage, ACCEPTED_IMAGE_TYPES } from '../lib/images';
import { uploadWithProgress } from '../lib/upload';
import {
  Button,
  ErrorBanner,
  IconButton,
  Modal,
  SelectField,
  TextAreaField,
  TextField,
  Toggle,
  cx,
  errorMessage,
  inputClass,
  newId,
  paiseToRupeesText,
  rupeesToPaise,
  slugify,
} from '../ui';

export const PRODUCT_CATEGORIES: { value: Product['category']; label: string }[] = [
  { value: 'frames', label: 'Frames' },
  { value: 'prints', label: 'Prints' },
  { value: 'canvas', label: 'Canvas' },
  { value: 'albums', label: 'Albums' },
  { value: 'diaries', label: 'Diaries' },
];

interface VariantDraft {
  id: string;
  size: string;
  finish: string;
  price: string;
  sku: string;
  stock: string;
  active: boolean;
}

interface ProductDraft {
  id: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  category: Product['category'];
  description: string;
  basePrice: string;
  images: string[];
  active: boolean;
  featured: boolean;
  sortOrder: string;
  variants: VariantDraft[];
}

const emptyVariant = (): VariantDraft => ({ id: newId(), size: '', finish: '', price: '', sku: '', stock: '0', active: true });

const toDraft = (p: Product | null, nextSort: number): ProductDraft =>
  p
    ? {
        id: p.id,
        name: p.name || '',
        slug: p.slug || '',
        slugTouched: true,
        category: p.category,
        description: p.description || '',
        basePrice: paiseToRupeesText(p.base_price_paise),
        images: Array.isArray(p.images) ? [...p.images] : [],
        active: Number(p.active) === 1,
        featured: Number(p.featured) === 1,
        sortOrder: String(p.sort_order ?? 0),
        variants: (p.variants || []).map((v) => ({
          id: v.id,
          size: v.size || '',
          finish: v.finish || '',
          price: paiseToRupeesText(v.price_paise),
          sku: v.sku || '',
          stock: String(v.stock ?? 0),
          active: Number(v.active) === 1,
        })),
      }
    : {
        id: newId(),
        name: '',
        slug: '',
        slugTouched: false,
        category: 'frames',
        description: '',
        basePrice: '',
        images: [],
        active: false,
        featured: false,
        sortOrder: String(nextSort),
        variants: [emptyVariant()],
      };

type Errors = Record<string, string>;

function validate(d: ProductDraft): { errors: Errors; product?: Product } {
  const errors: Errors = {};
  if (!d.name.trim()) errors.name = 'Please enter a product name.';
  const slug = d.slug.trim();
  if (!slug) errors.slug = 'Please enter a web address.';
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = 'Use only lowercase letters, numbers and single hyphens.';
  const sort = Number(d.sortOrder);
  if (!Number.isInteger(sort)) errors.sortOrder = 'Use a whole number.';

  const variants: ProductVariant[] = [];
  d.variants.forEach((v, i) => {
    const price = rupeesToPaise(v.price);
    const stock = Number(v.stock);
    if (!v.size.trim()) errors[`v${i}.size`] = 'Required';
    if (!v.finish.trim()) errors[`v${i}.finish`] = 'Required';
    if (price === null || price <= 0) errors[`v${i}.price`] = 'Enter a price above ₹0';
    if (v.stock.trim() === '' || !Number.isInteger(stock) || stock < 0) errors[`v${i}.stock`] = 'Whole number, 0 or more';
    variants.push({
      id: v.id,
      product_id: d.id,
      size: v.size.trim(),
      finish: v.finish.trim(),
      price_paise: price ?? 0,
      sku: v.sku.trim(),
      stock: Number.isInteger(stock) ? stock : 0,
      active: v.active ? 1 : 0,
    });
  });
  if (d.active && !d.variants.some((v) => v.active)) {
    errors.variants = 'An active product needs at least one available size. Add one, or set the product to Draft.';
  }

  let basePaise = rupeesToPaise(d.basePrice);
  if (d.basePrice.trim() && (basePaise === null || basePaise < 0)) errors.basePrice = 'Enter an amount in rupees.';
  if (!d.basePrice.trim()) {
    const prices = variants.filter((v) => v.active && v.price_paise > 0).map((v) => v.price_paise);
    basePaise = prices.length ? Math.min(...prices) : 0;
  }

  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    product: {
      id: d.id,
      slug,
      name: d.name.trim(),
      description: d.description.trim(),
      category: d.category,
      base_price_paise: basePaise ?? 0,
      images: d.images,
      active: d.active ? 1 : 0,
      featured: d.featured ? 1 : 0,
      sort_order: sort,
      variants,
    },
  };
}

export const ProductEditor: React.FC<{
  product: Product | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (saved: Product) => void;
}> = ({ product, nextSortOrder, onClose, onSaved }) => {
  const [initial] = useState(() => toDraft(product, nextSortOrder));
  const [draft, setDraft] = useState<ProductDraft>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const isNew = !product;

  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setVariant = (id: string, patch: Partial<VariantDraft>) =>
    setDraft((d) => ({ ...d, variants: d.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));

  const close = () => {
    if (dirty && !window.confirm('Discard your changes to this product?')) return;
    onClose();
  };

  const uploadImages = async (files: FileList) => {
    setUploadError(null);
    for (const file of Array.from(files)) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setUploadError(`${file.name}: only JPEG, PNG or WebP images can be used.`);
        continue;
      }
      try {
        setUploading({ name: file.name, progress: 0 });
        const webp = await processProductImage(file, 1600);
        const form = new FormData();
        form.append('file', webp, webp.name);
        const res = await uploadWithProgress<{ url: string }>('/api/admin/uploads', form, (f) =>
          setUploading({ name: file.name, progress: f })
        );
        if (!res?.url) throw new Error('The server did not return the image address.');
        setDraft((d) => ({ ...d, images: [...d.images, res.url] }));
      } catch (err) {
        setUploadError(`${file.name}: ${errorMessage(err)}`);
      }
    }
    setUploading(null);
  };

  const moveImage = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const imgs = [...d.images];
      const j = i + dir;
      if (j < 0 || j >= imgs.length) return d;
      [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
      return { ...d, images: imgs };
    });

  const moveVariant = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const vs = [...d.variants];
      const j = i + dir;
      if (j < 0 || j >= vs.length) return d;
      [vs[i], vs[j]] = [vs[j], vs[i]];
      return { ...d, variants: vs };
    });

  const save = async () => {
    setSaveError(null);
    const { errors: errs, product: payload } = validate(draft);
    setErrors(errs);
    if (!payload) {
      setSaveError('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      const saved = await api<Product>('/api/admin/products', { method: 'POST', body: { product: payload } });
      if (!saved || !saved.id) throw new Error('The server did not confirm the save.');
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors((e) => ({ ...e, slug: err.message || 'That URL slug is already used' }));
        setSaveError('That web address is already used by another product. Please choose a different one.');
      } else {
        setSaveError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isNew ? 'New product' : 'Edit product'}
      subtitle={draft.name || undefined}
      onClose={close}
      size="xl"
      footer={
        <>
          {saveError && (
            <p className="mr-auto text-sm text-red-300" role="alert">
              {saveError}
            </p>
          )}
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} disabled={(!dirty && !isNew) || !!uploading}>
            {isNew ? 'Create product' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Product name"
          required
          value={draft.name}
          error={errors.name}
          onChange={(v) => setDraft((d) => ({ ...d, name: v, slug: d.slugTouched ? d.slug : slugify(v) }))}
        />
        <SelectField
          label="Category"
          value={draft.category}
          options={PRODUCT_CATEGORIES}
          onChange={(v) => set('category', v as Product['category'])}
        />
        <TextField
          label="Web address"
          required
          value={draft.slug}
          error={errors.slug}
          hint={
            <>
              The page will be at <span className="font-mono">/shop/{draft.slug || '…'}</span>.
              {!isNew && ' Changing it breaks links that people have already shared.'}
            </>
          }
          onChange={(v) => setDraft((d) => ({ ...d, slug: v.toLowerCase().replace(/\s+/g, '-'), slugTouched: true }))}
        />
        <TextField
          label="“From” price (₹)"
          inputMode="decimal"
          value={draft.basePrice}
          error={errors.basePrice}
          placeholder="Lowest size price"
          hint="Shown as the starting price. Leave empty to use the cheapest available size."
          onChange={(v) => set('basePrice', v)}
        />
        <TextAreaField
          label="Description"
          fieldClassName="sm:col-span-2"
          rows={4}
          value={draft.description}
          onChange={(v) => set('description', v)}
        />
        <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-start sm:gap-8">
          <Toggle
            label={draft.active ? 'Active — shown in the shop' : 'Draft — hidden from the shop'}
            checked={draft.active}
            onChange={(v) => set('active', v)}
          />
          <Toggle label="Featured" hint="Highlight this product, e.g. on the home page." checked={draft.featured} onChange={(v) => set('featured', v)} />
          <TextField
            label="Position in shop"
            inputMode="numeric"
            fieldClassName="sm:w-40"
            value={draft.sortOrder}
            error={errors.sortOrder}
            hint="Lower numbers come first."
            onChange={(v) => set('sortOrder', v)}
          />
        </div>
      </div>

      {/* Photos */}
      <section className="space-y-3 border-t border-hairline pt-5" aria-labelledby="product-photos-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="product-photos-heading" className="font-serif text-lg">
              Photos
            </h3>
            <p className="text-sm text-ink-faint">The first photo is the main one. Images are resized to 1600 px before uploading.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              if (e.target.files?.length) uploadImages(e.target.files);
              e.target.value = '';
            }}
          />
          <Button onClick={() => fileRef.current?.click()} busy={!!uploading}>
            <Upload size={14} aria-hidden /> Upload photo
          </Button>
        </div>
        {uploading && (
          <div aria-live="polite">
            <div
              className="h-2 overflow-hidden rounded bg-canvas-surface"
              role="progressbar"
              aria-label={`Uploading ${uploading.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(uploading.progress * 100)}
            >
              <div className="h-full bg-accent" style={{ width: `${Math.round(uploading.progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-faint">Uploading {uploading.name}…</p>
          </div>
        )}
        <ErrorBanner message={uploadError} onDismiss={() => setUploadError(null)} />
        {draft.images.length === 0 ? (
          <p className="text-sm text-ink-faint">No photos yet. Products without a photo look empty in the shop.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {draft.images.map((src, i) => (
              <li key={`${src}-${i}`} className="overflow-hidden rounded border border-hairline-strong bg-canvas">
                <div className="relative aspect-square">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-[#0D0C0B]">Main</span>}
                </div>
                <div className="flex justify-between gap-1 p-1.5">
                  <IconButton label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => moveImage(i, -1)}>
                    <ArrowLeft size={14} />
                  </IconButton>
                  <IconButton label={`Move photo ${i + 1} later`} disabled={i === draft.images.length - 1} onClick={() => moveImage(i, 1)}>
                    <ArrowRight size={14} />
                  </IconButton>
                  <IconButton
                    label={`Remove photo ${i + 1}`}
                    tone="danger"
                    onClick={() => set('images', draft.images.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sizes */}
      <section className="space-y-3 border-t border-hairline pt-5" aria-labelledby="product-sizes-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="product-sizes-heading" className="font-serif text-lg">
              Sizes &amp; prices
            </h3>
            <p className="text-sm text-ink-faint">
              Customers choose one of these. Turn “Available” off to stop selling a size without deleting it. Stock goes down automatically when an order is paid.
            </p>
          </div>
          <Button onClick={() => set('variants', [...draft.variants, emptyVariant()])}>
            <Plus size={14} aria-hidden /> Add size
          </Button>
        </div>
        {errors.variants && (
          <p className="text-sm text-red-300" role="alert">
            {errors.variants}
          </p>
        )}
        {draft.variants.length === 0 && <p className="text-sm text-ink-faint">No sizes yet.</p>}
        <ul className="space-y-3">
          {draft.variants.map((v, i) => {
            const pricePaise = rupeesToPaise(v.price);
            return (
              <li key={v.id} className={cx('rounded-md border bg-canvas p-3', v.active ? 'border-hairline-strong' : 'border-dashed border-hairline-strong opacity-80')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12">
                  <VariantInput label="Size" className="sm:col-span-2 md:col-span-3" value={v.size} error={errors[`v${i}.size`]} placeholder="e.g. 12 × 18 in" onChange={(x) => setVariant(v.id, { size: x })} />
                  <VariantInput label="Finish" className="sm:col-span-2 md:col-span-3" value={v.finish} error={errors[`v${i}.finish`]} placeholder="e.g. Teak wood" onChange={(x) => setVariant(v.id, { finish: x })} />
                  <VariantInput
                    label="Price (₹)"
                    className="md:col-span-2"
                    inputMode="decimal"
                    value={v.price}
                    error={errors[`v${i}.price`]}
                    onChange={(x) => setVariant(v.id, { price: x })}
                    note={pricePaise ? formatINR(pricePaise) : undefined}
                  />
                  <VariantInput label="Stock" className="md:col-span-2" inputMode="numeric" value={v.stock} error={errors[`v${i}.stock`]} onChange={(x) => setVariant(v.id, { stock: x })} />
                  <VariantInput label="SKU (optional)" className="sm:col-span-2 md:col-span-2" value={v.sku} onChange={(x) => setVariant(v.id, { sku: x })} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Toggle label="Available" checked={v.active} onChange={(x) => setVariant(v.id, { active: x })} />
                  <div className="flex gap-1.5">
                    <IconButton label={`Move size ${i + 1} up`} disabled={i === 0} onClick={() => moveVariant(i, -1)}>
                      <ArrowLeft size={14} className="rotate-90" />
                    </IconButton>
                    <IconButton label={`Move size ${i + 1} down`} disabled={i === draft.variants.length - 1} onClick={() => moveVariant(i, 1)}>
                      <ArrowRight size={14} className="rotate-90" />
                    </IconButton>
                    <IconButton
                      label={`Delete size ${v.size || i + 1}`}
                      tone="danger"
                      onClick={() => {
                        if (!v.size && !v.price) {
                          set('variants', draft.variants.filter((x) => x.id !== v.id));
                          return;
                        }
                        if (window.confirm(`Delete the size “${v.size || 'untitled'}”? It is removed when you save the product.`)) {
                          set('variants', draft.variants.filter((x) => x.id !== v.id));
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </Modal>
  );
};

const VariantInput: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    label: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
    note?: string;
  }
> = ({ label, value, onChange, error, note, className, ...rest }) => {
  const id = React.useId();
  return (
    <div className={cx('space-y-1', className)}>
      <label htmlFor={id} className="block text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-e` : undefined}
        className={cx(inputClass, 'sm:py-1.5', error && 'border-red-700')}
        {...rest}
      />
      {error ? (
        <p id={`${id}-e`} className="text-[11px] text-red-300">
          {error}
        </p>
      ) : note ? (
        <p className="text-[11px] text-ink-faint">{note}</p>
      ) : null}
    </div>
  );
};
