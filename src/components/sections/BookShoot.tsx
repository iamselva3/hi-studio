import React, { useState } from 'react';
import { MessageCircle, Phone, Mail, MapPin, Clock, Check } from 'lucide-react';
import { useSiteData } from '@/context/SiteDataContext';
import { api, ApiError } from '@/lib/api';
import { useReveal } from '@/hooks/useReveal';

const EMPTY = { name: '', phone: '', email: '', shootType: '', eventDate: '', location: '', message: '' };

const inputClass =
  'w-full h-12 px-4 bg-transparent border border-hairline-strong rounded-[3px] text-ink-light placeholder:text-ink-faint/60 focus:border-accent outline-none transition-colors';

export const BookShoot: React.FC = () => {
  const { settings } = useSiteData();
  const p = settings.studio_profile;
  const whatsapp = p.whatsapp.replace(/\D/g, '');
  const shootTypes = [...Object.values(settings.portfolio).map((c) => c.label), 'Something else'];

  const [form, setForm] = useState({ ...EMPTY, shootType: shootTypes[0] });
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState({ name: '', phone: '' });
  const revealRef = useReveal<HTMLElement>();

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const whatsappText = (withDetails: boolean) => {
    const lines = [`Hello ${p.name}, I'd like to ask about a shoot.`];
    if (withDetails) {
      if (form.name) lines.push(`Name: ${form.name}`);
      if (form.shootType) lines.push(`Shoot: ${form.shootType}`);
      if (form.eventDate) lines.push(`Date: ${form.eventDate}`);
      if (form.location) lines.push(`Place: ${form.location}`);
      if (form.message) lines.push(form.message);
    }
    return `https://wa.me/${whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = form.phone.replace(/\D/g, '');
    if (!form.name.trim()) return fail('Please tell us your name.');
    if (digits.length < 7 || digits.length > 15) return fail('Please enter a phone number we can call you on.');
    setState('sending');
    setError('');
    try {
      await api('/api/inquiries', { method: 'POST', body: form });
      setSentTo({ name: form.name.trim().split(' ')[0], phone: form.phone });
      setForm({ ...EMPTY, shootType: shootTypes[0] });
      setState('sent');
    } catch (err) {
      fail(
        err instanceof ApiError && err.status < 500
          ? err.message
          : "We couldn't send your message just now. Please try again, or message us on WhatsApp."
      );
    }
  };

  function fail(message: string) {
    setError(message);
    setState('error');
  }

  return (
    <section id="contact" ref={revealRef} className="border-t border-hairline py-20 sm:py-28">
      <div className="container-site grid grid-cols-1 gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5" data-reveal>
          <h2 className="font-serif text-4xl sm:text-5xl text-ink-light leading-[1.05]">Tell us about your day</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-faint max-w-md">
            Send the date and the place, and we'll get back to you with availability and prices. If it's easier, call or
            WhatsApp us.
          </p>

          {whatsapp && (
            <a href={whatsappText(false)} target="_blank" rel="noreferrer" className="btn-quiet mt-8">
              <MessageCircle size={18} />
              Message us on WhatsApp
            </a>
          )}

          <ul className="mt-10 space-y-4 text-[15px] text-ink-faint">
            <li className="flex gap-3">
              <Phone size={18} className="mt-0.5 shrink-0 text-accent" />
              <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="text-ink-light hover:text-accent">
                {p.phone}
              </a>
            </li>
            {p.email && (
              <li className="flex gap-3">
                <Mail size={18} className="mt-0.5 shrink-0 text-accent" />
                <a href={`mailto:${p.email}`} className="hover:text-ink-light break-all">
                  {p.email}
                </a>
              </li>
            )}
            <li className="flex gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
              <span>
                {p.address}, {p.city} {p.pincode}
              </span>
            </li>
            {p.hours && (
              <li className="flex gap-3">
                <Clock size={18} className="mt-0.5 shrink-0 text-accent" />
                <span>{p.hours}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-7" data-reveal style={{ ['--reveal-delay' as string]: '120ms' }}>
          {state === 'sent' ? (
            <div className="h-full min-h-[420px] flex flex-col justify-center border-t border-hairline pt-10" role="status">
              <span className="w-12 h-12 rounded-full bg-accent text-canvas inline-flex items-center justify-center">
                <Check size={22} />
              </span>
              <h3 className="mt-6 font-serif text-3xl text-ink-light">Thank you{sentTo.name ? `, ${sentTo.name}` : ''}.</h3>
              <p className="mt-3 text-ink-faint max-w-md">
                Your message has reached us. We'll call you on {sentTo.phone} soon.
              </p>
              <button onClick={() => setState('idle')} className="link-line mt-8 self-start">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 gap-5 sm:grid-cols-2" noValidate>
              <div className="space-y-2">
                <label htmlFor="bk-name" className="text-sm text-ink-faint">Your name</label>
                <input id="bk-name" className={inputClass} value={form.name} onChange={set('name')} autoComplete="name" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="bk-phone" className="text-sm text-ink-faint">Phone</label>
                <input id="bk-phone" className={inputClass} value={form.phone} onChange={set('phone')} type="tel" inputMode="tel" autoComplete="tel" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="bk-email" className="text-sm text-ink-faint">Email <span className="text-ink-faint/60">(optional)</span></label>
                <input id="bk-email" className={inputClass} value={form.email} onChange={set('email')} type="email" autoComplete="email" />
              </div>
              <div className="space-y-2">
                <label htmlFor="bk-type" className="text-sm text-ink-faint">What would you like photographed?</label>
                <select id="bk-type" className={`${inputClass} appearance-none bg-canvas`} value={form.shootType} onChange={set('shootType')}>
                  {shootTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="bk-date" className="text-sm text-ink-faint">Date <span className="text-ink-faint/60">(if you know it)</span></label>
                <input id="bk-date" className={inputClass} value={form.eventDate} onChange={set('eventDate')} type="date" />
              </div>
              <div className="space-y-2">
                <label htmlFor="bk-place" className="text-sm text-ink-faint">City or venue</label>
                <input id="bk-place" className={inputClass} value={form.location} onChange={set('location')} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="bk-msg" className="text-sm text-ink-faint">Anything else we should know?</label>
                <textarea
                  id="bk-msg"
                  className={`${inputClass} h-32 py-3 resize-y`}
                  value={form.message}
                  onChange={set('message')}
                />
              </div>

              {state === 'error' && (
                <p className="sm:col-span-2 text-[15px] text-[#E08A7A]" role="alert">
                  {error}{' '}
                  {whatsapp && (
                    <a href={whatsappText(true)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      Send it on WhatsApp instead
                    </a>
                  )}
                </p>
              )}

              <div className="sm:col-span-2 flex flex-wrap items-center gap-5 pt-2">
                <button type="submit" className="btn-primary min-w-[180px]" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Sending…' : 'Send message'}
                </button>
                <span className="text-sm text-ink-faint">We only use your details to reply to you.</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
