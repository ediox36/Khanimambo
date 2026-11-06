import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Flag,
  Image as ImageIcon,
  MapPin,
  Star,
  X,
} from 'lucide-react';
import { resolveMediaUrl } from '../assets/media';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  calculateDistanceKm,
  formatMozDate,
  formatMzn,
  LOCATION_MODE_LABELS_PT,
  PRICING_MODEL_LABELS_PT,
} from '../utils/marketplaceLogic';

export const ProviderPublicProfileModal: React.FC = () => {
  const {
    selectedProviderId,
    closeProviderProfile,
    providers,
    services,
    portfolios,
    reviews,
    userCoords,
    openBookingModal,
    submitReport,
  } = useMarketplace();

  const [reportTarget, setReportTarget] = useState<{
    type: 'provider' | 'review';
    id: string;
    label: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('Conteúdo impróprio ou enganoso');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  const provider = useMemo(
    () => providers.find((p) => p.providerId === selectedProviderId) || null,
    [providers, selectedProviderId]
  );

  const providerServices = useMemo(
    () =>
      services.filter((s) => s.providerId === selectedProviderId && s.isActive),
    [services, selectedProviderId]
  );

  const providerPortfolio = useMemo(
    () => portfolios.filter((p) => p.providerId === selectedProviderId),
    [portfolios, selectedProviderId]
  );

  const providerReviews = useMemo(
    () =>
      reviews
        .filter((r) => r.providerId === selectedProviderId && !r.isModeratedHidden)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reviews, selectedProviderId]
  );

  if (!selectedProviderId || !provider) return null;

  const distanceKm = calculateDistanceKm(
    userCoords.lat,
    userCoords.lng,
    provider.lat,
    provider.lng
  );
  const isAvailable = provider.availabilityStatus === 'available';

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    setReporting(true);
    try {
      await submitReport({
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        targetLabel: reportTarget.label,
        reason: reportReason,
        details: reportDetails,
      });
      setReportTarget(null);
      setReportDetails('');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-profile-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        {/* Top Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <img
              src={resolveMediaUrl(provider.avatarUrl, 'hair')}
              alt={provider.businessName}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-xl object-cover bg-[#F3F1EC]"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h2
                  id="provider-profile-title"
                  className="font-display text-lg font-bold text-[#141815]"
                >
                  {provider.businessName}
                </h2>
                {provider.isVerified && (
                  <CheckCircle2
                    className="h-4 w-4 text-[#14533D]"
                    aria-label="Prestador verificado"
                  />
                )}
              </div>
              <p className="text-xs text-[#6E7771]">
                {provider.displayName} · {provider.neighborhood}, {provider.city} ·{' '}
                <span className="tabular-nums">{distanceKm.toFixed(1)} km</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setReportTarget({
                  type: 'provider',
                  id: provider.providerId,
                  label: provider.businessName,
                })
              }
              title="Denunciar perfil"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-[#6E7771] hover:bg-zinc-50 hover:text-rose-700"
            >
              <Flag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Denunciar</span>
            </button>
            <button
              type="button"
              onClick={closeProviderProfile}
              aria-label="Fechar perfil do prestador"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-8 p-6">
          {/* Status & Summary Strip */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-[#FAF9F6] p-4 sm:grid-cols-3">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#6E7771]">
                Disponibilidade
              </span>
              <span
                className={`mt-1 inline-block text-sm font-bold ${
                  isAvailable
                    ? 'text-[#14533D]'
                    : provider.availabilityStatus === 'paused'
                    ? 'text-amber-800'
                    : 'text-rose-800'
                }`}
              >
                {isAvailable
                  ? 'Disponível para pedidos'
                  : provider.availabilityStatus === 'paused'
                  ? 'Pausado temporariamente'
                  : 'Indisponível'}
              </span>
              {provider.pauseReason && provider.availabilityStatus === 'paused' && (
                <p className="mt-0.5 text-xs text-[#4A524D]">{provider.pauseReason}</p>
              )}
            </div>

            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#6E7771]">
                Avaliação Média
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-[#B45309] text-[#B45309]" />
                <span className="font-display text-base font-bold text-[#141815] tabular-nums">
                  {provider.reviewCount > 0 ? `${provider.averageRating.toFixed(1)} / 5.0` : 'Sem avaliações'}
                </span>
                <span className="text-xs text-[#6E7771] tabular-nums">
                  ({provider.reviewCount})
                </span>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#6E7771]">
                Localização e Verificação
              </span>
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#141815]">
                <MapPin className="h-3.5 w-3.5 text-[#14533D]" />
                <span>
                  {provider.neighborhood}, {provider.city}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-[#6E7771]">
                {provider.isVerified ? 'Conta verificada pela Kanimambo' : 'Perfil registado'} ·{' '}
                {provider.completedCount} concluídos
              </p>
            </div>
          </div>

          {/* Bio */}
          <div>
            <h3 className="font-display text-base font-bold text-[#141815]">Sobre o Prestador</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#4A524D]">{provider.bio}</p>
          </div>

          {/* Report Inline Box when triggered */}
          {reportTarget && (
            <form
              onSubmit={handleReportSubmit}
              className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-rose-900">
                  Denunciar: {reportTarget.label}
                </p>
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="text-xs text-rose-700 hover:underline"
                >
                  Cancelar
                </button>
              </div>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs"
              >
                <option value="Conteúdo impróprio ou enganoso">
                  Conteúdo impróprio ou enganoso
                </option>
                <option value="Linguagem ofensiva ou assédio">
                  Linguagem ofensiva ou assédio
                </option>
                <option value="Preços falsos ou fraude">Preços falsos ou fraude</option>
                <option value="Outro motivo">Outro motivo</option>
              </select>
              <textarea
                rows={2}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Descreva brevemente o problema..."
                className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={reporting}
                className="rounded-lg bg-rose-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-900"
              >
                {reporting ? 'A enviar...' : 'Enviar Denúncia'}
              </button>
            </form>
          )}

          {/* Services Offered */}
          <div>
            <h3 className="font-display text-lg font-bold text-[#141815]">
              Serviços Disponíveis ({providerServices.length})
            </h3>
            {providerServices.length === 0 ? (
              <p className="mt-2 text-sm text-[#6E7771]">
                Este prestador não tem serviços activos publicados neste momento.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {providerServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3.5">
                      <img
                        src={resolveMediaUrl(svc.imageUrl, 'hair')}
                        alt={svc.title}
                        referrerPolicy="no-referrer"
                        className="h-16 w-20 shrink-0 rounded-lg object-cover bg-[#F3F1EC]"
                      />
                      <div>
                        <h4 className="font-display text-base font-bold text-[#141815]">
                          {svc.title}
                        </h4>
                        <p className="mt-0.5 text-xs text-[#6E7771]">
                          {svc.categoryName} · {LOCATION_MODE_LABELS_PT[svc.serviceLocationMode]} ·{' '}
                          <span className="inline-flex items-center gap-0.5 tabular-nums">
                            <Clock className="h-3 w-3" />
                            {svc.durationMinutes} min
                          </span>
                        </p>
                        <p className="mt-1.5 text-xs text-[#4A524D]">{svc.description}</p>
                        <p className="mt-1 text-[11px] text-[#6E7771] tabular-nums">
                          Deslocação:{' '}
                          {svc.serviceLocationMode === 'provider_location'
                            ? 'Apenas no local do prestador (0 MT)'
                            : `${formatMzn(svc.transportFeeMzn)} base (grátis até ${
                                svc.freeTransportRadiusKm
                              } km, +${formatMzn(svc.extraKmRateMzn)}/km extra)`}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-100 pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                      <div className="sm:text-right">
                        <span className="block text-[11px] text-[#6E7771]">
                          {PRICING_MODEL_LABELS_PT[svc.pricingModel]}
                        </span>
                        <span className="font-display text-base font-bold text-[#141815] tabular-nums">
                          {svc.pricingModel === 'consultation'
                            ? 'Sob consulta'
                            : formatMzn(svc.basePriceMzn)}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => {
                          closeProviderProfile();
                          openBookingModal(svc);
                        }}
                        className="rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
                      >
                        {isAvailable ? 'Solicitar Serviço' : 'Indisponível'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Portfolio Gallery */}
          {providerPortfolio.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#141815]">
                <ImageIcon className="h-4 w-4 text-[#14533D]" />
                <span>Portfólio de Trabalhos ({providerPortfolio.length})</span>
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {providerPortfolio.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-[#FAF9F6]"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden">
                      <img
                        src={resolveMediaUrl(item.imageUrl, 'hair')}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-semibold text-[#141815]">{item.title}</p>
                      <p className="truncate text-[11px] text-[#6E7771]">{item.categoryName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Reviews & Ratings */}
          <div>
            <h3 className="font-display text-lg font-bold text-[#141815]">
              Avaliações de Clientes ({providerReviews.length})
            </h3>
            {providerReviews.length === 0 ? (
              <p className="mt-2 text-sm text-[#6E7771]">
                Ainda não existem avaliações públicas para este prestador.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {providerReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-zinc-200 bg-[#FAF9F6] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
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
                            setReportTarget({
                              type: 'review',
                              id: rev.id,
                              label: `Avaliação de ${rev.customerName}`,
                            })
                          }
                          title="Denunciar avaliação"
                          aria-label={`Denunciar avaliação de ${rev.customerName}`}
                          className="text-xs text-[#6E7771] hover:text-rose-700"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-[#4A524D]">{rev.comment}</p>

                    {rev.photoUrl && (
                      <div className="mt-3 w-40 overflow-hidden rounded-lg border border-zinc-200">
                        <img
                          src={resolveMediaUrl(rev.photoUrl, 'hair')}
                          alt={`Foto da avaliação de ${rev.customerName}`}
                          referrerPolicy="no-referrer"
                          className="aspect-[4/3] w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
