import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Flag,
  Image as ImageIcon,
  PauseCircle,
  Plus,
  Power,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { APP_MEDIA, PRESET_GALLERY_CHOICES, resolveMediaUrl } from '../assets/media';
import { useMarketplace } from '../context/MarketplaceContext';
import { compressImageFileToDataUrl } from '../utils/imageUpload';
import {
  formatMozDate,
  formatMzn,
  LOCATION_MODE_LABELS_PT,
  PRICING_MODEL_LABELS_PT,
  REQUEST_STATUS_LABELS_PT,
} from '../utils/marketplaceLogic';
import type {
  AvailabilityStatus,
  PricingModel,
  ProviderService,
  ServiceLocationMode,
} from '../types/marketplace';

export const ProviderDashboardView: React.FC = () => {
  const {
    currentUser,
    currentProvider,
    categories,
    services,
    portfolios,
    reviews,
    requests,
    updateAvailability,
    createService,
    updateService,
    deleteService,
    addPortfolioItem,
    deletePortfolioItem,
    updateRequestStatus,
    switchOrConfigureRole,
    submitReport,
  } = useMarketplace();

  const [subTab, setSubTab] = useState<'requests' | 'services' | 'portfolio' | 'reviews'>(
    'requests'
  );
  const [pauseReasonInput, setPauseReasonInput] = useState(
    currentProvider?.pauseReason || 'Em atendimento externo no momento'
  );

  // Onboarding form if user doesn't have provider profile yet
  const [onboardBusinessName, setOnboardBusinessName] = useState('');
  const [onboardBio, setOnboardBio] = useState('');
  const [onboardError, setOnboardError] = useState<string | null>(null);

  // Service Form State (Create / Edit)
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [svcTitle, setSvcTitle] = useState('');
  const [svcCategoryId, setSvcCategoryId] = useState(categories[0]?.id || 'cat-hair-barber');
  const [svcDescription, setSvcDescription] = useState('');
  const [svcDuration, setSvcDuration] = useState('60');
  const [svcPricingModel, setSvcPricingModel] = useState<PricingModel>('fixed');
  const [svcBasePrice, setSvcBasePrice] = useState('1500');
  const [svcTransportFee, setSvcTransportFee] = useState('250');
  const [svcFreeRadius, setSvcFreeRadius] = useState('3');
  const [svcExtraKmRate, setSvcExtraKmRate] = useState('50');
  const [svcLocationMode, setSvcLocationMode] = useState<ServiceLocationMode>('both');
  const [svcImageUrl, setSvcImageUrl] = useState(APP_MEDIA.hair);
  const [svcFormError, setSvcFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Portfolio Form
  const [portTitle, setPortTitle] = useState('');
  const [portCategory, setPortCategory] = useState('Cabeleireiro e Barbearia');
  const [portImage, setPortImage] = useState(APP_MEDIA.hair);

  const myServices = useMemo(
    () => services.filter((s) => s.providerId === currentProvider?.providerId),
    [services, currentProvider?.providerId]
  );

  const myPortfolio = useMemo(
    () => portfolios.filter((p) => p.providerId === currentProvider?.providerId),
    [portfolios, currentProvider?.providerId]
  );

  const myReviews = useMemo(
    () =>
      reviews
        .filter((r) => r.providerId === currentProvider?.providerId && !r.isModeratedHidden)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reviews, currentProvider?.providerId]
  );

  const incomingRequests = useMemo(
    () => requests.filter((r) => r.providerId === currentProvider?.providerId),
    [requests, currentProvider?.providerId]
  );

  if (!currentUser) return null;

  if (!currentProvider || !currentUser.roles.includes('provider')) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <Briefcase className="h-8 w-8 text-[#14533D]" />
          <h1 className="mt-3 font-display text-2xl font-bold text-[#141815]">
            Activar Conta de Prestador de Serviços
          </h1>
          <p className="mt-1 text-sm text-[#4A524D]">
            Comece a divulgar os seus serviços e a receber pedidos de clientes na mesma conta.
          </p>

          {onboardError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {onboardError}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setOnboardError(null);
              try {
                await switchOrConfigureRole({
                  enableProviderRole: true,
                  targetMode: 'provider',
                  businessName: onboardBusinessName || currentUser.fullName,
                  bio: onboardBio,
                });
              } catch (err) {
                setOnboardError(
                  err instanceof Error ? err.message : 'Erro ao activar perfil de prestador.'
                );
              } finally {
                setBusy(false);
              }
            }}
            className="mt-5 space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-[#141815]">
                Nome Profissional / Salão / Empresa
              </label>
              <input
                type="text"
                value={onboardBusinessName}
                onChange={(e) => setOnboardBusinessName(e.target.value)}
                placeholder={currentUser.fullName}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#141815]">
                Descrição Profissional (mínimo 10 caracteres) *
              </label>
              <textarea
                rows={3}
                required
                value={onboardBio}
                onChange={(e) => setOnboardBio(e.target.value)}
                placeholder="Descreva a sua área de especialidade, anos de experiência e bairros onde atende..."
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[#14533D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0E3D2D]"
            >
              {busy ? 'A activar...' : 'Activar Painel de Prestador'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setSvcTitle('');
    setSvcCategoryId(categories[0]?.id || 'cat-hair-barber');
    setSvcDescription('');
    setSvcDuration('60');
    setSvcPricingModel('fixed');
    setSvcBasePrice('1500');
    setSvcTransportFee('250');
    setSvcFreeRadius('3');
    setSvcExtraKmRate('50');
    setSvcLocationMode('both');
    setSvcImageUrl(APP_MEDIA.hair);
    setSvcFormError(null);
  };

  const openEditService = (svc: ProviderService) => {
    setEditingServiceId(svc.id);
    setSvcTitle(svc.title);
    setSvcCategoryId(svc.categoryId);
    setSvcDescription(svc.description);
    setSvcDuration(String(svc.durationMinutes));
    setSvcPricingModel(svc.pricingModel);
    setSvcBasePrice(String(svc.basePriceMzn));
    setSvcTransportFee(String(svc.transportFeeMzn));
    setSvcFreeRadius(String(svc.freeTransportRadiusKm));
    setSvcExtraKmRate(String(svc.extraKmRateMzn));
    setSvcLocationMode(svc.serviceLocationMode);
    setSvcImageUrl(svc.imageUrl);
    setSvcFormError(null);
    setShowServiceForm(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSvcFormError(null);
    try {
      const payload = {
        title: svcTitle.trim(),
        categoryId: svcCategoryId,
        description: svcDescription.trim(),
        durationMinutes: Number(svcDuration) || 60,
        pricingModel: svcPricingModel,
        basePriceMzn: svcPricingModel === 'consultation' ? 0 : Number(svcBasePrice) || 0,
        transportFeeMzn: Number(svcTransportFee) || 0,
        freeTransportRadiusKm: Number(svcFreeRadius) || 0,
        extraKmRateMzn: Number(svcExtraKmRate) || 0,
        serviceLocationMode: svcLocationMode,
        imageUrl: svcImageUrl,
      };
      if (editingServiceId) {
        await updateService(editingServiceId, payload);
      } else {
        await createService(payload);
      }
      setShowServiceForm(false);
      resetServiceForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSvcFormError(err instanceof Error ? err.message : 'Erro ao guardar serviço.');
    } finally {
      setBusy(false);
    }
  };

  const handleServiceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 840, 0.8);
      setSvcImageUrl(compressed);
    } catch (err) {
      setSvcFormError(err instanceof Error ? err.message : 'Erro ao carregar imagem.');
    }
  };

  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFileToDataUrl(file, 840, 0.8);
    setPortImage(compressed);
  };

  const pendingCount = incomingRequests.filter((r) => r.status === 'pending').length;
  const activeServicesCount = myServices.filter((s) => s.isActive).length;
  const currentAvail = currentProvider.availabilityStatus;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header & Prominent Availability Toggle Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 border-b border-zinc-100 pb-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3.5">
            <img
              src={resolveMediaUrl(currentProvider.avatarUrl, 'hair')}
              alt={currentProvider.businessName}
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-xl object-cover bg-[#F3F1EC]"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-[#141815]">
                  {currentProvider.businessName}
                </h1>
                {currentProvider.isVerified && (
                  <CheckCircle2
                    className="h-5 w-5 text-[#14533D]"
                    aria-label="Prestador Verificado"
                  />
                )}
              </div>
              <p className="text-xs text-[#6E7771]">
                {currentProvider.neighborhood}, {currentProvider.city} · Painel de Gestão do
                Prestador
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              resetServiceForm();
              setShowServiceForm(true);
              setSubTab('services');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#14533D] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
          >
            <Plus className="h-4 w-4" />
            <span>Registar Novo Serviço</span>
          </button>
        </div>

        {/* Prominent Availability ON / OFF / Paused Toggle */}
        <div className="mt-5" data-testid="provider-availability-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[#141815]">
                Estado de Disponibilidade em Tempo Real
              </h2>
              <p className="text-xs text-[#4A524D]">
                Quando activo (ON), os seus serviços aparecem nas pesquisas e pode receber novos
                pedidos. Quando desactivado (OFF) ou pausado, os seus dados mantêm-se guardados sem
                receber novos pedidos.
              </p>
            </div>

            <span
              className={`rounded-md border px-3 py-1 text-xs font-bold ${
                currentAvail === 'available'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : currentAvail === 'paused'
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-rose-300 bg-rose-50 text-rose-900'
              }`}
            >
              Estado actual:{' '}
              {currentAvail === 'available'
                ? 'Disponível (ON)'
                : currentAvail === 'paused'
                ? 'Pausado temporariamente'
                : 'Indisponível (OFF)'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                {
                  status: 'available' as AvailabilityStatus,
                  title: 'Disponível (ON)',
                  desc: 'Visível nas pesquisas e aberto a novos pedidos.',
                  icon: Power,
                },
                {
                  status: 'paused' as AvailabilityStatus,
                  title: 'Pausado temporariamente',
                  desc: 'Pausa breve sem perder os seus dados.',
                  icon: PauseCircle,
                },
                {
                  status: 'unavailable' as AvailabilityStatus,
                  title: 'Indisponível (OFF)',
                  desc: 'Oculto das pesquisas de disponibilidade.',
                  icon: EyeOff,
                },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const selected = currentAvail === opt.status;
              return (
                <button
                  key={opt.status}
                  type="button"
                  onClick={() =>
                    updateAvailability(
                      opt.status,
                      opt.status === 'paused' ? pauseReasonInput : undefined
                    )
                  }
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                    selected
                      ? opt.status === 'available'
                        ? 'border-[#14533D] bg-emerald-50/80 ring-1 ring-[#14533D]'
                        : opt.status === 'paused'
                        ? 'border-amber-600 bg-amber-50/80 ring-1 ring-amber-600'
                        : 'border-rose-700 bg-rose-50/80 ring-1 ring-rose-700'
                      : 'border-zinc-200 bg-[#FAF9F6] hover:border-zinc-300'
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      opt.status === 'available'
                        ? 'text-[#14533D]'
                        : opt.status === 'paused'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  />
                  <div>
                    <span className="block font-display text-sm font-bold text-[#141815]">
                      {opt.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#4A524D]">{opt.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {currentAvail === 'paused' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={pauseReasonInput}
                onChange={(e) => setPauseReasonInput(e.target.value)}
                placeholder="Motivo da pausa (ex: Regresso às 15h00)"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => updateAvailability('paused', pauseReasonInput)}
                className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Actualizar Motivo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <span className="text-xs font-medium text-[#6E7771]">Pedidos Pendentes</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#141815] tabular-nums">
            {pendingCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <span className="text-xs font-medium text-[#6E7771]">Serviços Activos</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#141815] tabular-nums">
            {activeServicesCount} / {myServices.length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <span className="text-xs font-medium text-[#6E7771]">Serviços Concluídos</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#141815] tabular-nums">
            {currentProvider.completedCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <span className="text-xs font-medium text-[#6E7771]">Avaliação Média</span>
          <p className="mt-1 flex items-center gap-1.5 font-display text-2xl font-bold text-[#141815] tabular-nums">
            <Star className="h-5 w-5 fill-[#B45309] text-[#B45309]" />
            {currentProvider.reviewCount > 0
              ? currentProvider.averageRating.toFixed(1)
              : '—'}
            <span className="text-xs font-normal text-[#6E7771]">
              ({currentProvider.reviewCount})
            </span>
          </p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 pb-3">
        {[
          { id: 'requests', label: `Pedidos Recebidos (${incomingRequests.length})` },
          { id: 'services', label: `Os Meus Serviços (${myServices.length})` },
          { id: 'portfolio', label: `Portfólio (${myPortfolio.length})` },
          { id: 'reviews', label: `Avaliações Recebidas (${myReviews.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as typeof subTab)}
            className={`rounded-lg border px-4 py-2 text-xs font-semibold whitespace-nowrap ${
              subTab === tab.id
                ? 'border-[#14533D] bg-[#14533D] text-white'
                : 'border-zinc-200 bg-white text-[#4A524D] hover:text-[#141815]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: INCOMING SERVICE REQUESTS */}
      {subTab === 'requests' && (
        <div className="space-y-4">
          {incomingRequests.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
              <p className="font-display text-lg font-bold text-[#141815]">
                Ainda não recebeu pedidos de serviço
              </p>
              <p className="mt-1 text-sm text-[#4A524D]">
                Mantenha a sua disponibilidade activa (ON) e publique os seus serviços com preços
                claros em Meticais.
              </p>
            </div>
          ) : (
            incomingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs"
              >
                <div className="flex flex-col justify-between gap-4 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start">
                  <div>
                    <span className="inline-block rounded-md border border-zinc-200 bg-[#FAF9F6] px-2.5 py-0.5 text-xs font-semibold text-[#141815]">
                      {REQUEST_STATUS_LABELS_PT[req.status]}
                    </span>
                    <h3 className="mt-2 font-display text-lg font-bold text-[#141815]">
                      {req.serviceTitle}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#4A524D]">
                      Cliente: <strong>{req.customerName}</strong> · {req.customerPhone}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <span className="block text-[11px] text-[#6E7771]">Total Estimado</span>
                    <span className="font-display text-lg font-bold text-[#14533D] tabular-nums">
                      {req.pricingModel === 'consultation'
                        ? `Sob consulta + ${formatMzn(req.transportFeeMzn)}`
                        : formatMzn(req.estimatedTotalMzn)}
                    </span>
                    <span className="block text-[11px] text-[#6E7771] tabular-nums">
                      Serviço: {formatMzn(req.servicePriceMzn)} · Desloc.:{' '}
                      {formatMzn(req.transportFeeMzn)} ({req.distanceKm.toFixed(1)} km)
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[#4A524D] sm:grid-cols-2">
                  <p className="tabular-nums">
                    <strong>Data/Hora:</strong> {formatMozDate(req.preferredDate)} às{' '}
                    {req.preferredTime}
                  </p>
                  <p>
                    <strong>Local:</strong>{' '}
                    {req.locationMode === 'provider_location'
                      ? 'No seu estúdio / local'
                      : `Ao domicílio: ${req.customerNeighborhood}, ${req.customerCity}${
                          req.customerAddress ? ` (${req.customerAddress})` : ''
                        }`}
                  </p>
                </div>

                {req.specialInstructions && (
                  <p className="mt-2.5 rounded-lg bg-[#FAF9F6] px-3 py-2 text-xs text-[#4A524D]">
                    <strong>Instruções do cliente:</strong> {req.specialInstructions}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                  {req.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          updateRequestStatus(req.id, 'accepted', 'Pedido aceite pelo prestador.')
                        }
                        className="rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
                      >
                        Aceitar Pedido
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateRequestStatus(
                            req.id,
                            'rejected',
                            'Indisponível para o horário solicitado.'
                          )
                        }
                        className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Rejeitar
                      </button>
                    </>
                  )}

                  {req.status === 'accepted' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          updateRequestStatus(
                            req.id,
                            'confirmed',
                            'Agendamento confirmado pelo prestador.'
                          )
                        }
                        className="rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white"
                      >
                        Confirmar Agendamento
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateRequestStatus(req.id, 'in_progress', 'Atendimento iniciado.')
                        }
                        className="rounded-lg border border-[#14533D] bg-white px-3.5 py-2 text-xs font-semibold text-[#14533D]"
                      >
                        Iniciar Serviço
                      </button>
                    </>
                  )}

                  {req.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateRequestStatus(req.id, 'in_progress', 'Serviço em execução.')
                      }
                      className="rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white"
                    >
                      Iniciar Serviço
                    </button>
                  )}

                  {(req.status === 'in_progress' || req.status === 'confirmed') && (
                    <button
                      type="button"
                      onClick={() =>
                        updateRequestStatus(
                          req.id,
                          'completed',
                          'Serviço concluído com sucesso.'
                        )
                      }
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      Concluir Serviço
                    </button>
                  )}

                  {['accepted', 'confirmed', 'in_progress'].includes(req.status) && (
                    <button
                      type="button"
                      onClick={() =>
                        updateRequestStatus(
                          req.id,
                          'cancelled',
                          'Cancelado pelo prestador.'
                        )
                      }
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-rose-700"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SUBTAB 2: SERVICE MANAGEMENT */}
      {subTab === 'services' && (
        <div className="space-y-6">
          {showServiceForm && (
            <form
              onSubmit={handleSaveService}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h2 className="font-display text-lg font-bold text-[#141815]">
                  {editingServiceId ? 'Editar Serviço' : 'Registar Novo Serviço'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowServiceForm(false);
                    resetServiceForm();
                  }}
                  className="text-xs font-semibold text-[#6E7771] hover:text-[#141815]"
                >
                  Fechar
                </button>
              </div>

              {svcFormError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {svcFormError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#141815]">
                    Nome do Serviço *
                  </label>
                  <input
                    type="text"
                    required
                    value={svcTitle}
                    onChange={(e) => setSvcTitle(e.target.value)}
                    placeholder="Ex: Tranças Box Braids Médias"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#141815]">Categoria *</label>
                  <select
                    value={svcCategoryId}
                    onChange={(e) => setSvcCategoryId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.namePt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#141815]">
                  Descrição Detalhada *
                </label>
                <textarea
                  rows={3}
                  required
                  value={svcDescription}
                  onChange={(e) => setSvcDescription(e.target.value)}
                  placeholder="Explique o que inclui o serviço, materiais utilizados e preparação necessária..."
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#141815]">
                    Modelo de Preço *
                  </label>
                  <select
                    value={svcPricingModel}
                    onChange={(e) => setSvcPricingModel(e.target.value as PricingModel)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="fixed">Preço fixo</option>
                    <option value="starting_from">A partir de</option>
                    <option value="consultation">Sob consulta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#141815]">
                    Preço do Serviço (MT) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={svcPricingModel === 'consultation'}
                    value={svcBasePrice}
                    onChange={(e) => setSvcBasePrice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums disabled:bg-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#141815]">
                    Duração Estimada (minutos) *
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={1440}
                    value={svcDuration}
                    onChange={(e) => setSvcDuration(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              {/* Dynamic Transportation & Location Rules */}
              <div className="rounded-xl border border-zinc-200 bg-[#FAF9F6] p-4 space-y-3">
                <p className="text-xs font-bold text-[#141815]">
                  Configuração de Localização e Taxa de Deslocação
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#141815]">
                      Onde o serviço é prestado
                    </label>
                    <select
                      value={svcLocationMode}
                      onChange={(e) =>
                        setSvcLocationMode(e.target.value as ServiceLocationMode)
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="both">No meu local ou domicílio</option>
                      <option value="provider_location">Apenas no meu local</option>
                      <option value="customer_location">Apenas ao domicílio</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#141815]">
                      Taxa Base Deslocação (MT)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={svcTransportFee}
                      onChange={(e) => setSvcTransportFee(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#141815]">
                      Raio Deslocação Grátis (km)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={svcFreeRadius}
                      onChange={(e) => setSvcFreeRadius(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#141815]">
                      Adicional por km Extra (MT)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={svcExtraKmRate}
                      onChange={(e) => setSvcExtraKmRate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Service Image Upload or Gallery Preset */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#141815]">
                    Imagem Representativa do Serviço
                  </label>
                  <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-[#4A524D] hover:border-[#14533D]">
                    <Upload className="h-4 w-4 text-[#14533D]" />
                    <span>Carregar fotografia do dispositivo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleServiceImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#141815]">
                    Ou escolher imagem da galeria
                  </label>
                  <select
                    value={svcImageUrl}
                    onChange={(e) => setSvcImageUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
                  >
                    {PRESET_GALLERY_CHOICES.map((g) => (
                      <option key={g.label} value={g.url}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowServiceForm(false);
                    resetServiceForm();
                  }}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-[#141815]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#14533D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
                >
                  {busy
                    ? 'A guardar...'
                    : editingServiceId
                    ? 'Guardar Alterações'
                    : 'Publicar Serviço'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {myServices.map((svc) => (
              <div
                key={svc.id}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start gap-3.5">
                  <img
                    src={resolveMediaUrl(svc.imageUrl, 'hair')}
                    alt={svc.title}
                    referrerPolicy="no-referrer"
                    className="h-20 w-24 shrink-0 rounded-xl object-cover bg-[#F3F1EC]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          svc.isActive ? 'text-[#14533D]' : 'text-[#6E7771]'
                        }`}
                      >
                        {svc.isActive ? 'Serviço Activo' : 'Desactivado temporariamente'}
                      </span>
                      <span className="font-display text-sm font-bold text-[#141815] tabular-nums">
                        {svc.pricingModel === 'consultation'
                          ? 'Sob consulta'
                          : formatMzn(svc.basePriceMzn)}
                      </span>
                    </div>

                    <h3 className="mt-1 font-display text-base font-bold text-[#141815]">
                      {svc.title}
                    </h3>
                    <p className="text-xs text-[#6E7771]">
                      {svc.categoryName} · {PRICING_MODEL_LABELS_PT[svc.pricingModel]} ·{' '}
                      {svc.durationMinutes} min
                    </p>
                    <p className="mt-1 text-xs text-[#4A524D] line-clamp-2">
                      {svc.description}
                    </p>
                    <p className="mt-1 text-[11px] text-[#6E7771] tabular-nums">
                      {LOCATION_MODE_LABELS_PT[svc.serviceLocationMode]} · Deslocação{' '}
                      {formatMzn(svc.transportFeeMzn)} (grátis até {svc.freeTransportRadiusKm} km, +
                      {formatMzn(svc.extraKmRateMzn)}/km)
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openEditService(svc)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-[#141815] hover:bg-zinc-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateService(svc.id, { isActive: !svc.isActive })}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-[#141815] hover:bg-zinc-50"
                  >
                    {svc.isActive ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        <span>Desactivar</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        <span>Reactivar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteService(svc.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: PORTFOLIO GALLERY */}
      {subTab === 'portfolio' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!portTitle.trim()) return;
              await addPortfolioItem({
                title: portTitle.trim(),
                categoryName: portCategory,
                imageUrl: portImage,
              });
              setPortTitle('');
            }}
            className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4"
          >
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#141815]">
              <ImageIcon className="h-4 w-4 text-[#14533D]" />
              <span>Adicionar Trabalho ao Portfólio</span>
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                required
                value={portTitle}
                onChange={(e) => setPortTitle(e.target.value)}
                placeholder="Título do trabalho realizado"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs"
              />
              <select
                value={portCategory}
                onChange={(e) => setPortCategory(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.namePt}>
                    {c.namePt}
                  </option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-[#4A524D] hover:border-[#14533D]">
                <Upload className="h-4 w-4 text-[#14533D]" />
                <span>Carregar Fotografia</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePortfolioUpload}
                  className="hidden"
                />
              </label>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white"
            >
              Adicionar ao Portfólio
            </button>
          </form>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {myPortfolio.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#F3F1EC]">
                  <img
                    src={resolveMediaUrl(item.imageUrl, 'hair')}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#141815]">{item.title}</p>
                    <p className="truncate text-[11px] text-[#6E7771]">{item.categoryName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deletePortfolioItem(item.id)}
                    aria-label={`Remover ${item.title}`}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: READ-ONLY PUBLIC CUSTOMER REVIEWS */}
      {subTab === 'reviews' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-[#FAF9F6] p-4 text-xs text-[#4A524D]">
            As avaliações dos clientes são públicas e transparentes. Caso identifique conteúdo
            abusivo ou impróprio, pode denunciá-lo à moderação da Kanimambo.
          </div>

          {myReviews.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-[#6E7771]">
              Ainda não recebeu avaliações de clientes.
            </div>
          ) : (
            myReviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#141815]">{rev.customerName}</p>
                    <p className="text-xs text-[#6E7771]">
                      {rev.serviceTitle} · {formatMozDate(rev.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 font-display text-sm font-bold text-[#B45309] tabular-nums">
                      <Star className="h-4 w-4 fill-[#B45309] text-[#B45309]" />
                      {rev.rating.toFixed(1)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        submitReport({
                          targetType: 'review',
                          targetId: rev.id,
                          targetLabel: `Avaliação de ${rev.customerName}`,
                          reason: 'Solicitação de revisão pelo prestador',
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs text-[#6E7771] hover:text-rose-700"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      <span>Denunciar</span>
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[#4A524D]">{rev.comment}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
