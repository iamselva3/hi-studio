import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useSiteData } from '@/context/SiteDataContext';
import { formatINR } from '@/lib/api';

const TABS = [
  { id: 'shipping', label: 'Shipping' },
  { id: 'returns', label: 'Returns' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
];

export const PolicyPage: React.FC = () => {
  const { type = 'shipping' } = useParams<{ type: string }>();
  const { settings } = useSiteData();
  const p = settings.studio_profile;
  const ship = settings.shipping_rules;
  const contact = (
    <>
      {p.email && (
        <a className="text-ink-light underline underline-offset-4" href={`mailto:${p.email}`}>
          {p.email}
        </a>
      )}
      {p.email && ' or '}
      <a className="text-ink-light underline underline-offset-4" href={`tel:${p.phone.replace(/\s/g, '')}`}>
        {p.phone}
      </a>
    </>
  );

  const policies: Record<string, { title: string; body: React.ReactNode[] }> = {
    shipping: {
      title: 'Shipping',
      body: [
        <>Frames, albums and diaries are made to order in our {p.city} workshop and shipped within India.</>,
        <>Typical delivery time: {ship.estimatedDeliveryDays}. We'll share a tracking link once your order is dispatched.</>,
        <>
          Standard shipping is {formatINR(ship.baseStandardRatePaise)}, and free on orders above{' '}
          {formatINR(ship.freeShippingThresholdPaise)}. Express shipping is {formatINR(ship.expressDeliveryRatePaise)}.
        </>,
        <>Questions about a delivery? Contact us at {contact}.</>,
      ],
    },
    returns: {
      title: 'Returns',
      body: [
        <>Because every piece is made to order with your photographs, we can't take back items you've changed your mind about.</>,
        <>
          If something arrives damaged or with a defect, tell us within 48 hours of delivery with photos of the item and the packaging,
          and we'll repair, remake or refund it.
        </>,
        <>To report a problem, contact us at {contact}.</>,
      ],
    },
    privacy: {
      title: 'Privacy',
      body: [
        <>We collect only what we need to reply to enquiries and deliver orders: your name, phone, email and delivery address.</>,
        <>
          Photos you upload for printing are stored privately, used only to make your order, and deleted after it is delivered. We never
          publish your photos or use them for marketing without your written permission.
        </>,
        <>Payments are handled by Razorpay; we never see or store your card or bank details.</>,
        <>To see or delete the information we hold about you, contact us at {contact}.</>,
      ],
    },
    terms: {
      title: 'Terms',
      body: [
        <>Prices are in Indian rupees{settings.gst_config.isPriceInclusive ? ' and include GST' : ''}. An order is confirmed once payment is received.</>,
        <>Photography bookings are confirmed with a written agreement covering dates, coverage, deliverables and payment.</>,
        <>{settings.studio_profile.legalName || p.name} keeps the copyright of photographs we take; you may print and share them for personal use.</>,
        <>These terms are governed by the laws of {p.state}, India. Questions? Contact us at {contact}.</>,
      ],
    },
  };

  const policy = policies[type];
  if (!policy) return <Navigate to="/policies/shipping" replace />;

  return (
    <div className="min-h-screen bg-canvas text-ink-light">
      <Navigation />
      <main className="container-site pt-32 pb-24">
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]" aria-label="Policies">
          {TABS.map((t) => (
            <Link key={t.id} to={`/policies/${t.id}`} className={t.id === type ? 'text-ink-light' : 'text-ink-faint hover:text-ink-light'}>
              {t.label}
            </Link>
          ))}
        </nav>
        <h1 className="mt-10 font-serif text-5xl sm:text-6xl">{policy.title}</h1>
        <div className="mt-10 max-w-2xl space-y-5 text-[17px] leading-relaxed text-ink-faint">
          {policy.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};
