import React, { useCallback, useEffect, useState } from 'react';
import { SplashScreen } from '@/components/splash/SplashScreen';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/sections/HeroSection';
import { SelectedWork } from '@/components/sections/SelectedWork';
import { LandingShopSection } from '@/components/sections/LandingShopSection';
import { PortfolioIndex } from '@/components/sections/PortfolioIndex';
import { PhotoRing } from '@/components/sections/PhotoRing';
import { StoryPhilosophy } from '@/components/sections/StoryPhilosophy';
import { ProcessTimeline } from '@/components/sections/ProcessTimeline';
import { KindWords } from '@/components/sections/KindWords';
import { BookShoot } from '@/components/sections/BookShoot';
import { Lightbox } from '@/components/ui/Lightbox';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PhotoItem } from '@/types';
import { useSiteData, useVisiblePhotos } from '@/context/SiteDataContext';

const SPLASH_SEEN_KEY = 'hi_studio_splash_seen';

// A section that fails to render is left out instead of taking the whole page down.
const Safe: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary fallback={null}>{children}</ErrorBoundary>
);

const splashSeen = () => {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) === 'true';
  } catch {
    return true;
  }
};

export const HomePage: React.FC = () => {
  const { settings, status } = useSiteData();
  const photos = useVisiblePhotos();
  const [splashDone, setSplashDone] = useState(splashSeen);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Wait for settings before deciding, so a splash the admin switched off never flashes.
  const settingsKnown = status !== 'loading';
  const showSplash = !splashDone && settingsKnown && settings.splash_config.enabled;

  useEffect(() => {
    if (settingsKnown && !settings.splash_config.enabled) setSplashDone(true);
  }, [settingsKnown, settings.splash_config.enabled]);

  const finishSplash = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_SEEN_KEY, 'true');
    } catch {
      /* private mode: the splash simply plays again next visit */
    }
    setSplashDone(true);
  }, []);

  const openPhoto = useCallback(
    (photo: PhotoItem) => {
      const i = photos.findIndex((p) => p.id === photo.id);
      setLightboxIndex(i >= 0 ? i : 0);
    },
    [photos]
  );

  return (
    <div className="relative min-h-screen bg-canvas text-ink-light">
      {/* Cover while settings load on a first visit, matching the splash background */}
      {!splashDone && !settingsKnown && <div className="fixed inset-0 z-[99999] bg-[#D6C098]" aria-hidden />}
      {showSplash && (
        <SplashScreen
          onComplete={finishSplash}
          tagline={settings.splash_config.tagline}
          subtitle={`Photography · ${settings.studio_profile.city}`}
        />
      )}

      <Navigation />

      <main>
        <Safe><HeroSection ready={splashDone} onOpenPhoto={openPhoto} /></Safe>
        <Safe><SelectedWork onOpenPhoto={openPhoto} /></Safe>
        <Safe><LandingShopSection /></Safe>
        <Safe><PortfolioIndex onOpenPhoto={openPhoto} /></Safe>
        <Safe><PhotoRing onOpenPhoto={openPhoto} /></Safe>
        <Safe><StoryPhilosophy /></Safe>
        <Safe><ProcessTimeline /></Safe>
        <Safe><KindWords /></Safe>
        <Safe><BookShoot /></Safe>
      </main>

      <Footer />

      <Lightbox
        photos={photos}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
};
