import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { formatINR } from '@/lib/api';
import { Order } from '@/types';
import { Field } from './ui';
import { OrderLookup, ShopApiError, lookupOrder } from './shopApi';

const STATUS: Record<Order['status'], { label: string; text: string }> = {
  pending: { label: 'Awaiting payment', text: 'We haven’t received payment for this order.' },
  paid: { label: 'Order received', text: 'Payment received. Your order is being made.' },
  packed: { label: 'Packed', text: 'Packed and ready to ship.' },
  shipped: { label: 'Shipped', text: 'Your order is on its way.' },
  delivered: { label: 'Delivered', text: 'Your order has been delivered.' },
  cancelled: { label: 'Cancelled', text: 'This order was cancelled.' },
  refunded: { label: 'Refunded', text: 'This order was refunded.' },
};

const STEPS: Order['status'][] = ['paid', 'packed', 'shipped', 'delivered'];

const safeUrl = (url?: string | null) => (url && /^https?:\/\//i.test(url) ? url : '');

const formatDate = (iso: string) => {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface TrackOrderProps {
  prefill?: { orderNo?: string; phone?: string };
}

/** Order number + phone → GET /api/shop/orders/lookup. Nothing is read from the browser. */
export const TrackOrder: React.FC<TrackOrderProps> = ({ prefill }) => {
  const [orderNo, setOrderNo] = useState(prefill?.orderNo ?? '');
  const [phone, setPhone] = useState(prefill?.phone ?? '');
  const [errors, setErrors] = useState<{ orderNo?: string; phone?: string }>({});
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; order?: OrderLookup; message?: string }>({
    status: 'idle',
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const no = orderNo.trim().toUpperCase();
    const digits = phone.replace(/\D/g, '');
    const next: typeof errors = {};
    if (!no) next.orderNo = 'Enter your order number.';
    if (digits.length < 10) next.phone = 'Enter the 10-digit mobile number used for the order.';
    setErrors(next);
    if (Object.keys(next).length) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'loading' });
    try {
      const order = await lookupOrder(no, digits.slice(-10), controller.signal);
      setState({ status: 'done', order });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const status = err instanceof ShopApiError ? err.status : 0;
      const message =
        status === 404
          ? 'No order matches that number and phone. Please check both and try again.'
          : status === 429
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : (err as Error).message || 'Something went wrong. Please try again.';
      setState({ status: 'error', message });
    }
  };

  const order = state.order;
  const info = order ? STATUS[order.status] ?? { label: order.status, text: '' } : null;
  const stepIndex = order ? STEPS.indexOf(order.status) : -1;
  const tracking = safeUrl(order?.tracking_url);

  return (
    <div>
      <p className="text-[15px] text-ink-faint leading-relaxed">
        Enter the order number from your confirmation and the phone number you ordered with.
      </p>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <Field
          label="Order number"
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder="HI-261015-AB12"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          error={errors.orderNo}
          data-autofocus
        />
        <Field
          label="Phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="98765 43210"
          error={errors.phone}
        />
        <button type="submit" className="btn-primary w-full" disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Looking up…' : 'Find my order'}
        </button>
      </form>

      <div aria-live="polite">
        {state.status === 'error' && <p className="mt-5 text-[15px] text-red-400">{state.message}</p>}

        {order && info && (
          <div className="mt-8 border-t border-hairline pt-6">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-serif text-2xl">{info.label}</h3>
              <span className="text-sm text-ink-faint tabular-nums">{order.order_no}</span>
            </div>
            <p className="text-[15px] text-ink-faint mt-1">{info.text}</p>

            {stepIndex >= 0 && (
              <ol className="mt-5 grid grid-cols-4 gap-1.5" aria-label="Order progress">
                {STEPS.map((s, i) => (
                  <li key={s} className="text-[12px]">
                    <span className={`block h-[3px] rounded-full ${i <= stepIndex ? 'bg-accent' : 'bg-hairline-strong'}`} />
                    <span className={`block mt-1.5 ${i <= stepIndex ? 'text-ink-light' : 'text-ink-muted'}`}>
                      {STATUS[s].label === 'Order received' ? 'Paid' : STATUS[s].label}
                      {i === stepIndex && <span className="sr-only"> (current)</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {tracking && (
              <a href={tracking} target="_blank" rel="noopener noreferrer" className="btn-quiet w-full mt-6">
                Track the parcel <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}

            <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
              {order.items.map((it, i) => (
                <li key={i} className="py-3 flex justify-between gap-4 text-[15px]">
                  <span className="min-w-0">
                    <span className="block text-ink-light">{it.product_name}</span>
                    <span className="block text-[13px] text-ink-faint">
                      {[it.size, it.finish].filter(Boolean).join(' · ')}
                      {it.quantity > 1 ? ` · ${it.quantity} pcs` : ''}
                    </span>
                  </span>
                  <span className="tabular-nums text-ink-light">{formatINR(it.total_paise)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 text-[15px] space-y-1">
              <div className="flex justify-between">
                <dt className="text-ink-faint">Total</dt>
                <dd className="tabular-nums">{formatINR(order.total)}</dd>
              </div>
              {formatDate(order.created_at) && (
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Placed</dt>
                  <dd>{formatDate(order.created_at)}</dd>
                </div>
              )}
              {order.city && (
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Delivering to</dt>
                  <dd>{order.city}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
};
