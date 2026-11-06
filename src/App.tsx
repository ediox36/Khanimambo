import React from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext';
import { NavbarAndMobileNav } from './components/NavbarAndMobileNav';
import { MarketplaceHomeAndExplore } from './components/MarketplaceHomeAndExplore';
import { AuthModal } from './components/AuthModal';
import { ProviderPublicProfileModal } from './components/ProviderPublicProfileModal';
import { ServiceRequestModal } from './components/ServiceRequestModal';
import { CustomerRequestsView } from './components/CustomerRequestsView';
import { ProviderDashboardView } from './components/ProviderDashboardView';
import {
  AccountSettingsView,
  NotificationsView,
} from './components/NotificationsAndSettingsViews';
import { AdminDashboardView } from './components/AdminDashboardView';

const MarketplaceShell: React.FC = () => {
  const {
    activeTab,
    isLoading,
    toastBanner,
    googleMapsApiKey,
    gmpQuotaExceeded,
    settings,
  } = useMarketplace();

  const mainContent = (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] text-[#141815]">
      {/* Sticky Google Maps Demo Key Quota Exceeded Banner */}
      {gmpQuotaExceeded && (
        <div
          role="status"
          className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-xs font-medium text-amber-950"
        >
          <span>
            O limite gratuito da chave de demonstração do Google Maps foi atingido; o mapa
            interactivo local de Moçambique está activo.{' '}
          </span>
          <a
            href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline hover:text-amber-800"
          >
            Saiba como configurar a sua própria chave de API
          </a>
        </div>
      )}

      <NavbarAndMobileNav />

      {/* Transient Notification / Action Feedback Banner */}
      {toastBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6`}
        >
          <div
            className={`rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-2xs ${
              toastBanner.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : toastBanner.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-zinc-200 bg-white text-[#141815]'
            }`}
          >
            {toastBanner.message}
          </div>
        </div>
      )}

      <main className="flex-1 pb-20 md:pb-12">
        {isLoading ? (
          <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-[#4A524D]">
            A carregar serviços e prestadores em Moçambique...
          </div>
        ) : (
          <>
            {(activeTab === 'home' || activeTab === 'explore') && (
              <MarketplaceHomeAndExplore />
            )}
            {activeTab === 'requests' && <CustomerRequestsView />}
            {activeTab === 'provider_dashboard' && <ProviderDashboardView />}
            {activeTab === 'notifications' && <NotificationsView />}
            {activeTab === 'settings' && <AccountSettingsView />}
            {activeTab === 'admin' && <AdminDashboardView />}
          </>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white py-6 text-xs text-[#6E7771] mb-16 md:mb-0">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 sm:flex-row sm:items-center sm:px-6">
          <div>
            <span className="font-display font-bold text-[#141815]">
              {settings.platformName}
            </span>{' '}
            · Mercado de Serviços em Moçambique ({settings.defaultCurrency} ·{' '}
            {settings.defaultCountryCode})
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>Suporte: {settings.supportEmail}</span>
            <a
              href="https://maps.google.com/help/terms_maps/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Termos do Google Maps
            </a>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Política de Privacidade
            </a>
          </div>
        </div>
      </footer>

      <AuthModal />
      <ProviderPublicProfileModal />
      <ServiceRequestModal />
    </div>
  );

  if (googleMapsApiKey && !gmpQuotaExceeded) {
    return (
      <APIProvider apiKey={googleMapsApiKey} libraries={['marker', 'routes']}>
        {mainContent}
      </APIProvider>
    );
  }

  return mainContent;
};

export default function App() {
  return (
    <MarketplaceProvider>
      <MarketplaceShell />
    </MarketplaceProvider>
  );
}
