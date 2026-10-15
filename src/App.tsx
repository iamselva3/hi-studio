import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { SiteDataProvider } from '@/context/SiteDataContext';
import { CartProvider, useCart } from '@/context/CartContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Everything except the home page is downloaded only when it's first needed.
const AdminApp = lazy(() => import('@/admin/AdminApp'));
const ShopPage = lazy(() => import('@/pages/ShopPage'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'));
const CustomFramePage = lazy(() => import('@/pages/CustomFramePage'));
const PolicyPage = lazy(() => import('@/pages/PolicyPage').then((m) => ({ default: m.PolicyPage })));
const CartDrawer = lazy(() => import('@/shop/CartDrawer').then((m) => ({ default: m.CartDrawer })));
const CheckoutModal = lazy(() => import('@/shop/CheckoutModal').then((m) => ({ default: m.CheckoutModal })));

const PageFallback = () => <div className="min-h-screen bg-canvas" />;

/** Scroll to `#section` links (also when arriving from another page), otherwise to the top on navigation. */
const ScrollManager: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    // Sections can render after data arrives, so retry briefly.
    const timer = window.setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++tries > 40) {
        window.clearInterval(timer);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [pathname, hash]);

  return null;
};

/** Bag and checkout load the first time they're opened, then stay mounted for their animations. */
const PublicChrome: React.FC = () => {
  const { pathname } = useLocation();
  const { isCartOpen, isCheckoutOpen } = useCart();
  const [cartUsed, setCartUsed] = useState(isCartOpen);
  const [checkoutUsed, setCheckoutUsed] = useState(isCheckoutOpen);
  useEffect(() => {
    if (isCartOpen) setCartUsed(true);
  }, [isCartOpen]);
  useEffect(() => {
    if (isCheckoutOpen) setCheckoutUsed(true);
  }, [isCheckoutOpen]);

  if (pathname.startsWith('/admin')) return null;
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        {cartUsed && <CartDrawer />}
        {checkoutUsed && <CheckoutModal />}
      </Suspense>
    </ErrorBoundary>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <SiteDataProvider>
      <CartProvider>
        <BrowserRouter>
          <ScrollManager />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/shop/custom-frame" element={<CustomFramePage />} />
              <Route path="/shop/:slug" element={<ProductDetailPage />} />
              <Route path="/policies/:type" element={<PolicyPage />} />
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="/custom-frame" element={<Navigate to="/shop/custom-frame" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <PublicChrome />
        </BrowserRouter>
      </CartProvider>
    </SiteDataProvider>
  </ErrorBoundary>
);

export default App;
