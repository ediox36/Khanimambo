import React from 'react';
import {
  Bell,
  Briefcase,
  ClipboardList,
  Compass,
  Home,
  LogIn,
  Settings,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useMarketplace, type ActiveTab } from '../context/MarketplaceContext';

export const NavbarAndMobileNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    currentProvider,
    unreadNotificationsCount,
    openAuthModal,
    switchOrConfigureRole,
    googleMapsApiKey,
    gmpQuotaExceeded,
  } = useMarketplace();

  const isAdmin = Boolean(currentUser?.roles.includes('admin'));
  const hasProviderRole = Boolean(currentUser?.roles.includes('provider') && currentProvider);
  const isProviderMode = Boolean(currentUser?.activeMode === 'provider' && hasProviderRole);

  // Desktop Top Bar Zone 2 items: strictly 4-5 single-line links, never wrapping
  const desktopNavItems: Array<{ id: ActiveTab; label: string; badge?: number }> = currentUser
    ? isProviderMode
      ? [
          { id: 'provider_dashboard', label: 'Painel' },
          { id: 'explore', label: 'Explorar' },
          { id: 'requests', label: 'Pedidos' },
          { id: 'notifications', label: 'Alertas', badge: unreadNotificationsCount },
          ...(isAdmin
            ? [{ id: 'admin' as ActiveTab, label: 'Admin' }]
            : [{ id: 'settings' as ActiveTab, label: 'Conta' }]),
        ]
      : [
          { id: 'home', label: 'Início' },
          { id: 'explore', label: 'Explorar' },
          { id: 'requests', label: 'Pedidos' },
          { id: 'notifications', label: 'Alertas', badge: unreadNotificationsCount },
          ...(isAdmin
            ? [{ id: 'admin' as ActiveTab, label: 'Admin' }]
            : [{ id: 'settings' as ActiveTab, label: 'Conta' }]),
        ]
    : [
        { id: 'home', label: 'Início' },
        { id: 'explore', label: 'Explorar' },
      ];

  const handlePrimaryCta = () => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    if (isAdmin && activeTab !== 'settings') {
      setActiveTab('settings');
      return;
    }
    if (hasProviderRole) {
      switchOrConfigureRole({ targetMode: isProviderMode ? 'customer' : 'provider' });
      return;
    }
    setActiveTab('explore');
  };

  const primaryCtaLabel = !currentUser
    ? 'Entrar'
    : isAdmin && activeTab !== 'settings'
    ? 'Conta'
    : hasProviderRole
    ? isProviderMode
      ? 'Modo Cliente'
      : 'Modo Prestador'
    : 'Solicitar Serviço';

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-zinc-200/90 bg-[#FAF9F6]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab(isProviderMode ? 'provider_dashboard' : 'home')}
            className="font-display text-xl font-bold tracking-tight text-[#141815] whitespace-nowrap shrink-0 focus:outline-none"
          >
            Kanimambo
          </button>

          {/* Zone 2: Single-line Primary Navigation */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-6 overflow-x-auto"
          >
            {desktopNavItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex items-center gap-1.5 py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'text-[#14533D] font-semibold'
                      : 'text-[#4A524D] hover:text-[#141815]'
                  }`}
                >
                  <span>{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-[#14533D] px-1.5 font-mono text-[11px] font-semibold text-white tabular-nums">
                      {item.badge}
                    </span>
                  )}
                  {active && (
                    <span className="absolute -bottom-[19px] left-0 right-0 h-0.5 bg-[#14533D]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="inline-flex items-center gap-2 rounded-lg bg-[#14533D] px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-[#0E3D2D] focus:outline-none focus:ring-2 focus:ring-[#14533D]/30"
            >
              {!currentUser && <LogIn className="h-4 w-4" />}
              <span>{primaryCtaLabel}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Workspace Context Strip for Logged-in Users (outside <header>) */}
      {currentUser && (
        <div className="border-b border-zinc-200/70 bg-[#F3F1EC]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-[#4A524D] sm:px-6">
            <div className="flex items-center gap-2">
              <UserCheck className="h-3.5 w-3.5 text-[#14533D]" />
              <span>
                Sessão activa: <strong className="text-[#141815]">{currentUser.fullName}</strong> (
                {currentUser.neighborhood}, {currentUser.city})
              </span>
            </div>
            <div className="flex items-center gap-3">
              {hasProviderRole && (
                <button
                  type="button"
                  onClick={() =>
                    switchOrConfigureRole({
                      targetMode: isProviderMode ? 'customer' : 'provider',
                    })
                  }
                  className="font-semibold text-[#14533D] underline-offset-2 hover:underline"
                >
                  {isProviderMode
                    ? 'Alternar para Modo Cliente'
                    : 'Alternar para Modo Prestador'}
                </button>
              )}
              {!hasProviderRole && (
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="font-semibold text-[#14533D] underline-offset-2 hover:underline"
                >
                  Tornar-se Prestador
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="text-[#4A524D] hover:text-[#141815]"
              >
                Definições da Conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navegação móvel"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-zinc-200 bg-white/95 backdrop-blur-sm"
      >
        <div className="grid h-full grid-cols-5 items-center px-1">
          <button
            type="button"
            onClick={() => setActiveTab(isProviderMode ? 'provider_dashboard' : 'home')}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activeTab === 'home' || activeTab === 'provider_dashboard'
                ? 'text-[#14533D] font-semibold'
                : 'text-[#4A524D]'
            }`}
          >
            {isProviderMode ? <Briefcase className="h-5 w-5" /> : <Home className="h-5 w-5" />}
            <span>{isProviderMode ? 'Painel' : 'Início'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('explore')}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activeTab === 'explore' ? 'text-[#14533D] font-semibold' : 'text-[#4A524D]'
            }`}
          >
            <Compass className="h-5 w-5" />
            <span>Explorar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) openAuthModal('login');
              else setActiveTab('requests');
            }}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activeTab === 'requests' ? 'text-[#14533D] font-semibold' : 'text-[#4A524D]'
            }`}
          >
            <ClipboardList className="h-5 w-5" />
            <span>Pedidos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) openAuthModal('login');
              else setActiveTab('notifications');
            }}
            className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activeTab === 'notifications' ? 'text-[#14533D] font-semibold' : 'text-[#4A524D]'
            }`}
          >
            <Bell className="h-5 w-5" />
            <span>Alertas</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-[#14533D]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) openAuthModal('login');
              else if (isAdmin) setActiveTab('admin');
              else setActiveTab('settings');
            }}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activeTab === 'settings' || activeTab === 'admin'
                ? 'text-[#14533D] font-semibold'
                : 'text-[#4A524D]'
            }`}
          >
            {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
            <span>{!currentUser ? 'Entrar' : isAdmin ? 'Admin' : 'Conta'}</span>
          </button>
        </div>
      </nav>

      {/* Google Maps attribution notice helper when active */}
      {Boolean(googleMapsApiKey) && !gmpQuotaExceeded && (
        <div className="sr-only">
          Integração de mapas sujeita aos Termos de Utilização do Google Maps Platform.
        </div>
      )}
    </>
  );
};
