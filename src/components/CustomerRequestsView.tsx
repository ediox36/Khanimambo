import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { compressImageFileToDataUrl } from '../utils/imageUpload';
import {
  formatMozDate,
  formatMozDateTime,
  formatMzn,
  REQUEST_STATUS_LABELS_PT,
} from '../utils/marketplaceLogic';
import type { RequestStatus, ServiceRequest } from '../types/marketplace';

const STATUS_STYLE_MAP: Record<RequestStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-900',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  confirmed: 'border-emerald-300 bg-emerald-100/80 text-emerald-950',
  in_progress: 'border-sky-200 bg-sky-50 text-sky-900',
  completed: 'border-zinc-300 bg-zinc-100 text-zinc-900',
  rejected: 'border-rose-200 bg-rose-50 text-rose-900',
  cancelled: 'border-zinc-200 bg-zinc-50 text-zinc-600',
};

export const CustomerRequestsView: React.FC = () => {
  const {
    currentUser,
    requests,
    requestHistory,
    updateRequestStatus,
    submitReview,
    openProviderProfile,
    setActiveTab,
    openAuthModal,
  } = useMarketplace();

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'closed'>('all');
  const [reviewingRequest, setReviewingRequest] = useState<ServiceRequest | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const myCustomerRequests = useMemo(() => {
    if (!currentUser) return [];
    return requests
      .filter((r) => r.customerId === currentUser.uid)
      .filter((r) => {
        if (statusFilter === 'active') {
          return ['pending', 'accepted', 'confirmed', 'in_progress'].includes(r.status);
        }
        if (statusFilter === 'completed') {
          return r.status === 'completed';
        }
        if (statusFilter === 'closed') {
          return ['rejected', 'cancelled'].includes(r.status);
        }
        return true;
      });
  }, [currentUser, requests, statusFilter]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h1 className="font-display text-2xl font-bold text-[#141815]">Os Meus Pedidos</h1>
        <p className="mt-2 text-sm text-[#4A524D]">
          Inicie sessão para acompanhar os seus pedidos de serviço e enviar avaliações.
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setReviewError(null);
      const compressed = await compressImageFileToDataUrl(file, 720, 0.8);
      setPhotoUrl(compressed);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Erro ao carregar fotografia.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRequest) return;
    setBusyId(reviewingRequest.id);
    setReviewError(null);
    try {
      await submitReview({
        requestId: reviewingRequest.id,
        rating,
        comment,
        photoUrl: photoUrl || undefined,
      });
      setReviewingRequest(null);
      setComment('');
      setPhotoUrl('');
      setRating(5);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Não foi possível publicar a avaliação.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141815] sm:text-3xl">
            Os Meus Pedidos de Serviço
          </h1>
          <p className="mt-1 text-sm text-[#4A524D]">
            Acompanhe o estado de cada solicitação, confirme agendamentos e avalie serviços
            concluídos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          className="self-start rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
        >
          + Solicitar Novo Serviço
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 pb-3">
        {[
          { id: 'all', label: 'Todos' },
          { id: 'active', label: 'Em Andamento' },
          { id: 'completed', label: 'Concluídos' },
          { id: 'closed', label: 'Cancelados / Recusados' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
              statusFilter === tab.id
                ? 'border-[#14533D] bg-[#14533D] text-white'
                : 'border-zinc-200 bg-white text-[#4A524D] hover:text-[#141815]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {myCustomerRequests.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-[#6E7771]" />
          <p className="mt-3 font-display text-lg font-bold text-[#141815]">
            Ainda não tem pedidos nesta categoria
          </p>
          <p className="mt-1 text-sm text-[#4A524D]">
            Explore os profissionais disponíveis em Maputo, Matola e noutras cidades de Moçambique.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('explore')}
            className="mt-4 rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white"
          >
            Explorar Serviços
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {myCustomerRequests.map((req) => {
            const history = requestHistory.filter((h) => h.requestId === req.id);
            return (
              <article
                key={req.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs"
              >
                <div className="flex flex-col justify-between gap-4 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_STYLE_MAP[req.status]
                        }`}
                      >
                        {REQUEST_STATUS_LABELS_PT[req.status]}
                      </span>
                      <span className="font-mono text-xs text-[#6E7771]">#{req.id}</span>
                    </div>

                    <h2 className="mt-2 font-display text-lg font-bold text-[#141815]">
                      {req.serviceTitle}
                    </h2>

                    <p className="mt-0.5 text-xs text-[#4A524D]">
                      Prestador:{' '}
                      <button
                        type="button"
                        onClick={() => openProviderProfile(req.providerId)}
                        className="font-semibold text-[#14533D] hover:underline"
                      >
                        {req.providerName}
                      </button>
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <span className="block text-[11px] text-[#6E7771]">Total Estimado</span>
                    <span className="font-display text-lg font-bold text-[#141815] tabular-nums">
                      {req.pricingModel === 'consultation'
                        ? `Sob consulta + ${formatMzn(req.transportFeeMzn)}`
                        : formatMzn(req.estimatedTotalMzn)}
                    </span>
                    <span className="block text-[11px] text-[#6E7771] tabular-nums">
                      Serviço: {formatMzn(req.servicePriceMzn)} · Desloc.:{' '}
                      {formatMzn(req.transportFeeMzn)}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-[#4A524D] sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#14533D]" />
                    <span className="tabular-nums">
                      {formatMozDate(req.preferredDate)} às {req.preferredTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#14533D]" />
                    <span>
                      {req.locationMode === 'provider_location'
                        ? 'No local do prestador'
                        : `Ao domicílio · ${req.customerNeighborhood}, ${req.customerCity}`}{' '}
                      ({req.distanceKm.toFixed(1)} km)
                    </span>
                  </div>

                  <div className="text-[#6E7771] tabular-nums">
                    Criado em {formatMozDateTime(req.createdAt)}
                  </div>
                </div>

                {req.specialInstructions && (
                  <p className="mt-3 rounded-lg bg-[#FAF9F6] px-3 py-2 text-xs text-[#4A524D]">
                    <strong>Notas:</strong> {req.specialInstructions}
                  </p>
                )}

                {/* Status History Trail */}
                {history.length > 0 && (
                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6E7771]">
                      Histórico do Pedido
                    </p>
                    <div className="mt-2 space-y-1">
                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A524D]"
                        >
                          <span>
                            <strong>{REQUEST_STATUS_LABELS_PT[h.toStatus]}</strong> — {h.note} (
                            {h.changedByName})
                          </span>
                          <span className="font-mono text-[11px] text-[#6E7771] tabular-nums">
                            {formatMozDateTime(h.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                  {req.status === 'accepted' && (
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={async () => {
                        setBusyId(req.id);
                        try {
                          await updateRequestStatus(
                            req.id,
                            'confirmed',
                            'Agendamento confirmado pelo cliente.'
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
                    >
                      Confirmar Agendamento
                    </button>
                  )}

                  {['pending', 'accepted', 'confirmed'].includes(req.status) && (
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={async () => {
                        setBusyId(req.id);
                        try {
                          await updateRequestStatus(
                            req.id,
                            'cancelled',
                            'Pedido cancelado pelo cliente.'
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Cancelar Pedido
                    </button>
                  )}

                  {req.status === 'completed' && !req.hasReview && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewingRequest(req);
                        setRating(5);
                        setComment('');
                        setPhotoUrl('');
                        setReviewError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#B45309] px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800"
                    >
                      <Star className="h-3.5 w-3.5 fill-white" />
                      <span>Avaliar Serviço</span>
                    </button>
                  )}

                  {req.status === 'completed' && req.hasReview && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#14533D]">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Avaliação publicada</span>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Review & Rating Modal */}
      {reviewingRequest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="review-modal-title"
                  className="font-display text-lg font-bold text-[#141815]"
                >
                  Avaliar Serviço Concluído
                </h2>
                <p className="mt-0.5 text-xs text-[#4A524D]">
                  {reviewingRequest.serviceTitle} · {reviewingRequest.providerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingRequest(null)}
                aria-label="Fechar janela de avaliação"
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {reviewError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {reviewError}
              </div>
            )}

            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
              <div>
                <span className="block text-xs font-semibold text-[#141815]">
                  Classificação (1 a 5 estrelas) *
                </span>
                <div className="mt-2 flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setRating(starVal)}
                      aria-label={`${starVal} estrelas`}
                      className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold ${
                        rating >= starVal
                          ? 'border-[#B45309] bg-amber-50 text-[#B45309]'
                          : 'border-zinc-200 bg-white text-zinc-400'
                      }`}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          rating >= starVal ? 'fill-[#B45309] text-[#B45309]' : 'text-zinc-300'
                        }`}
                      />
                      <span>{starVal}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="rev-comment"
                  className="block text-xs font-semibold text-[#141815]"
                >
                  Comentário sobre a qualidade e pontualidade *
                </label>
                <textarea
                  id="rev-comment"
                  rows={3}
                  required
                  minLength={5}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Partilhe a sua experiência com outros clientes em Moçambique..."
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#141815]">
                  Fotografia do Resultado (opcional)
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-[#4A524D] hover:border-[#14533D]">
                  <Upload className="h-4 w-4 text-[#14533D]" />
                  <span>{photoUrl ? 'Fotografia anexada' : 'Anexar foto (opcional)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewingRequest(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-[#141815]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busyId === reviewingRequest.id}
                  className="rounded-lg bg-[#14533D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
                >
                  {busyId === reviewingRequest.id ? 'A publicar...' : 'Publicar Avaliação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
