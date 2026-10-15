import React from 'react';
import { useSiteData } from '@/context/SiteDataContext';
import { PhotoCategory, ProcessStep, StudioSettings, Testimonial } from '@/types';
import { SettingsCard, useSettingDraft } from '../useSettingDraft';
import { ListEditor, PhotoPicker } from '../editors';
import { ErrorBanner, Notice, PageHeader, Spinner, TextAreaField, TextField, Toggle, newId } from '../ui';

const CATEGORIES: PhotoCategory[] = ['weddings', 'baby', 'candid', 'portraits'];
const CATEGORY_KEYS: Record<PhotoCategory, string> = {
  weddings: 'Weddings',
  baby: 'Children & family',
  candid: 'Candid',
  portraits: 'Portraits',
};

const required = (pairs: [string, string][]) => {
  const missing = pairs.filter(([, v]) => !v.trim()).map(([k]) => k);
  return missing.length ? `Please fill in: ${missing.join(', ')}.` : null;
};

/* ------------------------------------------------------------------ */

const HeroEditor: React.FC = () => {
  const s = useSettingDraft('hero');
  const d = s.draft;
  const set = (patch: Partial<StudioSettings['hero']>) => s.setDraft({ ...d, ...patch });
  return (
    <SettingsCard
      title="Home page – top section"
      description="The first thing visitors see."
      state={s}
      validate={(v) => required([['Headline', v.headline]])}
      prepare={(v) => ({
        ...v,
        headline: v.headline.trim(),
        subheading: v.subheading.trim(),
        primaryCtaLabel: v.primaryCtaLabel.trim(),
        secondaryCtaLabel: v.secondaryCtaLabel.trim(),
      })}
    >
      <TextField label="Headline" required value={d.headline} onChange={(v) => set({ headline: v })} maxLength={140} />
      <TextAreaField label="Text under the headline" value={d.subheading} onChange={(v) => set({ subheading: v })} rows={3} maxLength={400} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Main button text"
          value={d.primaryCtaLabel}
          onChange={(v) => set({ primaryCtaLabel: v })}
          hint="Opens the booking form."
          maxLength={40}
        />
        <TextField
          label="Second button text"
          value={d.secondaryCtaLabel}
          onChange={(v) => set({ secondaryCtaLabel: v })}
          hint="Goes to the shop."
          maxLength={40}
        />
      </div>
      <PhotoPicker
        label="Photos (up to 7, in this order)"
        hint="Leave empty to use your featured photos automatically."
        value={d.photoIds || []}
        max={7}
        onChange={(ids) => set({ photoIds: ids })}
      />
    </SettingsCard>
  );
};

const StoryEditor: React.FC = () => {
  const s = useSettingDraft('story');
  const d = s.draft;
  const set = (patch: Partial<StudioSettings['story']>) => s.setDraft({ ...d, ...patch });
  return (
    <SettingsCard
      title="Our story"
      description="The section about how you work."
      state={s}
      validate={(v) =>
        required([['Heading', v.heading]]) || (v.paragraphs.some((p) => !p.trim()) ? 'Please fill in or remove the empty paragraph.' : null)
      }
      prepare={(v) => ({ ...v, heading: v.heading.trim(), paragraphs: v.paragraphs.map((p) => p.trim()) })}
    >
      <TextField label="Heading" required value={d.heading} onChange={(v) => set({ heading: v })} maxLength={160} />
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Paragraphs</p>
        <ListEditor
          items={d.paragraphs}
          onChange={(paragraphs) => set({ paragraphs })}
          makeItem={() => ''}
          itemLabel={(_, i) => `Paragraph ${i + 1}`}
          addLabel="Add paragraph"
          max={6}
          emptyText="No paragraphs yet."
          renderItem={(p, update, i) => <TextAreaField label={`Paragraph ${i + 1} text`} value={p} onChange={update} rows={4} />}
        />
      </div>
      <PhotoPicker label="Photo" value={d.photoId ? [d.photoId] : []} max={1} onChange={(ids) => set({ photoId: ids[0] || '' })} />
    </SettingsCard>
  );
};

const ProcessEditor: React.FC = () => {
  const s = useSettingDraft('process');
  const d = s.draft;
  return (
    <SettingsCard
      title="How it works"
      description="The steps from first call to delivery."
      state={s}
      validate={(v) =>
        required([['Heading', v.heading]]) || (v.steps.some((st) => !st.title.trim()) ? 'Every step needs a title.' : null)
      }
      prepare={(v) => ({
        heading: v.heading.trim(),
        steps: v.steps.map((st) => ({ title: st.title.trim(), when: st.when.trim(), text: st.text.trim() })),
      })}
    >
      <TextField label="Heading" required value={d.heading} onChange={(v) => s.setDraft({ ...d, heading: v })} maxLength={160} />
      <ListEditor<ProcessStep>
        items={d.steps}
        onChange={(steps) => s.setDraft({ ...d, steps })}
        makeItem={() => ({ title: '', when: '', text: '' })}
        itemLabel={(st, i) => `Step ${i + 1}${st.title ? ` – ${st.title}` : ''}`}
        addLabel="Add step"
        max={8}
        emptyText="No steps yet. The section is hidden until you add one."
        renderItem={(st, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Title" required value={st.title} onChange={(v) => update({ ...st, title: v })} maxLength={60} />
            <TextField label="When" value={st.when} onChange={(v) => update({ ...st, when: v })} placeholder="e.g. 3–4 weeks" maxLength={60} />
            <TextAreaField label="Description" fieldClassName="sm:col-span-2" value={st.text} onChange={(v) => update({ ...st, text: v })} rows={2} />
          </div>
        )}
      />
    </SettingsCard>
  );
};

const TestimonialsEditor: React.FC = () => {
  const s = useSettingDraft('testimonials');
  const list = s.draft;
  return (
    <SettingsCard
      title="Client words"
      description="Quotes from your clients."
      state={s}
      validate={(v) => (v.some((t) => !t.quote.trim() || !t.name.trim()) ? 'Every quote needs the words and the client’s name.' : null)}
      prepare={(v) => v.map((t) => ({ id: t.id || newId(), quote: t.quote.trim(), name: t.name.trim(), event: t.event.trim() }))}
    >
      <Notice>
        Only add words your clients really said, with their permission. This section is hidden on the website while the list is empty.
      </Notice>
      <ListEditor<Testimonial>
        items={list}
        onChange={(next) => s.setDraft(next)}
        makeItem={() => ({ id: newId(), quote: '', name: '', event: '' })}
        itemLabel={(t, i) => `Quote ${i + 1}${t.name ? ` – ${t.name}` : ''}`}
        addLabel="Add a quote"
        max={20}
        emptyText="No quotes yet."
        renderItem={(t, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextAreaField label="What they said" required fieldClassName="sm:col-span-2" value={t.quote} onChange={(v) => update({ ...t, quote: v })} rows={3} maxLength={600} />
            <TextField label="Name" required value={t.name} onChange={(v) => update({ ...t, name: v })} placeholder="e.g. Priya & Arjun" maxLength={80} />
            <TextField label="Occasion" value={t.event} onChange={(v) => update({ ...t, event: v })} placeholder="e.g. Wedding, Coimbatore" maxLength={80} />
          </div>
        )}
      />
    </SettingsCard>
  );
};

const PortfolioEditor: React.FC = () => {
  const s = useSettingDraft('portfolio');
  const d = s.draft;
  const set = (cat: PhotoCategory, patch: Partial<StudioSettings['portfolio'][PhotoCategory]>) =>
    s.setDraft({ ...d, [cat]: { ...d[cat], ...patch } });
  return (
    <SettingsCard
      title="Portfolio categories"
      description="Names and short descriptions of the four photo categories. These names are also used in the Photos page."
      state={s}
      validate={(v) => required(CATEGORIES.map((c) => [`${CATEGORY_KEYS[c]} name`, v[c]?.label || ''] as [string, string]))}
      prepare={(v) =>
        Object.fromEntries(CATEGORIES.map((c) => [c, { label: v[c].label.trim(), description: v[c].description.trim() }])) as StudioSettings['portfolio']
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {CATEGORIES.map((c) => (
          <div key={c} className="space-y-3 rounded-md border border-hairline-strong bg-canvas p-3">
            <TextField label={`Name (${CATEGORY_KEYS[c]} photos)`} required value={d[c]?.label || ''} onChange={(v) => set(c, { label: v })} maxLength={40} />
            <TextAreaField label="Description" value={d[c]?.description || ''} onChange={(v) => set(c, { description: v })} rows={2} maxLength={240} />
          </div>
        ))}
      </div>
    </SettingsCard>
  );
};

const SplashEditor: React.FC = () => {
  const s = useSettingDraft('splash_config');
  const d = s.draft;
  return (
    <SettingsCard
      title="Opening animation"
      description="A short intro shown once per visit before the home page."
      state={s}
      prepare={(v) => ({ ...v, tagline: v.tagline.trim() })}
    >
      <Toggle label="Show the opening animation" checked={d.enabled} onChange={(v) => s.setDraft({ ...d, enabled: v })} />
      <TextField label="Line shown in the animation" value={d.tagline} onChange={(v) => s.setDraft({ ...d, tagline: v })} maxLength={140} />
    </SettingsCard>
  );
};

/* ------------------------------------------------------------------ */

export const ContentEditorSection: React.FC = () => {
  const { status, refresh } = useSiteData();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Website text"
        description="Edit the words and pictures on the home page. Each section saves on its own and is live as soon as it says “Saved”."
      />
      {status === 'loading' && <Spinner label="Loading the current website content…" />}
      {status === 'offline' && (
        <ErrorBanner message="The current website content could not be loaded, so editing is paused to avoid overwriting it." onRetry={() => refresh()} />
      )}
      <HeroEditor />
      <StoryEditor />
      <ProcessEditor />
      <TestimonialsEditor />
      <PortfolioEditor />
      <SplashEditor />
    </div>
  );
};
