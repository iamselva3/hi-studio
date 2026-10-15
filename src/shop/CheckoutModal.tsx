import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Lock, X } from 'lucide-react';
import { useCart, lineKey } from '@/context/CartContext';
import { useSiteData } from '@/context/SiteDataContext';
import { formatINR } from '@/lib/api';
import { CartItem } from '@/types';
import { useDialog } from './useDialog';
import { Field, inputClass } from './ui';
import { ShippingMethod, gstNote, shippingFor, whatsappLink } from './catalog';
import { CreateOrderBody, CreateOrderResponse, ShopApiError, createOrder, verifyPayment } from './shopApi';
import { RazorpaySuccess, loadRazorpay, themeColor } from './razorpay';

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

interface FormState {
  name: string;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  shippingMethod: ShippingMethod;
  notes: string;
}

type FieldName = Exclude<keyof FormState, 'shippingMethod' | 'notes'>;
type Errors = Partial<Record<FieldName, string>>;

const EMPTY: FormState = {
  name: '',
  phone: '',
  email: '',
  addressLine: '',
  city: '',
  state: '',
  pincode: '',
  shippingMethod: 'standard',
  notes: '',
};

/** 10-digit Indian mobile number, accepting +91 / 0 prefixes and spaces. */
const normalisePhone = (raw: string) => {
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};

const validate = (f: FormState): Errors => {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!/^[6-9]\d{9}$/.test(normalisePhone(f.phone))) e.phone = 'Enter a 10-digit mobile number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
  if (f.addressLine.trim().length < 6) e.addressLine = 'Enter your house number, street and area.';
  if (!f.city.trim()) e.city = 'Enter your city.';
  if (!f.state) e.state = 'Choose your state.';
  if (!/^[1-9]\d{5}$/.test(f.pincode.trim())) e.pincode = 'Enter a 6-digit PIN code.';
  return e;
};

type Phase = 'form' | 'creating' | 'paying' | 'verifying' | 'verify-failed' | 'success';

interface Notice {
  tone: 'error' | 'info';
  title?: string;
  text: string;
  whatsapp?: boolean;
  action?: { label: string; run: () => void };
}

interface Success {
  orderNo: string;
  total: number;
  name: string;
  phone: string;
}

const lineLabel = (it: Pick<CartItem, 'productName' | 'variantSize' | 'variantFinish'>) =>
  [it.productName, [it.variantSize, it.variantFinish].filter(Boolean).join(', ')].filter(Boolean).join(' — ');

export const CheckoutModal: React.FC = () => {
  const cart = useCart();
  const { settings, refresh } = useSiteData();
  const { items, isCheckoutOpen, closeCheckout } = cart;
  const profile = settings.studio_profile;
  const rules = settings.shipping_rules;
  const reduce = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [phase, setPhase] = useState<Phase>('form');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  // A created (unpaid) order is reused for retries while the bag and details stay the same:
  // its photos are already attached to it, and Razorpay accepts several attempts per order.
  const [pending, setPending] = useState<{
    signature: string;
    itemsSignature: string;
    form: FormState;
    order: CreateOrderResponse;
  } | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const paymentRef = useRef<{ order: CreateOrderResponse; response: RazorpaySuccess } | null>(null);
  const busy = phase === 'creating' || phase === 'paying' || phase === 'verifying';

  const resetAfterSuccess = () => {
    setSuccess(null);
    setPhase('form');
    setNotice(null);
  };
  const close = () => {
    if (phase === 'creating' || phase === 'verifying') return;
    closeCheckout();
    if (phase === 'success') resetAfterSuccess();
  };
  useDialog(isCheckoutOpen, dialogRef, close, phase !== 'paying');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const subtotal = cart.subtotalPaise;
  const estimateShipping = shippingFor(subtotal, form.shippingMethod, rules);

  const lineNotes = useMemo(
    () =>
      items
        .map((it, i) => (it.note ? `Item ${i + 1} (${lineLabel(it)}): ${it.note}` : ''))
        .filter(Boolean),
    [items]
  );

  const body = useMemo<CreateOrderBody>(
    () => ({
      customerName: form.name.trim(),
      phone: normalisePhone(form.phone),
      email: form.email.trim(),
      shippingAddress: {
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        state: form.state,
        pincode: form.pincode.trim(),
        country: 'India',
      },
      items: items.map((it) => ({
        variantId: it.variantId,
        qty: it.quantity,
        ...(it.uploadKeys?.length ? { uploadKeys: it.uploadKeys } : {}),
      })),
      shippingMethod: form.shippingMethod,
      notes: [form.notes.trim(), ...lineNotes].filter(Boolean).join('\n') || undefined,
    }),
    [form, items, lineNotes]
  );
  const signature = useMemo(() => JSON.stringify(body), [body]);
  const itemsSignature = useMemo(() => JSON.stringify(body.items), [body.items]);
  const serverOrder = pending && pending.signature === signature ? pending.order : null;

  const whatsappText = useMemo(() => {
    const lines = items.map((it) => `• ${lineLabel(it)} × ${it.quantity}`);
    const photos = items.some((it) => it.uploadKeys?.length) ? '\nI’ll send my photos here as well.' : '';
    return `Hello ${profile.name}, I’d like to order:\n${lines.join('\n')}\nSubtotal ${formatINR(subtotal)}.${photos}`;
  }, [items, profile.name, subtotal]);
  const waHref = whatsappLink(profile.whatsapp || profile.phone, whatsappText);

  const nameOf = (variantId?: string) => {
    const it = variantId ? items.find((i) => i.variantId === variantId) : undefined;
    return it ? lineLabel(it) : '';
  };

  const handleCreateError = (err: unknown) => {
    const e = err instanceof ShopApiError ? err : null;
    const status = e?.status ?? 0;
    if (status === 503) {
      setNotice({
        tone: 'info',
        title: 'Online payment isn’t switched on yet.',
        text: 'Nothing has been charged. You can place this order with us on WhatsApp instead.',
        whatsapp: true,
      });
    } else if (status === 502) {
      setNotice({
        tone: 'error',
        title: 'The payment service didn’t respond.',
        text: 'Nothing has been charged. Please try again in a minute, or order with us on WhatsApp.',
        whatsapp: true,
      });
    } else if ((status === 400 || status === 409) && /photo/i.test(e?.message || '') && pending) {
      // The photos are attached to the unpaid order created earlier in this checkout.
      const canRestore = pending.itemsSignature === itemsSignature;
      const earlier = pending;
      setNotice({
        tone: 'error',
        title: `Your photos are attached to your unpaid order ${earlier.order.orderNo}.`,
        text: canRestore
          ? 'You can pay for that order with the details you entered first, or message us on WhatsApp to change them.'
          : 'Message us on WhatsApp and we’ll help you complete it.',
        whatsapp: true,
        action: canRestore
          ? {
              label: 'Use my earlier details',
              run: () => {
                setForm(earlier.form);
                setErrors({});
                setNotice(null);
              },
            }
          : undefined,
      });
    } else if ((status === 400 || status === 409) && e?.variantId) {
      const label = nameOf(e.variantId);
      setLineErrors({ [e.variantId]: e.message });
      setNotice({ tone: 'error', title: label ? `${label}:` : undefined, text: `${e.message} Please update your bag and try again.` });
      void refresh();
    } else if (status === 400 || status === 409) {
      setNotice({ tone: 'error', text: e?.message || 'Please check your details and try again.' });
    } else if (status === 429) {
      setNotice({ tone: 'error', text: 'Too many attempts. Please wait a few minutes and try again.' });
    } else if (status === 0) {
      setNotice({ tone: 'error', text: e?.message || 'Could not reach the shop. Check your connection and try again.' });
    } else {
      setNotice({
        tone: 'error',
        text: 'Something went wrong on our side. Nothing has been charged. Please try again, or order on WhatsApp.',
        whatsapp: true,
      });
    }
  };

  const confirm = async (order: CreateOrderResponse, response: RazorpaySuccess) => {
    paymentRef.current = { order, response };
    setPhase('verifying');
    setNotice(null);
    try {
      const res = await verifyPayment({
        orderId: order.orderId,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      });
      setSuccess({ orderNo: res.orderNo || order.orderNo, total: order.total, name: form.name.trim(), phone: normalisePhone(form.phone) });
      setPhase('success');
      setPending(null);
      paymentRef.current = null;
      cart.clear();
    } catch {
      setPhase('verify-failed');
    }
  };

  const startPayment = async (order: CreateOrderResponse) => {
    setPhase('paying');
    let Razorpay;
    try {
      Razorpay = await loadRazorpay();
    } catch (err) {
      setNotice({ tone: 'error', text: (err as Error).message, whatsapp: true });
      setPhase('form');
      return;
    }
    let failure = '';
    let paid = false;
    const rzp = new Razorpay({
      key: order.razorpay.keyId,
      order_id: order.razorpay.orderId,
      amount: order.razorpay.amount,
      currency: order.razorpay.currency || 'INR',
      name: profile.name,
      description: `Order ${order.orderNo}`,
      image: `${window.location.origin}/brand/logo-badge.png`,
      prefill: { name: form.name.trim(), email: form.email.trim(), contact: `+91${normalisePhone(form.phone)}` },
      notes: { order_no: order.orderNo },
      theme: { color: themeColor() },
      handler: (response) => {
        paid = true;
        void confirm(order, response);
      },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          if (paid) return;
          setPhase((p) => (p === 'paying' ? 'form' : p));
          setNotice(
            failure
              ? { tone: 'error', title: 'Payment failed.', text: `${failure} Your bag is saved — you can try again.` }
              : { tone: 'info', text: 'Payment not completed. Your bag is saved — you can try again whenever you’re ready.' }
          );
        },
      },
    });
    rzp.on('payment.failed', (res) => {
      failure = res.error?.description || 'The payment was declined.';
    });
    rzp.open();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !items.length) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      setNotice(null);
      return;
    }
    if (Object.keys(cart.issues).length) {
      setNotice({ tone: 'error', text: 'Some items in your bag need attention. Please review your bag.' });
      return;
    }
    setNotice(null);
    setLineErrors({});

    let order = serverOrder;
    if (!order) {
      setPhase('creating');
      try {
        order = await createOrder(body);
        setPending({ signature, itemsSignature, form, order });
      } catch (err) {
        handleCreateError(err);
        setPhase('form');
        return;
      }
    }
    await startPayment(order);
  };

  const shown = serverOrder
    ? { subtotal: serverOrder.subtotal, shipping: serverOrder.shipping, total: serverOrder.total }
    : { subtotal, shipping: estimateShipping, total: subtotal + estimateShipping };
  const gst = gstNote(settings.gst_config);

  const payLabel =
    phase === 'creating'
      ? 'Creating your order…'
      : phase === 'paying'
        ? 'Waiting for payment…'
        : phase === 'verifying'
          ? 'Confirming payment…'
          : `Pay ${formatINR(shown.total)}`;

  const standardPrice = shippingFor(subtotal, 'standard', rules);
  const showForm = items.length > 0 && phase !== 'success' && phase !== 'verify-failed';

  return (
    <AnimatePresence>
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[10001] flex items-stretch sm:items-center justify-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70"
            onClick={close}
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
            className={`relative w-full ${showForm ? 'sm:max-w-[980px]' : 'sm:max-w-[640px]'} max-h-[100dvh] sm:max-h-[calc(100dvh-3rem)] bg-canvas-elevated text-ink-light sm:rounded-[4px] shadow-2xl flex flex-col overflow-hidden`}
          >
            <header className="flex items-center justify-between gap-4 px-5 sm:px-8 h-16 border-b border-hairline flex-shrink-0">
              <h2 id="checkout-title" className="font-serif text-2xl leading-none">
                {phase === 'success' ? 'Order placed' : 'Checkout'}
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={phase === 'creating' || phase === 'verifying'}
                className="-mr-2 w-11 h-11 flex items-center justify-center text-ink-faint hover:text-ink-light rounded-[3px] disabled:opacity-40"
                aria-label="Close checkout"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {phase === 'success' && success ? (
                <SuccessView
                  success={success}
                  whatsapp={whatsappLink(profile.whatsapp || profile.phone, `Hello ${profile.name}, about my order ${success.orderNo}.`)}
                  onTrack={() => {
                    resetAfterSuccess();
                    cart.openTracking({ orderNo: success.orderNo, phone: success.phone });
                  }}
                  onClose={close}
                />
              ) : phase === 'verify-failed' && paymentRef.current ? (
                <div className="px-5 sm:px-8 py-10 max-w-xl">
                  <h3 className="font-serif text-3xl leading-tight">We’re still confirming your payment.</h3>
                  <p className="text-[15px] text-ink-faint mt-3 leading-relaxed">
                    Razorpay accepted the payment for order{' '}
                    <span className="text-ink-light tabular-nums">{paymentRef.current.order.orderNo}</span>, but our
                    server couldn’t confirm it just now. Please don’t pay again. Try confirming once more, or send us the
                    order number on WhatsApp and we’ll check it for you.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="btn-primary"
                      data-autofocus
                      onClick={() => paymentRef.current && void confirm(paymentRef.current.order, paymentRef.current.response)}
                    >
                      Confirm again
                    </button>
                    {waHref && (
                      <a
                        className="btn-quiet"
                        href={whatsappLink(
                          profile.whatsapp || profile.phone,
                          `Hello ${profile.name}, I paid for order ${paymentRef.current.order.orderNo} (payment ${paymentRef.current.response.razorpay_payment_id}) but the site couldn’t confirm it.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Message us on WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ) : !items.length ? (
                <div className="px-5 sm:px-8 py-10">
                  <p className="font-serif text-2xl">Your bag is empty.</p>
                  <button type="button" onClick={close} className="btn-quiet mt-6" data-autofocus>
                    Keep browsing
                  </button>
                </div>
              ) : (
                <form
                  id="checkout-form"
                  ref={formRef}
                  onSubmit={submit}
                  noValidate
                  className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]"
                >
                  <div className="px-5 sm:px-8 py-6 sm:py-8 space-y-8">
                    <fieldset disabled={busy} className="space-y-4">
                      <legend className="font-serif text-xl mb-4">Your details</legend>
                      <Field
                        label="Full name"
                        name="name"
                        autoComplete="name"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        error={errors.name}
                        data-autofocus
                      />
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Field
                          label="Mobile number"
                          name="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="98765 43210"
                          value={form.phone}
                          onChange={(e) => set('phone', e.target.value)}
                          error={errors.phone}
                        />
                        <Field
                          label="Email"
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={(e) => set('email', e.target.value)}
                          error={errors.email}
                        />
                      </div>
                    </fieldset>

                    <fieldset disabled={busy} className="space-y-4">
                      <legend className="font-serif text-xl mb-4">Delivery address</legend>
                      <Field
                        label="House, street and area"
                        name="addressLine"
                        autoComplete="street-address"
                        value={form.addressLine}
                        onChange={(e) => set('addressLine', e.target.value)}
                        error={errors.addressLine}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Field
                          label="City"
                          name="city"
                          autoComplete="address-level2"
                          value={form.city}
                          onChange={(e) => set('city', e.target.value)}
                          error={errors.city}
                        />
                        <Field
                          label="PIN code"
                          name="pincode"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          maxLength={6}
                          value={form.pincode}
                          onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))}
                          error={errors.pincode}
                        />
                      </div>
                      <div>
                        <label htmlFor="checkout-state" className="block text-sm text-ink-faint mb-1.5">
                          State
                        </label>
                        <select
                          id="checkout-state"
                          name="state"
                          autoComplete="address-level1"
                          value={form.state}
                          onChange={(e) => set('state', e.target.value)}
                          aria-invalid={errors.state ? true : undefined}
                          aria-describedby={errors.state ? 'checkout-state-error' : undefined}
                          className={`${inputClass} bg-canvas-elevated`}
                        >
                          <option value="">Choose…</option>
                          {INDIAN_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {errors.state && (
                          <p id="checkout-state-error" className="mt-1.5 text-[13px] text-red-400">
                            {errors.state}
                          </p>
                        )}
                      </div>
                      <p className="text-[13px] text-ink-faint">We deliver within India.</p>
                    </fieldset>

                    <fieldset disabled={busy}>
                      <legend className="font-serif text-xl mb-4">Delivery</legend>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {(['standard', 'express'] as const).map((m) => {
                          const price = m === 'standard' ? standardPrice : rules.expressDeliveryRatePaise;
                          const checked = form.shippingMethod === m;
                          return (
                            <label
                              key={m}
                              className={`flex items-start gap-3 min-h-[56px] px-4 py-3 rounded-[3px] border cursor-pointer transition-colors focus-within:outline focus-within:outline-1 focus-within:outline-accent focus-within:outline-offset-2 ${
                                checked ? 'border-accent bg-accent/[0.07]' : 'border-hairline-strong hover:border-ink-faint'
                              }`}
                            >
                              <input
                                type="radio"
                                name="shippingMethod"
                                value={m}
                                checked={checked}
                                onChange={() => set('shippingMethod', m)}
                                className="mt-1 accent-[var(--accent)]"
                              />
                              <span className="flex-1">
                                <span className="flex justify-between gap-3 text-[15px]">
                                  <span>{m === 'standard' ? 'Standard' : 'Express'}</span>
                                  <span className="tabular-nums">{price === 0 ? 'Free' : formatINR(price)}</span>
                                </span>
                                {m === 'standard' && rules.estimatedDeliveryDays && (
                                  <span className="block text-[13px] text-ink-faint mt-0.5">{rules.estimatedDeliveryDays}</span>
                                )}
                                {m === 'express' && <span className="block text-[13px] text-ink-faint mt-0.5">Faster courier</span>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <fieldset disabled={busy}>
                      <label htmlFor="checkout-notes" className="block text-sm text-ink-faint mb-1.5">
                        Notes for the studio (optional)
                      </label>
                      <textarea
                        id="checkout-notes"
                        value={form.notes}
                        maxLength={1000}
                        onChange={(e) => set('notes', e.target.value)}
                        rows={3}
                        className={`${inputClass} h-auto py-3 resize-y`}
                      />
                    </fieldset>
                  </div>

                  {/* Summary */}
                  <aside className="border-t lg:border-t-0 lg:border-l border-hairline bg-canvas-subtle/60 px-5 sm:px-8 py-6 sm:py-8 flex flex-col">
                    <h3 className="font-serif text-xl">Your order</h3>
                    <ul className="mt-4 divide-y divide-hairline">
                      {items.map((it) => (
                        <li key={lineKey(it)} className="py-3 flex gap-3">
                          <div className="w-12 aspect-[4/5] rounded-[2px] overflow-hidden bg-canvas-surface flex-shrink-0">
                            {(it.previewUrl || it.image) && <img src={it.previewUrl || it.image} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0 text-[14px]">
                            <div className="flex justify-between gap-3">
                              <span className="text-ink-light leading-snug">{it.productName}</span>
                              <span className="tabular-nums whitespace-nowrap">{formatINR(it.unitPricePaise * it.quantity)}</span>
                            </div>
                            <p className="text-[13px] text-ink-faint">
                              {[it.variantSize, it.variantFinish].filter(Boolean).join(' · ')}
                              {it.quantity > 1 ? ` · ${it.quantity} pcs` : ''}
                            </p>
                            {it.note && <p className="text-[13px] text-ink-faint">{it.note}</p>}
                            {!!it.uploadKeys?.length && (
                              <p className="text-[13px] text-ink-faint">
                                {it.uploadKeys.length === 1 ? 'Your photo attached' : `${it.uploadKeys.length} of your photos attached`}
                              </p>
                            )}
                            {(lineErrors[it.variantId] || cart.issues[lineKey(it)]) && (
                              <p className="text-[13px] text-red-400 mt-0.5">{lineErrors[it.variantId] || cart.issues[lineKey(it)]}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>

                    <dl className="mt-3 pt-4 border-t border-hairline space-y-1.5 text-[15px]">
                      <div className="flex justify-between">
                        <dt className="text-ink-faint">Subtotal</dt>
                        <dd className="tabular-nums">{formatINR(shown.subtotal)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-ink-faint">Delivery</dt>
                        <dd className="tabular-nums">{shown.shipping === 0 ? 'Free' : formatINR(shown.shipping)}</dd>
                      </div>
                      <div className="flex justify-between pt-2 mt-2 border-t border-hairline text-lg">
                        <dt>Total</dt>
                        <dd className="tabular-nums">{formatINR(shown.total)}</dd>
                      </div>
                    </dl>
                    {gst && <p className="text-[13px] text-ink-faint mt-1">{gst}</p>}
                    {serverOrder && (
                      <p className="text-[13px] text-ink-faint mt-1">
                        Order <span className="tabular-nums text-ink-light">{serverOrder.orderNo}</span> is waiting for payment.
                      </p>
                    )}

                    <p className="text-[13px] text-ink-faint mt-4 leading-relaxed">
                      You’ll pay securely with Razorpay — UPI, cards or netbanking. We confirm the order once the payment
                      goes through.
                    </p>
                  </aside>
                </form>
              )}
            </div>
            {showForm && (
              <footer className="flex-shrink-0 border-t border-hairline bg-canvas-elevated px-5 sm:px-8 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div aria-live="polite" className="empty:hidden max-h-[38vh] overflow-y-auto mb-3">
                  {notice && (
                    <div
                      className={`rounded-[3px] border px-4 py-3 text-[14px] leading-relaxed ${
                        notice.tone === 'error' ? 'border-red-400/50 text-ink-light' : 'border-hairline-strong text-ink-light'
                      }`}
                      role={notice.tone === 'error' ? 'alert' : undefined}
                    >
                      {notice.title && <p className="font-medium">{notice.title}</p>}
                      <p className={notice.title ? 'text-ink-faint' : ''}>{notice.text}</p>
                      {(notice.action || (notice.whatsapp && waHref)) && (
                        <div className="mt-1 flex flex-wrap gap-x-5">
                          {notice.action && (
                            <button type="button" onClick={notice.action.run} className="link-line min-h-[44px]">
                              {notice.action.label}
                            </button>
                          )}
                          {notice.whatsapp && waHref && (
                            <a href={waHref} target="_blank" rel="noopener noreferrer" className="link-line min-h-[44px]">
                              {notice.action ? 'Message us on WhatsApp' : 'Order on WhatsApp'}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 lg:justify-end">
                  <div className="flex flex-col leading-tight">
                    <span className="text-[12px] text-ink-faint">Total</span>
                    <span className="text-lg tabular-nums">{formatINR(shown.total)}</span>
                  </div>
                  <button
                    type="submit"
                    form="checkout-form"
                    className="btn-primary flex-1 lg:flex-none lg:w-[320px] disabled:opacity-60"
                    disabled={busy}
                  >
                    {!busy && <Lock size={15} aria-hidden="true" />}
                    {payLabel}
                  </button>
                </div>
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const SuccessView: React.FC<{ success: Success; whatsapp: string; onTrack: () => void; onClose: () => void }> = ({
  success,
  whatsapp,
  onTrack,
  onClose,
}) => (
  <div className="px-5 sm:px-8 py-10 sm:py-14 max-w-xl">
    <span className="w-11 h-11 rounded-full bg-accent text-canvas flex items-center justify-center" aria-hidden="true">
      <Check size={22} strokeWidth={2.5} />
    </span>
    <h3 className="font-serif text-4xl leading-tight mt-6">Thank you, {success.name.split(' ')[0]}.</h3>
    <p className="text-[15px] sm:text-base text-ink-faint mt-3 leading-relaxed">
      Your payment of <span className="text-ink-light tabular-nums">{formatINR(success.total)}</span> is confirmed and your
      order is placed. Your order number is
    </p>
    <p className="font-serif text-3xl mt-2 tabular-nums select-all">{success.orderNo}</p>
    <p className="text-[15px] text-ink-faint mt-3 leading-relaxed">
      Keep it handy: with it and your phone number you can check the order’s progress here any time.
    </p>
    <div className="mt-8 flex flex-wrap gap-3">
      <button type="button" className="btn-primary" onClick={onTrack} data-autofocus>
        Track this order
      </button>
      <button type="button" className="btn-quiet" onClick={onClose}>
        Continue browsing
      </button>
    </div>
    {whatsapp && (
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="link-line mt-6">
        Questions? Message us on WhatsApp
      </a>
    )}
  </div>
);
