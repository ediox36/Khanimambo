import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CheckCheck,
  LogOut,
  Save,
  Shield,
  Upload,
  User,
} from 'lucide-react';
import { resolveMediaUrl } from '../assets/media';
import { MOZAMBIQUE_CITIES } from '../data/mozambiqueLocations';
import { useMarketplace } from '../context/MarketplaceContext';
import { compressImageFileToDataUrl } from '../utils/imageUpload';
import {
  formatMozDate,
  formatMozDateTime,
  formatMzn,
  REQUEST_STATUS_LABELS_PT,
} from '../utils/marketplaceLogic';

export const NotificationsView: React.FC = () => {
  const {
    currentUser,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    requestBrowserNotificationPermission,
    setActiveTab,
    openAuthModal,
  } = useMarketplace();

  const [onlyUnread, setOnlyUnread] = useState(false);

  const visibleNotifications = useMemo(
    () => (onlyUnread ? notifications.filter((n) => !n.isRead) : notifications),
    [notifications, onlyUnread]
  );

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h1 className="font-display text-2xl font-bold text-[#141815]">
          Central de Notificações
        </h1>
        <p className="mt-2 text-sm text-[#4A524D]">
          Inicie sessão para receber alertas em tempo real sobre os seus pedidos e avaliações.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="mt-5 rounded-lg bg-[#14533D] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Entrar na Conta
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141815] sm:text-3xl">
            Central de Notificações
          </h1>
          <p className="mt-1 text-sm text-[#4A524D]">
            Actualizações em tempo real de pedidos, confirmações, conclusões e avaliações.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={requestBrowserNotificationPermission}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#141815] hover:bg-zinc-50"
          >
            <Bell className="h-3.5 w-3.5 text-[#14533D]" />
            <span>Alertas no Navegador</span>
          </button>

          {unreadNotificationsCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14533D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Marcar todas como lidas</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
        <button
          type="button"
          onClick={() => setOnlyUnread(false)}
          className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold ${
            !onlyUnread
              ? 'border-[#14533D] bg-[#14533D] text-white'
              : 'border-zinc-200 bg-white text-[#4A524D]'
          }`}
        >
          Todas ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setOnlyUnread(true)}
          className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold ${
            onlyUnread
              ? 'border-[#14533D] bg-[#14533D] text-white'
              : 'border-zinc-200 bg-white text-[#4A524D]'
          }`}
        >
          Não lidas ({unreadNotificationsCount})
        </button>
      </div>

      {visibleNotifications.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-[#6E7771]" />
          <p className="mt-3 font-display text-lg font-bold text-[#141815]">
            Sem notificações por ler
          </p>
          <p className="mt-1 text-sm text-[#4A524D]">
            Todas as suas actualizações de pedidos e conta estão em dia.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex flex-col justify-between gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center ${
                notif.isRead
                  ? 'border-zinc-200 bg-white'
                  : 'border-[#14533D]/40 bg-emerald-50/40'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {!notif.isRead && (
                    <span className="h-2 w-2 rounded-full bg-[#14533D]" aria-label="Não lida" />
                  )}
                  <h2 className="font-display text-sm font-bold text-[#141815]">
                    {notif.title}
                  </h2>
                  <span className="font-mono text-[11px] text-[#6E7771] tabular-nums">
                    {formatMozDateTime(notif.createdAt)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#4A524D]">{notif.body}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {notif.relatedRequestId && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!notif.isRead) await markNotificationRead(notif.id);
                      setActiveTab(
                        currentUser.activeMode === 'provider' ? 'provider_dashboard' : 'requests'
                      );
                    }}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#141815] hover:bg-zinc-50"
                  >
                    Ver Pedido
                  </button>
                )}
                {!notif.isRead && (
                  <button
                    type="button"
                    onClick={() => markNotificationRead(notif.id)}
                    className="text-xs font-semibold text-[#14533D] hover:underline"
                  >
                    Marcar lida
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AccountSettingsView: React.FC = () => {
  const {
    currentUser,
    currentProvider,
    requests,
    updateAccountProfile,
    switchOrConfigureRole,
    deactivateOrDeleteAccount,
    logout,
    openAuthModal,
  } = useMarketplace();

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [businessName, setBusinessName] = useState(currentProvider?.businessName || '');
  const [bio, setBio] = useState(currentProvider?.bio || '');
  const [phone, setPhone] = useState(currentUser?.phone || '+258 84 ');
  const [city, setCity] = useState(currentUser?.city || 'Maputo');
  const [neighborhood, setNeighborhood] = useState(currentUser?.neighborhood || 'Polana Cimento');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [language, setLanguage] = useState<'pt-MZ' | 'en'>(currentUser?.language || 'pt-MZ');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Role activation for Customer -> Provider
  const [newProvBusiness, setNewProvBusiness] = useState('');
  const [newProvBio, setNewProvBio] = useState('');

  // Notification & Privacy prefs
  const [inAppNotif, setInAppNotif] = useState(currentUser?.notificationPrefs.inApp ?? true);
  const [browserPush, setBrowserPush] = useState(
    currentUser?.notificationPrefs.browserPush ?? true
  );
  const [bookingUpdates, setBookingUpdates] = useState(
    currentUser?.notificationPrefs.bookingUpdates ?? true
  );
  const [showNeighborhoodPublicly, setShowNeighborhoodPublicly] = useState(
    currentUser?.privacyPrefs.showNeighborhoodPublicly ?? true
  );
  const [allowDistanceCalc, setAllowDistanceCalc] = useState(
    currentUser?.privacyPrefs.allowDistanceCalculation ?? true
  );

  const [confirmDeactivate, setConfirmDeactivate] = useState<'deactivate' | 'delete' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.fullName);
    setPhone(currentUser.phone);
    setCity(currentUser.city);
    setNeighborhood(currentUser.neighborhood);
    setAddress(currentUser.address);
    setAvatarUrl(currentUser.avatarUrl);
    setLanguage(currentUser.language);
    setInAppNotif(currentUser.notificationPrefs.inApp);
    setBrowserPush(currentUser.notificationPrefs.browserPush);
    setBookingUpdates(currentUser.notificationPrefs.bookingUpdates);
    setShowNeighborhoodPublicly(currentUser.privacyPrefs.showNeighborhoodPublicly);
    setAllowDistanceCalc(currentUser.privacyPrefs.allowDistanceCalculation);
    if (currentProvider) {
      setBusinessName(currentProvider.businessName);
      setBio(currentProvider.bio);
    }
  }, [currentUser, currentProvider]);

  const availableNeighborhoods = useMemo(() => {
    const found = MOZAMBIQUE_CITIES.find((c) => c.name === city) || MOZAMBIQUE_CITIES[0];
    return found.neighborhoods;
  }, [city]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h1 className="font-display text-2xl font-bold text-[#141815]">Definições da Conta</h1>
        <p className="mt-2 text-sm text-[#4A524D]">
          Inicie sessão para gerir os seus dados pessoais, localização e papéis de conta.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="mt-5 rounded-lg bg-[#14533D] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Entrar na Conta
        </button>
      </div>
    );
  }

  const hasProviderRole = Boolean(currentUser.roles.includes('provider') && currentProvider);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 500, 0.8);
      setAvatarUrl(compressed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar imagem.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const payload: Record<string, unknown> = {
        fullName,
        phone,
        city,
        neighborhood,
        address,
        avatarUrl,
        language,
        notificationPrefs: {
          inApp: inAppNotif,
          browserPush,
          bookingUpdates,
          reviewsAndPromos: true,
        },
        privacyPrefs: {
          showNeighborhoodPublicly,
          allowDistanceCalculation: allowDistanceCalc,
        },
      };
      if (hasProviderRole) {
        payload.businessName = businessName;
        payload.bio = bio;
      }
      if (newPassword.trim()) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      await updateAccountProfile(payload);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao actualizar definições.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141815] sm:text-3xl">
            Definições da Conta e Papéis
          </h1>
          <p className="mt-1 text-sm text-[#4A524D]">
            Gerir dados pessoais, alternar entre Modo Cliente e Modo Prestador, notificações e
            privacidade.
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-[#141815] hover:bg-zinc-50"
        >
          <LogOut className="h-4 w-4 text-rose-700" />
          <span>Terminar Sessão</span>
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {errorMsg}
        </div>
      )}

      {/* Flexible Account Type & Role Switching Card */}
      <section
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs"
        data-testid="role-switching-panel"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#141815]">
              Modo da Conta e Alternância de Papel
            </h2>
            <p className="mt-0.5 text-xs text-[#4A524D]">
              Na Kanimambo a sua conta é flexível: pode contratar serviços como Cliente e também
              oferecer serviços como Prestador sem precisar de criar outra conta.
            </p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-[#14533D]">
            Modo actual:{' '}
            {currentUser.activeMode === 'provider' ? 'Prestador de Serviços' : 'Cliente'}
          </span>
        </div>

        {hasProviderRole ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => switchOrConfigureRole({ targetMode: 'customer' })}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  currentUser.activeMode === 'customer'
                    ? 'border-[#14533D] bg-emerald-50/70 ring-1 ring-[#14533D]'
                    : 'border-zinc-200 bg-[#FAF9F6]'
                }`}
              >
                <User className="mt-0.5 h-5 w-5 text-[#14533D]" />
                <div>
                  <span className="block font-display text-sm font-bold text-[#141815]">
                    Modo Cliente
                  </span>
                  <span className="mt-0.5 block text-xs text-[#4A524D]">
                    Pesquisar prestadores, solicitar serviços e gerir reservas.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => switchOrConfigureRole({ targetMode: 'provider' })}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  currentUser.activeMode === 'provider'
                    ? 'border-[#14533D] bg-emerald-50/70 ring-1 ring-[#14533D]'
                    : 'border-zinc-200 bg-[#FAF9F6]'
                }`}
              >
                <Briefcase className="mt-0.5 h-5 w-5 text-[#14533D]" />
                <div>
                  <span className="block font-display text-sm font-bold text-[#141815]">
                    Modo Prestador
                  </span>
                  <span className="mt-0.5 block text-xs text-[#4A524D]">
                    Gerir disponibilidade, serviços, preços e pedidos recebidos.
                  </span>
                </div>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => switchOrConfigureRole({ disableProviderRole: true })}
                className="text-xs font-semibold text-[#6E7771] hover:text-rose-700 hover:underline"
              >
                Desactivar papel de Prestador e manter apenas Cliente
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setErrorMsg(null);
              try {
                await switchOrConfigureRole({
                  enableProviderRole: true,
                  targetMode: 'provider',
                  businessName: newProvBusiness || currentUser.fullName,
                  bio: newProvBio,
                });
              } catch (err) {
                setErrorMsg(
                  err instanceof Error ? err.message : 'Erro ao activar papel de prestador.'
                );
              } finally {
                setBusy(false);
              }
            }}
            className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-[#FAF9F6] p-4"
          >
            <p className="text-xs font-bold text-[#141815]">
              Solicitar / Activar Papel de Prestador de Serviços nesta Conta
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={newProvBusiness}
                onChange={(e) => setNewProvBusiness(e.target.value)}
                placeholder="Nome comercial ou do salão (opcional)"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                minLength={10}
                value={newProvBio}
                onChange={(e) => setNewProvBio(e.target.value)}
                placeholder="Descrição profissional (mínimo 10 caracteres) *"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
            >
              Activar Perfil de Prestador Agora
            </button>
          </form>
        )}
      </section>

      {/* Personal & Business Profile Form */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6"
      >
        <h2 className="font-display text-lg font-bold text-[#141815]">
          Informações Pessoais, Contacto e Localização
        </h2>

        <div className="flex items-center gap-4">
          <img
            src={resolveMediaUrl(avatarUrl, 'hero')}
            alt={currentUser.fullName}
            referrerPolicy="no-referrer"
            className="h-16 w-16 rounded-xl object-cover bg-[#F3F1EC]"
          />
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#141815] hover:bg-zinc-50">
              <Upload className="h-3.5 w-3.5 text-[#14533D]" />
              <span>Alterar Fotografia de Perfil</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
            <p className="mt-1 text-[11px] text-[#6E7771]">{currentUser.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[#141815]">Nome Completo *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#141815]">
              Telefone (+258) *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {hasProviderRole && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#141815]">
                Nome Comercial / Salão
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#141815]">
                Descrição Profissional
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-[#141815]">Cidade *</label>
            <select
              value={city}
              onChange={(e) => {
                const next = e.target.value;
                setCity(next);
                const found = MOZAMBIQUE_CITIES.find((c) => c.name === next);
                if (found?.neighborhoods[0]) setNeighborhood(found.neighborhoods[0].name);
              }}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {MOZAMBIQUE_CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#141815]">Bairro *</label>
            <select
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {availableNeighborhoods.map((nb) => (
                <option key={nb.name} value={nb.name}>
                  {nb.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#141815]">Idioma</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'pt-MZ' | 'en')}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="pt-MZ">Português (Moçambique)</option>
              <option value="en">English (Mozambique)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#141815]">
            Endereço / Avenida
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ex: Av. Eduardo Mondlane, nº 810"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        {/* Password Change */}
        <div className="border-t border-zinc-100 pt-4">
          <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-[#141815]">
            <Shield className="h-4 w-4 text-[#14533D]" />
            <span>Alterar Palavra-passe (opcional)</span>
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Palavra-passe actual"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova palavra-passe (mínimo 6 caracteres)"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Notification & Privacy Preferences */}
        <div className="grid grid-cols-1 gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-display text-sm font-bold text-[#141815]">
              Preferências de Notificação
            </h3>
            <label className="flex items-center gap-2 text-xs text-[#4A524D]">
              <input
                type="checkbox"
                checked={inAppNotif}
                onChange={(e) => setInAppNotif(e.target.checked)}
              />
              <span>Notificações na aplicação em tempo real</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#4A524D]">
              <input
                type="checkbox"
                checked={browserPush}
                onChange={(e) => setBrowserPush(e.target.checked)}
              />
              <span>Alertas push no navegador</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#4A524D]">
              <input
                type="checkbox"
                checked={bookingUpdates}
                onChange={(e) => setBookingUpdates(e.target.checked)}
              />
              <span>Actualizações de estado dos pedidos</span>
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="font-display text-sm font-bold text-[#141815]">
              Privacidade e Localização
            </h3>
            <label className="flex items-center gap-2 text-xs text-[#4A524D]">
              <input
                type="checkbox"
                checked={showNeighborhoodPublicly}
                onChange={(e) => setShowNeighborhoodPublicly(e.target.checked)}
              />
              <span>Mostrar bairro e cidade no perfil</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#4A524D]">
              <input
                type="checkbox"
                checked={allowDistanceCalc}
                onChange={(e) => setAllowDistanceCalc(e.target.checked)}
              />
              <span>Calcular distância automática para taxa de deslocação</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#14533D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0E3D2D]"
          >
            <Save className="h-4 w-4" />
            <span>{busy ? 'A guardar...' : 'Guardar Definições'}</span>
          </button>
        </div>
      </form>

      {/* Request History Table */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <h2 className="font-display text-lg font-bold text-[#141815]">
          Histórico Resumido de Pedidos ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-xs text-[#6E7771]">Sem pedidos registados nesta conta.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[#6E7771]">
                  <th className="py-2 pr-4 font-semibold">Serviço</th>
                  <th className="py-2 pr-4 font-semibold">Data</th>
                  <th className="py-2 pr-4 font-semibold">Total</th>
                  <th className="py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {requests.slice(0, 10).map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-4 font-semibold text-[#141815]">{r.serviceTitle}</td>
                    <td className="py-2.5 pr-4 text-[#4A524D] tabular-nums">
                      {formatMozDate(r.preferredDate)}
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-[#141815] tabular-nums">
                      {r.pricingModel === 'consultation'
                        ? 'Sob consulta'
                        : formatMzn(r.estimatedTotalMzn)}
                    </td>
                    <td className="py-2.5 text-[#4A524D]">{REQUEST_STATUS_LABELS_PT[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Account Deactivation or Deletion */}
      <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-rose-900">
          <AlertTriangle className="h-4 w-4" />
          <span>Desactivar ou Eliminar Conta</span>
        </h2>
        <p className="mt-1 text-xs text-rose-800">
          Pode desactivar temporariamente a sua conta ou eliminar permanentemente os seus dados da
          plataforma.
        </p>

        {confirmDeactivate ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-rose-300 bg-white p-3.5">
            <span className="text-xs font-semibold text-rose-900">
              Confirma que pretende{' '}
              {confirmDeactivate === 'delete'
                ? 'eliminar permanentemente'
                : 'desactivar'}{' '}
              a sua conta?
            </span>
            <button
              type="button"
              onClick={() => deactivateOrDeleteAccount(confirmDeactivate)}
              className="rounded-lg bg-rose-800 px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              Sim, Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeactivate(null)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setConfirmDeactivate('deactivate')}
              className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-50"
            >
              Desactivar Conta
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeactivate('delete')}
              className="rounded-lg bg-rose-800 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-900"
            >
              Eliminar Conta Permanentemente
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
