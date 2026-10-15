import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { api, formatINR } from '@/lib/api';
import { useSiteData } from '@/context/SiteDataContext';
import { Inquiry, Order } from '@/types';
import { AdminSummary, useAdminData } from '../AdminDataContext';
import { Card, ErrorBanner, PageHeader, Spinner, cx, errorMessage, formatDateTime } from '../ui';
import { INQUIRY_STATUS_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from '../orderStatus';

interface Panel<T> {
  data: T | null;
  error: string | null;
}

const StatTile: React.FC<{ label: string; value: React.ReactNode; to?: string; hint?: string }> = ({ label, value, to, hint }) => {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-2 font-serif text-3xl text-ink-light">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </>
  );
  const cls = 'block rounded-lg border border-hairline-strong bg-canvas-elevated p-4 sm:p-5';
  return to ? (
    <Link to={to} className={cx(cls, 'transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
};

export const DashboardSection: React.FC = () => {
  const { settings } = useSiteData();
  const { refreshSummary } = useAdminData();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Panel<AdminSummary>>({ data: null, error: null });
  const [orders, setOrders] = useState<Panel<Order[]>>({ data: null, error: null });
  const [inquiries, setInquiries] = useState<Panel<Inquiry[]>>({ data: null, error: null });

  const load = useCallback(async () => {
    setLoading(true);
    const [s, o, i] = await Promise.allSettled([
      api<AdminSummary>('/api/admin/summary'),
      api<Order[]>('/api/admin/orders'),
      api<Inquiry[]>('/api/admin/inquiries'),
    ]);
    setSummary(s.status === 'fulfilled' ? { data: s.value, error: null } : { data: null, error: errorMessage(s.reason) });
    setOrders(o.status === 'fulfilled' ? { data: Array.isArray(o.value) ? o.value : [], error: null } : { data: null, error: errorMessage(o.reason) });
    setInquiries(i.status === 'fulfilled' ? { data: Array.isArray(i.value) ? i.value : [], error: null } : { data: null, error: errorMessage(i.reason) });
    setLoading(false);
    refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    load();
  }, [load]);

  const s = summary.data;
  const recentOrders = (orders.data || []).slice(0, 5);
  const newInquiries = (inquiries.data || []).filter((q) => q.status === 'new').slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="A quick look at orders, inquiries and stock." />

      {loading && !s && <Spinner />}
      <ErrorBanner message={summary.error} onRetry={load} />

      {s && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <StatTile label="Revenue" value={formatINR(s.revenuePaise || 0)} hint="From paid orders" to="/admin/orders" />
          <StatTile label="Paid orders" value={s.ordersPaid ?? 0} to="/admin/orders" />
          <StatTile label="Awaiting payment" value={s.ordersPending ?? 0} hint="Checkout started, not paid" to="/admin/orders" />
          <StatTile label="New inquiries" value={s.inquiriesNew ?? 0} to="/admin/inquiries" />
          <StatTile label="Photos" value={s.photos ?? 0} to="/admin/photos" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Latest orders"
          actions={
            <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              All orders <ArrowRight size={14} aria-hidden />
            </Link>
          }
        >
          <ErrorBanner message={orders.error} onRetry={load} />
          {orders.data && recentOrders.length === 0 && <p className="text-sm text-ink-faint">No orders yet.</p>}
          {recentOrders.length > 0 && (
            <ul className="divide-y divide-hairline">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-light">
                      <span className="font-mono text-accent">{o.order_no}</span> · {o.customer_name}
                    </p>
                    <p className="text-xs text-ink-faint">{formatDateTime(o.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatINR(o.total)}</span>
                    <span className={cx('rounded border px-2 py-0.5 text-[11px]', ORDER_STATUS_STYLE[o.status] || '')}>
                      {ORDER_STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="New inquiries"
          actions={
            <Link to="/admin/inquiries" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              All inquiries <ArrowRight size={14} aria-hidden />
            </Link>
          }
        >
          <ErrorBanner message={inquiries.error} onRetry={load} />
          {inquiries.data && newInquiries.length === 0 && <p className="text-sm text-ink-faint">No new inquiries.</p>}
          {newInquiries.length > 0 && (
            <ul className="divide-y divide-hairline">
              {newInquiries.map((q) => (
                <li key={q.id} className="py-3">
                  <p className="text-sm text-ink-light">
                    {q.name}
                    {q.shoot_type && <span className="text-ink-faint"> · {q.shoot_type}</span>}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {formatDateTime(q.created_at)} · {INQUIRY_STATUS_LABEL[q.status]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {s && (
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-300" aria-hidden /> Low stock
            </span>
          }
          description={`Sizes with ${settings.shop_config.lowStockThreshold} or fewer left. Change this number in Studio & shop settings.`}
        >
          {(s.lowStock || []).length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing is running low.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {s.lowStock.map((row, i) => (
                <li key={`${row.productName}-${row.size}-${row.finish}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    {row.productName}
                    <span className="text-ink-faint">
                      {' '}
                      · {row.size}
                      {row.finish ? ` · ${row.finish}` : ''}
                    </span>
                  </span>
                  <span className={row.stock === 0 ? 'text-red-300' : 'text-amber-300'}>
                    {row.stock === 0 ? 'Sold out' : `${row.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/products" className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline">
            Update stock in Products <ArrowRight size={14} aria-hidden />
          </Link>
        </Card>
      )}
    </div>
  );
};
