import React, { useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, Navigation, Receipt, X } from 'lucide-react';
import { MOZAMBIQUE_CITIES, resolveLocationCoords } from '../data/mozambiqueLocations';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  calculateDistanceKm,
  calculatePricingBreakdown,
  formatMzn,
  PRICING_MODEL_LABELS_PT,
} from '../utils/marketplaceLogic';
import { MozambiqueMapView } from './MozambiqueMapView';
import type { RequestLocationMode } from '../types/marketplace';

export const ServiceRequestModal: React.FC = () => {
  const {
    bookingService,
    closeBookingModal,
    currentUser,
    providers,
    services,
    userCoords,
    createServiceRequest,
    googleMapsApiKey,
    gmpQuotaExceeded,
    markGmpQuotaExceeded,
  } = useMarketplace();

  const tomorrowIso = useMemo(() => {
    const dt = new Date(Date.now() + 86400000);
    return dt.toISOString().slice(0, 10);
  }, []);

  const [preferredDate, setPreferredDate] = useState(tomorrowIso);
  const [preferredTime, setPreferredTime] = useState('10:00');
  const [locationMode, setLocationMode] = useState<RequestLocationMode>('customer_location');
  const [customerCity, setCustomerCity] = useState(currentUser?.city || userCoords.city || 'Maputo');
  const [customerNeighborhood, setCustomerNeighborhood] = useState(
    currentUser?.neighborhood || userCoords.neighborhood || 'Polana Cimento'
  );
  const [customerAddress, setCustomerAddress] = useState(currentUser?.address || '');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [routeComputedKm, setRouteComputedKm] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!bookingService) return;
    setErrorMsg(null);
    setRouteComputedKm(null);
    if (bookingService.serviceLocationMode === 'provider_location') {
      setLocationMode('provider_location');
    } else {
      setLocationMode('customer_location');
    }
    if (currentUser) {
      setCustomerCity(currentUser.city);
      setCustomerNeighborhood(currentUser.neighborhood);
      setCustomerAddress(currentUser.address || '');
    }
  }, [bookingService, currentUser]);

  const availableNeighborhoods = useMemo(() => {
    const found =
      MOZAMBIQUE_CITIES.find((c) => c.name === customerCity) || MOZAMBIQUE_CITIES[0];
    return found.neighborhoods;
  }, [customerCity]);

  const customerResolvedCoords = useMemo(
    () => resolveLocationCoords(customerCity, customerNeighborhood),
    [customerCity, customerNeighborhood]
  );

  const fallbackDistanceKm = useMemo(() => {
    if (!bookingService) return 0;
    return calculateDistanceKm(
      bookingService.lat,
      bookingService.lng,
      customerResolvedCoords.lat,
      customerResolvedCoords.lng
    );
  }, [bookingService, customerResolvedCoords.lat, customerResolvedCoords.lng]);

  const effectiveDistanceKm = routeComputedKm ?? fallbackDistanceKm;

  const pricing = useMemo(() => {
    if (!bookingService) return null;
    return calculatePricingBreakdown({
      pricingModel: bookingService.pricingModel,
      basePriceMzn: bookingService.basePriceMzn,
      transportFeeMzn: bookingService.transportFeeMzn,
      freeTransportRadiusKm: bookingService.freeTransportRadiusKm,
      extraKmRateMzn: bookingService.extraKmRateMzn,
      locationMode,
      distanceKm: effectiveDistanceKm,
    });
  }, [bookingService, locationMode, effectiveDistanceKm]);

  if (!bookingService || !pricing) return null;

  const handleCityChange = (nextCity: string) => {
    setCustomerCity(nextCity);
    setRouteComputedKm(null);
    const found = MOZAMBIQUE_CITIES.find((c) => c.name === nextCity);
    if (found?.neighborhoods[0]) {
      setCustomerNeighborhood(found.neighborhoods[0].name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await createServiceRequest({
        serviceId: bookingService.id,
        preferredDate,
        preferredTime,
        locationMode,
        customerCity,
        customerNeighborhood,
        customerAddress,
        customerLat: customerResolvedCoords.lat,
        customerLng: customerResolvedCoords.lng,
        specialInstructions,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#14533D]">
              Solicitar Serviço · {bookingService.providerName}
            </span>
            <h2 id="booking-modal-title" className="mt-1 font-display text-xl font-bold text-[#141815]">
              {bookingService.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeBookingModal}
            aria-label="Fechar formulário de solicitação"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Date & Time */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="req-date"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#141815]"
              >
                <Calendar className="h-3.5 w-3.5 text-[#14533D]" />
                <span>Data Preferida *</span>
              </label>
              <input
                id="req-date"
                type="date"
                required
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums focus:border-[#14533D] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="req-time"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#141815]"
              >
                <Clock className="h-3.5 w-3.5 text-[#14533D]" />
                <span>Hora Preferida *</span>
              </label>
              <input
                id="req-time"
                type="time"
                required
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums focus:border-[#14533D] focus:outline-none"
              />
            </div>
          </div>

          {/* Location Mode */}
          <div>
            <span className="block text-xs font-semibold text-[#141815]">
              Onde pretende receber o serviço? *
            </span>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={bookingService.serviceLocationMode === 'provider_location'}
                onClick={() => setLocationMode('customer_location')}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  locationMode === 'customer_location'
                    ? 'border-[#14533D] bg-emerald-50/70'
                    : 'border-zinc-200 bg-white'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="block font-display text-sm font-bold text-[#141815]">
                  Ao domicílio do cliente
                </span>
                <span className="mt-0.5 block text-xs text-[#4A524D]">
                  O prestador desloca-se até ao seu endereço.
                </span>
              </button>

              <button
                type="button"
                disabled={bookingService.serviceLocationMode === 'customer_location'}
                onClick={() => setLocationMode('provider_location')}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  locationMode === 'provider_location'
                    ? 'border-[#14533D] bg-emerald-50/70'
                    : 'border-zinc-200 bg-white'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="block font-display text-sm font-bold text-[#141815]">
                  No local do prestador
                </span>
                <span className="mt-0.5 block text-xs text-[#4A524D]">
                  {bookingService.neighborhood}, {bookingService.city} (Sem taxa de deslocação)
                </span>
              </button>
            </div>
          </div>

          {/* Customer Address / Coordinates when customer_location */}
          {locationMode === 'customer_location' && (
            <div className="space-y-3 rounded-xl border border-zinc-200 bg-[#FAF9F6] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="req-city"
                    className="block text-xs font-semibold text-[#141815]"
                  >
                    Cidade de Atendimento *
                  </label>
                  <select
                    id="req-city"
                    value={customerCity}
                    onChange={(e) => handleCityChange(e.target.value)}
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
                  <label
                    htmlFor="req-neighborhood"
                    className="block text-xs font-semibold text-[#141815]"
                  >
                    Bairro *
                  </label>
                  <select
                    id="req-neighborhood"
                    value={customerNeighborhood}
                    onChange={(e) => {
                      setCustomerNeighborhood(e.target.value);
                      setRouteComputedKm(null);
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    {availableNeighborhoods.map((nb) => (
                      <option key={nb.name} value={nb.name}>
                        {nb.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="req-address"
                  className="block text-xs font-semibold text-[#141815]"
                >
                  Avenida, Rua, Casa ou Ponto de Referência
                </label>
                <div className="relative mt-1">
                  <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    id="req-address"
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Ex: Av. 24 de Julho, nº 1150, 2º andar"
                    className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>

              {/* Interactive Route & Distance Map */}
              <MozambiqueMapView
                providers={providers}
                services={services}
                userCoords={{
                  lat: customerResolvedCoords.lat,
                  lng: customerResolvedCoords.lng,
                  city: customerCity,
                  neighborhood: customerNeighborhood,
                }}
                googleMapsApiKey={googleMapsApiKey}
                gmpQuotaExceeded={gmpQuotaExceeded}
                onQuotaExceeded={markGmpQuotaExceeded}
                onSelectProvider={() => {}}
                routeOrigin={{
                  lat: bookingService.lat,
                  lng: bookingService.lng,
                  label: bookingService.providerName,
                }}
                routeDestination={{
                  lat: customerResolvedCoords.lat,
                  lng: customerResolvedCoords.lng,
                  label: `${customerNeighborhood}, ${customerCity}`,
                }}
                onRouteDistanceComputed={setRouteComputedKm}
                compactHeight
              />
            </div>
          )}

          {/* Special Instructions */}
          <div>
            <label
              htmlFor="req-notes"
              className="block text-xs font-semibold text-[#141815]"
            >
              Instruções Especiais ou Detalhes do Pedido
            </label>
            <textarea
              id="req-notes"
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Indique detalhes úteis para o prestador (ex: estacionamento, tipo de cabelo, material necessário)..."
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
            />
          </div>

          {/* Transparent Price Breakdown Box */}
          <div
            className="rounded-xl border border-[#14533D]/30 bg-emerald-50/40 p-4"
            data-testid="pricing-breakdown-box"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[#141815]">
                <Receipt className="h-4 w-4 text-[#14533D]" />
                <span>Resumo Transparente de Preço (MZN)</span>
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-[#4A524D] tabular-nums">
                <Navigation className="h-3.5 w-3.5 text-[#14533D]" />
                {pricing.distanceKm.toFixed(1)} km de distância
              </span>
            </div>

            <div className="mt-3 space-y-1.5 border-t border-zinc-200/80 pt-3 text-sm">
              <div className="flex items-center justify-between text-[#4A524D]">
                <span>
                  Serviço ({PRICING_MODEL_LABELS_PT[bookingService.pricingModel]}):
                </span>
                <span className="font-semibold text-[#141815] tabular-nums">
                  {pricing.isConsultation ? 'Sob consulta' : formatMzn(pricing.servicePriceMzn)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#4A524D]">
                <span>
                  Taxa de deslocação{' '}
                  {locationMode === 'provider_location'
                    ? '(No local do prestador)'
                    : pricing.freeRadiusApplied
                    ? `(Grátis até ${bookingService.freeTransportRadiusKm} km)`
                    : `(Base + ${pricing.extraKmCharged.toFixed(1)} km extra)`}
                  :
                </span>
                <span className="font-semibold text-[#141815] tabular-nums">
                  {formatMzn(pricing.transportFeeMzn)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-200 pt-2 font-display text-base font-bold text-[#141815]">
                <span>Total Estimado:</span>
                <span className="text-[#14533D] tabular-nums">
                  {pricing.isConsultation
                    ? `Sob consulta + ${formatMzn(pricing.transportFeeMzn)}`
                    : formatMzn(pricing.estimatedTotalMzn)}
                </span>
              </div>
            </div>

            <p className="mt-2.5 text-[11px] text-[#4A524D]">
              Não há cobrança automática. O prestador irá rever e aceitar o pedido antes da
              confirmação final.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeBookingModal}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#141815] hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#14533D] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0E3D2D] disabled:opacity-60"
            >
              {submitting ? 'A enviar pedido...' : 'Confirmar e Enviar Pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
