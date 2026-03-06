import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AuthProvider } from "@/modules/auth/AuthContext";
import { CartProvider } from "@/modules/common/CartContext";
import Layout from "@/components/Layout";
import Index from "./client-pages/Index";
import GalleryPage from "./client-pages/GalleryPage";
import ArtworkDetailPage from "./client-pages/ArtworkDetailPage";
import ArtistsPage from "./client-pages/ArtistsPage";
import ArtistDetailPage from "./client-pages/ArtistDetailPage";
import BlogPage from "./client-pages/BlogPage";
import BlogPostPage from "./client-pages/BlogPostPage";
import AboutPage from "./client-pages/AboutPage";
import ContactPage from "./client-pages/ContactPage";
import TermsPage from "./client-pages/TermsPage";
import PrivacyPage from "./client-pages/PrivacyPage";
import CookiesPage from "./client-pages/CookiesPage";
import NotFound from "./client-pages/NotFound";
import ClientLogin from "./modules/client/Login";
import ClientRegister from "./modules/client/Register";
import Cart from "./modules/client/Cart";
import Checkout from "./modules/client/Checkout";
import Account from "./modules/client/Account";
import Orders from "./modules/client/Orders";
import ClientOrderDetail from "./modules/client/OrderDetail";
import OrderPayment from "./modules/client/OrderPayment";
import ResetPassword from "./modules/client/ResetPassword";
import type { ReactNode } from "react";
import { useEffect } from "react";

const queryClient = new QueryClient();

const ShopLayout = ({ children }: { children: ReactNode }) => (
  <Layout>
    <div className="pt-24 md:pt-32">
      <div className="container mx-auto px-6 py-6">{children}</div>
    </div>
  </Layout>
);

const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search, hash]);

  return null;
};

const App = () => (
  <I18nProvider>
    <AuthProvider>
      <CartProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/gallery/:slug" element={<ArtworkDetailPage />} />
                <Route path="/products" element={<Navigate to="/gallery" replace />} />
                <Route path="/artists" element={<ArtistsPage />} />
                <Route path="/artists/:slug" element={<ArtistDetailPage />} />
                <Route path="/artist/:slug" element={<ArtistDetailPage />} />
                <Route path="/artist/id/:id" element={<ArtistsPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/cookies" element={<CookiesPage />} />
                <Route path="/cookie-settings" element={<CookiesPage />} />

                <Route path="/login" element={<ClientLogin />} />
                <Route path="/register" element={<ClientRegister />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/cart" element={<ShopLayout><Cart /></ShopLayout>} />
                <Route path="/checkout" element={<ShopLayout><Checkout /></ShopLayout>} />
                <Route path="/account" element={<ShopLayout><Account /></ShopLayout>} />
                <Route path="/account/orders" element={<ShopLayout><Orders /></ShopLayout>} />
                <Route path="/account/orders/:id" element={<ShopLayout><ClientOrderDetail /></ShopLayout>} />
                <Route path="/account/orders/:id/payment" element={<ShopLayout><OrderPayment /></ShopLayout>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </CartProvider>
    </AuthProvider>
  </I18nProvider>
);

export default App;
