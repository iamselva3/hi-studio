import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, MessageCircle, Phone, Trash2 } from 'lucide-react';
import { api, formatINR } from '@/lib/api';
import { Order } from '@/types';
import { useAdminData } from '../AdminDataContext';
import {
  Button,
  EmptyState,
  ErrorBanner,
  Modal,
  Notice,
  PageHeader,
  SavedNote,
  SelectField,
  Spinner,
  cx,
  errorMessage,
  formatDateTime,
  inputClass,
  telLink,
  whatsappLink,
} from '../ui';
import { ORDER_STATUSES, ORDER_STATUS_HELP, ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, itemCount } from '../orderStatus';

type Filter = 'all' | Order['status'];

const StatusBadge: React.FC<{ status: Order['status'] }> = ({ status }) => (
  <span className={cx('inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs', ORDER_STATUS_STYLE[status] || 'border-zinc-600')}>
    {ORDER_STATUS_LABEL[status] || status}
  </span>
);

const items = (o: Order) => (Array.isArray(o.items) ? o.items : []);
const uploadsOf = (o: Order) => items(o).flatMap((it) => (Array.isArray(it.uploads) ? it.uploads : []));

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Stop spreadsheet apps from treating customer-typed text as a formula.
  if (/^[=@\t\r]/.test(s) || /^[+-](?![\d\s]*$)/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(orders: Order[]) {
  const header = ['Order no', 'Date', 'Customer', 'Phone', 'Email', 'City', 'Items', 'Total (INR)', 'Status'];
  const rows = orders.map((o) => [
    o.order_no,
    formatDateTime(o.created_at),
    o.customer_name,
    o.phone,
    o.email,
    o.shipping_address?.city || '',
    items(o)
      .map((it) => `${it.quantity} × ${it.product_name} (${[it.size, it.finish].filter(Boolean).join(', ')})`)
      .join('; '),
    ((Number(o.total) || 0) / 100).toFixed(2),
    ORDER_STATUS_LABEL[o.status] || o.status,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export const OrdersSection: React.FC = () => {
  const { refreshSummary } = useAdminData();
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState('loading');
    setLoadError(null);
    try {
      const list = await api<Order[]>('/api/admin/orders');
      setOrders(Array.isArray(list) ? list : []);
      setState('ready');
    } catch (err) {
      setLoadError(errorMessage(err));
      if (!quiet) setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const view = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (!term) return true;
      return (
        o.order_no?.toLowerCase().includes(term) ||
        o.customer_name?.toLowerCase().includes(term) ||
        o.email?.toLowerCase().includes(term) ||
        (digits.length >= 3 && (o.phone || '').replace(/\D/g, '').includes(digits))
      );
    });
  }, [orders, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach((o) => (c[o.status] = (c[o.status] || 0) + 1));
    return c;
  }, [orders]);

  const selected = orders.find((o) => o.id === selectedId) || null;

  // Replace the whole order: the server leaves out fields that were cleared (e.g. the tracking link).
  const replaceOrder = (saved: Order) => setOrders((prev) => prev.map((o) => (o.id === saved.id ? saved : o)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Orders start as “Awaiting payment” and change to “Paid” by themselves once the payment is confirmed. Only make and ship paid orders."
        actions={
          <Button onClick={() => downloadCsv(view)} disabled={!view.length}>
            <Download size={14} aria-hidden /> Export CSV ({view.length})
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter orders by status">
          {(['all', ...ORDER_STATUSES] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cx(
                'rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                filter === f ? 'border-accent bg-accent font-medium text-[#0D0C0B]' : 'border-hairline-strong text-ink-faint hover:text-ink-light'
              )}
            >
              {f === 'all' ? 'All' : ORDER_STATUS_LABEL[f]} <span className="opacity-70">({counts[f] || 0})</span>
            </button>
          ))}
        </div>
        <label className="block sm:w-80">
          <span className="sr-only">Search orders</span>
          <input
            type="search"
            className={inputClass}
            placeholder="Search order no, name, phone or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {state === 'loading' && <Spinner label="Loading orders…" />}
      {state === 'error' && <ErrorBanner message={loadError} onRetry={() => load()} />}
      {state === 'ready' && orders.length === 0 && <EmptyState title="No orders yet">Orders from the shop will appear here.</EmptyState>}
      {state === 'ready' && orders.length > 0 && view.length === 0 && <EmptyState title="No orders match" />}

      {view.length > 0 && (
        <>
          {/* Phones: cards */}
          <ul className="space-y-3 md:hidden">
            {view.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(o.id)}
                  className="w-full rounded-lg border border-hairline-strong bg-canvas-elevated p-4 text-left hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-sm text-accent">{o.order_no}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-ink-light">{o.customer_name}</p>
                  <p className="text-sm text-ink-faint">
                    {formatINR(o.total)} · {itemCount(o)} item{itemCount(o) === 1 ? '' : 's'} · {formatDateTime(o.created_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {/* Larger screens: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-hairline-strong bg-canvas-elevated md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline-strong text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Order</th>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Items</th>
                  <th scope="col" className="px-4 py-3 font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {view.map((o) => (
                  <tr key={o.id} className={cx('hover:bg-canvas/60', o.status === 'pending' && 'text-ink-faint')}>
                    <td className="px-4 py-3 font-mono text-accent">{o.order_no}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-faint">{formatDateTime(o.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="text-ink-light">{o.customer_name}</span>
                      <span className="block text-xs text-ink-faint">{o.shipping_address?.city}</span>
                    </td>
                    <td className="px-4 py-3">
                      {itemCount(o)}
                      {uploadsOf(o).length > 0 && <span className="block text-xs text-accent">{uploadsOf(o).length} customer photo(s)</span>}
                    </td>
                    <td className="px-4 py-3">{formatINR(o.total)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" onClick={() => setSelectedId(o.id)}>
                        Open<span className="sr-only"> order {o.order_no}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <OrderModal
          order={selected}
          onClose={() => setSelectedId(null)}
          onSaved={(o) => {
            replaceOrder(o);
            refreshSummary();
          }}
          onReload={() => load(true)}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Detail modal                                                        */
/* ------------------------------------------------------------------ */

const OrderModal: React.FC<{ order: Order; onClose: () => void; onSaved: (o: Order) => void; onReload: () => Promise<void> }> = ({
  order,
  onClose,
  onSaved,
  onReload,
}) => {
  const [status, setStatus] = useState<Order['status']>(order.status);
  const [tracking, setTracking] = useState(order.tracking_url || '');
  const [busy, setBusy] = useState<'status' | 'tracking' | 'uploads' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const uploads = uploadsOf(order);
  const addr = order.shipping_address;

  // When the saved order changes (after a save or reload), show the saved values.
  useEffect(() => setStatus(order.status), [order.status]);
  useEffect(() => setTracking(order.tracking_url || ''), [order.tracking_url]);

  const patch = async (kind: 'status' | 'tracking', body: { status?: Order['status']; trackingUrl?: string }) => {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      const saved = await api<Order>(`/api/admin/orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body });
      if (!saved || !saved.id) throw new Error('The server did not confirm the change.');
      onSaved(saved);
      setMessage(kind === 'status' ? `Status changed to “${ORDER_STATUS_LABEL[saved.status]}”.` : saved.tracking_url ? 'Tracking link saved.' : 'Tracking link removed.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const saveStatus = () => {
    if (status === order.status) return;
    if (order.status === 'pending' && status !== 'cancelled') {
      const ok = window.confirm(
        'This order has not been paid online. Only continue if you have confirmed the payment yourself (for example in your Razorpay dashboard).\n\n' +
          (status === 'paid' ? 'Marking it as paid also reduces the stock for its items.' : 'Stock is only reduced when an order is marked “Paid – to pack”, so choose that first if the customer has paid.')
      );
      if (!ok) return;
    }
    if (status === 'refunded' && !window.confirm('Marking as refunded does not send money back. Make the refund in Razorpay first. Continue?')) return;
    patch('status', { status });
  };

  const saveTracking = (value: string) => {
    const v = value.trim();
    if (v && !/^https?:\/\/\S+$/i.test(v)) {
      setError('The tracking link should start with http:// or https://');
      return;
    }
    patch('tracking', { trackingUrl: v });
  };

  const downloadAll = () => {
    uploads.forEach((u, i) => {
      window.setTimeout(() => {
        const a = document.createElement('a');
        a.href = u.url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 400);
    });
  };

  const deleteUploads = async () => {
    if (
      !window.confirm(
        `Permanently delete the ${uploads.length} photo(s) this customer uploaded for ${order.order_no}?\n\nDo this only after you have downloaded and printed them. This cannot be undone.`
      )
    )
      return;
    setBusy('uploads');
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ deleted: number }>(`/api/admin/orders/${encodeURIComponent(order.id)}/uploads`, { method: 'DELETE' });
      const n = Number(res?.deleted) || 0;
      setMessage(n ? `Deleted ${n} customer photo${n === 1 ? '' : 's'} from storage.` : 'No stored photos were found to delete.');
      await onReload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const wa = whatsappLink(order.phone, `Hello ${order.customer_name}, about your order ${order.order_no}`);

  return (
    <Modal
      title={`Order ${order.order_no}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {formatDateTime(order.created_at)} · {formatINR(order.total)} <StatusBadge status={order.status} />
        </span>
      }
      onClose={onClose}
      size="lg"
    >
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <SavedNote show={!!message} text={message || ''} />

      {/* Status & tracking */}
      <section className="space-y-4 rounded-md border border-hairline-strong bg-canvas p-4" aria-label="Status and tracking">
        <p className="text-sm text-ink-faint">{ORDER_STATUS_HELP[order.status]}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <SelectField
            label="Status"
            fieldClassName="flex-1"
            value={status}
            onChange={(v) => setStatus(v as Order['status'])}
            options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))}
          />
          <Button variant="primary" onClick={saveStatus} busy={busy === 'status'} disabled={status === order.status || !!busy}>
            Update status
          </Button>
        </div>
        <div className="space-y-1">
          <label htmlFor="tracking-url" className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
            Courier tracking link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="tracking-url"
              type="url"
              inputMode="url"
              className={inputClass}
              placeholder="https://…"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={() => saveTracking(tracking)} busy={busy === 'tracking'} disabled={tracking.trim() === (order.tracking_url || '') || !!busy}>
                Save link
              </Button>
              {order.tracking_url && (
                <Button variant="ghost" onClick={() => saveTracking('')} disabled={!!busy}>
                  Remove
                </Button>
              )}
            </div>
          </div>
          {order.tracking_url ? (
            <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              Open current tracking link <ExternalLink size={12} aria-hidden />
            </a>
          ) : (
            <p className="text-xs text-ink-faint">Customers see this link when they look up their order.</p>
          )}
        </div>
      </section>

      {/* Customer */}
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Customer">
        <div className="space-y-1 text-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-faint">Customer</h3>
          <p className="text-ink-light">{order.customer_name}</p>
          <p className="flex flex-wrap gap-3">
            <a href={telLink(order.phone)} className="inline-flex items-center gap-1 text-accent hover:underline">
              <Phone size={13} aria-hidden /> {order.phone}
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                <MessageCircle size={13} aria-hidden /> WhatsApp
              </a>
            )}
          </p>
          {order.email && (
            <a href={`mailto:${order.email}`} className="break-all text-accent hover:underline">
              {order.email}
            </a>
          )}
        </div>
        <div className="space-y-1 text-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-faint">Ship to</h3>
          {addr ? (
            <address className="not-italic text-ink-light">
              {addr.addressLine}
              <br />
              {[addr.city, addr.state].filter(Boolean).join(', ')} {addr.pincode}
              {addr.country && (
                <>
                  <br />
                  {addr.country}
                </>
              )}
            </address>
          ) : (
            <p className="text-ink-faint">No address recorded.</p>
          )}
        </div>
      </section>

      {/* Items */}
      <section className="space-y-2" aria-label="Items">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-faint">Items</h3>
        <ul className="divide-y divide-hairline rounded-md border border-hairline-strong">
          {items(order).map((it, idx) => (
            <li key={`${it.variant_id}-${idx}`} className="space-y-2 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-ink-light">{it.product_name}</p>
                  <p className="text-ink-faint">
                    {[it.size, it.finish].filter(Boolean).join(' · ')} · {it.quantity} × {formatINR(it.unit_price_paise)}
                  </p>
                </div>
                <span className="whitespace-nowrap">{formatINR(it.total_paise)}</span>
              </div>
              {Array.isArray(it.uploads) && it.uploads.length > 0 && (
                <div>
                  <p className="text-xs text-ink-faint">Customer photos for this item:</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {it.uploads.map((u, i) => (
                      <li key={u.key}>
                        <a href={u.url} download className="inline-flex items-center gap-1 rounded border border-hairline-strong px-2 py-1 text-xs text-accent hover:border-accent">
                          <Download size={12} aria-hidden /> Photo {i + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(it.upload_keys) && it.upload_keys.length > 0 && !(it.uploads && it.uploads.length) && (
                <p className="text-xs text-ink-faint">The customer’s photos for this item have been deleted from storage.</p>
              )}
            </li>
          ))}
          {items(order).length === 0 && <li className="p-3 text-sm text-ink-faint">No items recorded.</li>}
        </ul>
        <dl className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-ink-faint">Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-faint">Shipping</dt><dd>{order.shipping ? formatINR(order.shipping) : 'Free'}</dd></div>
          <div className="flex justify-between border-t border-hairline pt-1 font-medium"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
        </dl>
      </section>

      {uploads.length > 0 && (
        <section className="space-y-3 rounded-md border border-hairline-strong bg-canvas p-4" aria-label="Customer photos">
          <p className="text-sm text-ink-faint">
            {uploads.length} photo{uploads.length === 1 ? '' : 's'} uploaded by the customer. Download them for printing, then delete them to free up storage.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadAll}>
              <Download size={14} aria-hidden /> Download all
            </Button>
            <Button variant="danger" onClick={deleteUploads} busy={busy === 'uploads'} disabled={!!busy}>
              <Trash2 size={14} aria-hidden /> Delete customer photos
            </Button>
          </div>
        </section>
      )}

      {order.notes && (
        <section className="text-sm" aria-label="Notes">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-faint">Customer note</h3>
          <p className="mt-1 whitespace-pre-wrap text-ink-light">{order.notes}</p>
        </section>
      )}

      <section className="space-y-1 text-xs text-ink-faint" aria-label="Payment">
        <h3 className="font-medium uppercase tracking-wide">Payment</h3>
        {order.paid_at && <p>Paid: {formatDateTime(order.paid_at)}</p>}
        {order.razorpay_payment_id ? <p>Razorpay payment: <span className="font-mono">{order.razorpay_payment_id}</span></p> : <p>No payment recorded yet.</p>}
        {order.razorpay_order_id && <p>Razorpay order: <span className="font-mono">{order.razorpay_order_id}</span></p>}
      </section>

      {order.status === 'pending' && (
        <Notice tone="warn">This order is still awaiting payment. If the customer abandoned checkout, you can set it to Cancelled.</Notice>
      )}
    </Modal>
  );
};
