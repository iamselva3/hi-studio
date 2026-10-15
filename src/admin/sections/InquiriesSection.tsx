import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Mail, MapPin, MessageCircle, Phone, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useSiteData } from '@/context/SiteDataContext';
import { Inquiry } from '@/types';
import { useAdminData } from '../AdminDataContext';
import { EmptyState, ErrorBanner, IconButton, PageHeader, Spinner, cx, errorMessage, formatDate, formatDateTime, telLink, whatsappLink } from '../ui';
import { INQUIRY_STATUSES, INQUIRY_STATUS_LABEL, INQUIRY_STATUS_STYLE } from '../orderStatus';

type Filter = 'open' | Inquiry['status'] | 'all';

export const InquiriesSection: React.FC = () => {
  const { settings } = useSiteData();
  const { refreshSummary } = useAdminData();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Filter>('open');

  const load = useCallback(async () => {
    setState('loading');
    setLoadError(null);
    try {
      const list = await api<Inquiry[]>('/api/admin/inquiries');
      setInquiries(Array.isArray(list) ? list : []);
      setState('ready');
    } catch (err) {
      setLoadError(errorMessage(err));
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: inquiries.length, open: 0 };
    inquiries.forEach((q) => {
      c[q.status] = (c[q.status] || 0) + 1;
      if (q.status !== 'archived') c.open += 1;
    });
    return c;
  }, [inquiries]);

  const view = inquiries.filter((q) => (filter === 'all' ? true : filter === 'open' ? q.status !== 'archived' : q.status === filter));

  const setStatus = async (q: Inquiry, status: Inquiry['status']) => {
    if (status === q.status) return;
    setError(null);
    setBusyIds((b) => ({ ...b, [q.id]: true }));
    try {
      const saved = await api<Inquiry>(`/api/admin/inquiries/${encodeURIComponent(q.id)}`, { method: 'PATCH', body: { status } });
      if (!saved || !saved.id) throw new Error('The server did not confirm the change.');
      setInquiries((prev) => prev.map((x) => (x.id === q.id ? saved : x)));
      refreshSummary();
    } catch (err) {
      setError(`Could not update ${q.name}: ${errorMessage(err)}`);
    } finally {
      setBusyIds((b) => ({ ...b, [q.id]: false }));
    }
  };

  const remove = async (q: Inquiry) => {
    if (!window.confirm(`Delete the inquiry from ${q.name}? This cannot be undone.\n\nTip: use “Archived” to keep it out of the way instead.`)) return;
    setError(null);
    setBusyIds((b) => ({ ...b, [q.id]: true }));
    try {
      await api(`/api/admin/inquiries/${encodeURIComponent(q.id)}`, { method: 'DELETE' });
      setInquiries((prev) => prev.filter((x) => x.id !== q.id));
      refreshSummary();
    } catch (err) {
      setError(`Could not delete the inquiry from ${q.name}: ${errorMessage(err)}`);
      setBusyIds((b) => ({ ...b, [q.id]: false }));
    }
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'open', label: 'Open' },
    ...INQUIRY_STATUSES.map((s) => ({ id: s as Filter, label: INQUIRY_STATUS_LABEL[s] })),
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Inquiries" description="Shoot enquiries sent from the website’s booking form. Newest first." />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter inquiries">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cx(
              'rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              filter === f.id ? 'border-accent bg-accent font-medium text-[#0D0C0B]' : 'border-hairline-strong text-ink-faint hover:text-ink-light'
            )}
          >
            {f.label} <span className="opacity-70">({counts[f.id] || 0})</span>
          </button>
        ))}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {state === 'loading' && <Spinner label="Loading inquiries…" />}
      {state === 'error' && <ErrorBanner message={loadError} onRetry={load} />}
      {state === 'ready' && inquiries.length === 0 && (
        <EmptyState title="No inquiries yet">When someone fills in the booking form on the website, it shows up here.</EmptyState>
      )}
      {state === 'ready' && inquiries.length > 0 && view.length === 0 && <EmptyState title="Nothing in this list" />}

      <ul className="space-y-4">
        {view.map((q) => {
          const busy = !!busyIds[q.id];
          const wa = whatsappLink(
            q.phone,
            `Hello ${q.name}, thank you for contacting ${settings.studio_profile.name}${q.shoot_type ? ` about your ${q.shoot_type.toLowerCase()} shoot` : ''}.`
          );
          return (
            <li key={q.id} className="space-y-4 rounded-lg border border-hairline-strong bg-canvas-elevated p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-xl text-ink-light">{q.name}</p>
                  <p className="text-sm text-ink-faint">
                    {q.shoot_type || 'Shoot type not given'} · received {formatDateTime(q.created_at)}
                  </p>
                </div>
                <span className={cx('rounded border px-2 py-0.5 text-xs', INQUIRY_STATUS_STYLE[q.status])}>{INQUIRY_STATUS_LABEL[q.status] || q.status}</span>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <a href={telLink(q.phone)} className="inline-flex items-center gap-2 text-accent hover:underline">
                  <Phone size={14} aria-hidden /> {q.phone}
                </a>
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-emerald-300 hover:underline">
                    <MessageCircle size={14} aria-hidden /> WhatsApp
                  </a>
                ) : (
                  <span />
                )}
                {q.email ? (
                  <a href={`mailto:${q.email}`} className="inline-flex min-w-0 items-center gap-2 break-all text-accent hover:underline">
                    <Mail size={14} aria-hidden className="flex-shrink-0" /> {q.email}
                  </a>
                ) : (
                  <span className="text-ink-faint">No email given</span>
                )}
                <span className="inline-flex items-center gap-2 text-ink-faint">
                  <Calendar size={14} aria-hidden /> {q.event_date ? formatDate(q.event_date) : 'Date not decided'}
                </span>
                {q.location && (
                  <span className="inline-flex items-center gap-2 text-ink-faint sm:col-span-2">
                    <MapPin size={14} aria-hidden /> {q.location}
                  </span>
                )}
              </div>

              {q.message && <p className="whitespace-pre-wrap rounded-md border border-hairline bg-canvas p-3 text-sm text-ink-light">{q.message}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Status for ${q.name}`}>
                  {INQUIRY_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      aria-pressed={q.status === s}
                      onClick={() => setStatus(q, s)}
                      className={cx(
                        'rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        q.status === s ? 'border-accent bg-accent/15 text-accent' : 'border-hairline-strong text-ink-faint hover:text-ink-light'
                      )}
                    >
                      {INQUIRY_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                <IconButton label={`Delete inquiry from ${q.name}`} tone="danger" disabled={busy} onClick={() => remove(q)}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
