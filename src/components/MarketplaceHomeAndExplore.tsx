import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Filter,
  Map as MapIcon,
  MapPin,
  Navigation,
  Search,
  Star,
} from 'lucide-react';
import { APP_MEDIA, resolveMediaUrl } from '../assets/media';
import { MOZAMBIQUE_CITIES } from '../data/mozambiqueLocations';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  calculateDistanceKm,
  formatMzn,
  PRICING_MODEL_LABELS_PT,
} from '../utils/marketplaceLogic';
import { MozambiqueMapView } from './MozambiqueMapView';
import type { ProviderService, SortByOption } from '../types/marketplace';

interface ServiceCardProps {
  service: ProviderService & { distanceKm: number };
  onViewProvider: (providerId: string) => void;
  onRequestService: (service: ProviderService) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onViewProvider,
  onRequestService,
}) => {
  const isAvailable = service.providerAvailable;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-white transition-colors hover:border-zinc-300">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F3F1EC]">
        <img
          src={resolveMediaUrl(service.imageUrl, 'hair')}
          alt={service.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Single clean availability line + rating */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span
            className={`font-semibold ${
              isAvailable ? 'text-[#14533D]' : 'text-[#6E7771]'
            }`}
          >
            {isAvailable
              ? 'Disponível agora'
              : service.providerAvailabilityStatus === 'paused'
              ? 'Pausado temporariamente'
              : 'Indisponível'}
          </span>

          <span className="inline-flex items-center gap-1 font-semibold text-[#141815] tabular-nums">
            <Star className="h-3.5 w-3.5 fill-[#B45309] text-[#B45309]" />
            {service.providerReviewCount > 0 ? service.providerRating.toFixed(1) : 'Novo'}
            {service.providerReviewCount > 0 && (
              <span className="font-normal text-[#6E7771]">({service.providerReviewCount})</span>
            )}
          </span>
        </div>

        <h3 className="mt-2 font-display text-base font-bold leading-snug text-[#141815]">
          {service.title}
        </h3>

        {/* Provider & Location unboxed metadata */}
        <p className="mt-1 text-xs text-[#4A524D]">
          <button
            type="button"
            onClick={() => onViewProvider(service.providerId)}
            className="inline-flex items-center gap-1 font-semibold text-[#141815] hover:text-[#14533D] hover:underline"
          >
            <span>{service.providerName}</span>
            {service.providerVerified && (
              <CheckCircle2
                className="h-3.5 w-3.5 text-[#14533D]"
                aria-label="Prestador verificado"
              />
            )}
          </button>
        </p>

        <p className="mt-1 text-xs text-[#6E7771]">
          {service.neighborhood}, {service.city} ·{' '}
          <span className="tabular-nums">{service.distanceKm.toFixed(1)} km</span> ·{' '}
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <Clock className="h-3 w-3" />
            {service.durationMinutes} min
          </span>
        </p>

        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[#4A524D]">
          {service.description}
        </p>

        {/* Price + Action Footer */}
        <div className="mt-auto pt-4">
          <div className="flex items-baseline justify-between border-t border-zinc-100 pt-3">
            <div>
              <span className="block text-[11px] text-[#6E7771]">
                {PRICING_MODEL_LABELS_PT[service.pricingModel]}
              </span>
              <span className="font-display text-base font-bold text-[#141815] tabular-nums">
                {service.pricingModel === 'consultation'
                  ? 'Sob consulta'
                  : formatMzn(service.basePriceMzn)}
              </span>
            </div>

            <span className="text-[11px] text-[#6E7771] tabular-nums">
              {service.serviceLocationMode === 'provider_location'
                ? 'No estúdio'
                : service.transportFeeMzn === 0
                ? 'Deslocação grátis'
                : `+ ${formatMzn(service.transportFeeMzn)} desloc.`}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onViewProvider(service.providerId)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-[#141815] transition-colors hover:bg-zinc-50"
            >
              Ver Perfil
            </button>
            <button
              type="button"
              disabled={!isAvailable}
              onClick={() => onRequestService(service)}
              className="rounded-lg bg-[#14533D] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0E3D2D] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
            >
              {isAvailable ? 'Solicitar' : 'Indisponível'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export const MarketplaceHomeAndExplore: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    categories,
    providers,
    services,
    filteredServices,
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedCity,
    setSelectedCity,
    minPriceMzn,
    setMinPriceMzn,
    maxPriceMzn,
    setMaxPriceMzn,
    minRating,
    setMinRating,
    onlyAvailable,
    setOnlyAvailable,
    sortBy,
    setSortBy,
    userCoords,
    setUserLocationByCity,
    detectGpsLocation,
    isDetectingGps,
    resetDiscoveryFilters,
    openProviderProfile,
    bookingService,
    openBookingModal,
    googleMapsApiKey,
    gmpQuotaExceeded,
    markGmpQuotaExceeded,
  } = useMarketplace();

  const [exploreSubView, setExploreSubView] = useState<'grid' | 'map'>('grid');

  const popularAndRecommendedServices = useMemo(() => {
    const sorted = services
      .filter((s) => s.isActive && s.providerAvailable)
      .map((s) => ({
        ...s,
        distanceKm: calculateDistanceKm(userCoords.lat, userCoords.lng, s.lat, s.lng),
      }))
      .sort((a, b) => b.providerRating - a.providerRating);

    const seenProviders = new Set<string>();
    const primaryPick: typeof sorted = [];
    const secondaryPick: typeof sorted = [];
    for (const item of sorted) {
      if (!seenProviders.has(item.providerId)) {
        seenProviders.add(item.providerId);
        primaryPick.push(item);
      } else {
        secondaryPick.push(item);
      }
    }
    return [...primaryPick, ...secondaryPick].slice(0, 6);
  }, [services, userCoords.lat, userCoords.lng]);

  const nearbyAndTopProviders = useMemo(() => {
    return providers
      .filter((p) => !p.isSuspended)
      .map((p) => ({
        ...p,
        distanceKm: calculateDistanceKm(userCoords.lat, userCoords.lng, p.lat, p.lng),
      }))
      .sort((a, b) => {
        if (a.availabilityStatus === 'available' && b.availabilityStatus !== 'available') return -1;
        if (b.availabilityStatus === 'available' && a.availabilityStatus !== 'available') return 1;
        return a.distanceKm - b.distanceKm;
      });
  }, [providers, userCoords.lat, userCoords.lng]);

  const recentlyAddedProviders = useMemo(() => {
    return [...providers]
      .filter((p) => !p.isSuspended)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
  }, [providers]);

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveTab('explore');
  };

  if (activeTab === 'home') {
    return (
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
        {/* Editorial Split Hero (Above-the-Fold Priority) */}
        <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#14533D]">
              Moçambique · Serviços Verificados ao Domicílio e em Estúdio
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[#141815] text-balance sm:text-5xl">
              Profissionais locais de confiança, perto de si.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#4A524D]">
              Encontre cabeleireiros, barbeiros, técnicos de manutenção, limpeza, estética e eventos
              em Maputo, Matola, Beira e Nampula com preços transparentes em Meticais.
            </p>

            {/* Primary Search & Location Bar */}
            <form
              onSubmit={handleHeroSearchSubmit}
              className="rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-xs"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-[205px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Que serviço procura?"
                    aria-label="Que serviço procura?"
                    className="w-full rounded-lg bg-[#FAF9F6] py-2 pl-9 pr-3 text-sm text-[#141815] placeholder:text-[#6E7771] focus:outline-none focus:ring-1 focus:ring-[#14533D]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    aria-label="Seleccionar cidade"
                    value={selectedCity}
                    onChange={(e) => {
                      const nextCity = e.target.value;
                      setSelectedCity(nextCity);
                      if (nextCity !== 'all') {
                        setUserLocationByCity(nextCity);
                      }
                    }}
                    className="rounded-lg border border-zinc-200 bg-[#FAF9F6] px-2.5 py-2 text-xs font-medium text-[#141815] focus:border-[#14533D] focus:outline-none"
                  >
                    <option value="all">Todas cidades</option>
                    {MOZAMBIQUE_CITIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={detectGpsLocation}
                    disabled={isDetectingGps}
                    title="Usar a minha localização GPS actual"
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-semibold text-[#141815] whitespace-nowrap hover:bg-zinc-50"
                  >
                    <Navigation className="h-3.5 w-3.5 text-[#14533D]" />
                    <span className="hidden sm:inline">
                      {isDetectingGps ? 'A localizar...' : 'Perto de mim'}
                    </span>
                  </button>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#14533D] px-4 py-2 text-sm font-semibold text-white whitespace-nowrap transition-colors hover:bg-[#0E3D2D]"
                >
                  <span>Procurar</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-5">
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-zinc-200 bg-[#F3F1EC]">
              <img
                src={APP_MEDIA.hero}
                alt="Atendimento profissional num estúdio moderno em Maputo"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Categories Strip */}
        <section aria-labelledby="cat-heading" className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 id="cat-heading" className="font-display text-xl font-bold text-[#141815]">
              Categorias de Serviços
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('explore')}
              className="text-xs font-semibold text-[#14533D] hover:underline"
            >
              Ver catálogo completo
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryId('all');
                setActiveTab('explore');
              }}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedCategoryId === 'all'
                  ? 'border-[#14533D] bg-[#14533D] text-white'
                  : 'border-zinc-200 bg-white text-[#141815] hover:border-zinc-300'
              }`}
            >
              Todas as Categorias
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategoryId(cat.id);
                  setActiveTab('explore');
                }}
                className={`rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategoryId === cat.id
                    ? 'border-[#14533D] bg-[#14533D] text-white'
                    : 'border-zinc-200 bg-white text-[#141815] hover:border-zinc-300'
                }`}
              >
                {cat.namePt}
              </button>
            ))}
          </div>
        </section>

        {/* Popular & Recommended Services Grid */}
        <section aria-labelledby="popular-heading" className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 id="popular-heading" className="font-display text-2xl font-bold text-[#141815]">
                Serviços Populares e Recomendados
              </h2>
              <p className="mt-0.5 text-sm text-[#4A524D]">
                Disponíveis agora com cálculo transparente de deslocação em Meticais.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('explore')}
              className="shrink-0 text-sm font-semibold text-[#14533D] hover:underline"
            >
              Explorar todos ({services.filter((s) => s.isActive && s.providerAvailable).length})
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {popularAndRecommendedServices.map((svc) => (
              <ServiceCard
                key={svc.id}
                service={svc}
                onViewProvider={openProviderProfile}
                onRequestService={openBookingModal}
              />
            ))}
          </div>
        </section>

        {/* Nearby & Top-Rated Providers */}
        <section aria-labelledby="providers-heading" className="space-y-5 border-t border-zinc-200 pt-10">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 id="providers-heading" className="font-display text-2xl font-bold text-[#141815]">
                Prestadores Perto de Si e Mais Bem Avaliados
              </h2>
              <p className="mt-0.5 text-sm text-[#4A524D]">
                Referência actual: {userCoords.neighborhood ? `${userCoords.neighborhood}, ` : ''}
                {userCoords.city}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearbyAndTopProviders.map((prov) => {
              const isAvail = prov.availabilityStatus === 'available';
              return (
                <div
                  key={prov.providerId}
                  className="flex items-start gap-4 rounded-xl border border-zinc-200/90 bg-white p-4"
                >
                  <img
                    src={resolveMediaUrl(prov.avatarUrl, 'hair')}
                    alt={prov.businessName}
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 shrink-0 rounded-xl object-cover bg-[#F3F1EC]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-display text-base font-bold text-[#141815]">
                        {prov.businessName}
                      </h3>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#141815] tabular-nums">
                        <Star className="h-3.5 w-3.5 fill-[#B45309] text-[#B45309]" />
                        {prov.reviewCount > 0 ? prov.averageRating.toFixed(1) : 'Novo'}
                      </span>
                    </div>

                    <p className="mt-0.5 text-xs text-[#6E7771]">
                      {prov.neighborhood}, {prov.city} ·{' '}
                      <span className="tabular-nums">{prov.distanceKm.toFixed(1)} km</span>
                    </p>

                    <p className="mt-1.5 line-clamp-2 text-xs text-[#4A524D]">{prov.bio}</p>

                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          isAvail ? 'text-[#14533D]' : 'text-[#6E7771]'
                        }`}
                      >
                        {isAvail
                          ? 'Disponível'
                          : prov.availabilityStatus === 'paused'
                          ? 'Pausado'
                          : 'Indisponível'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openProviderProfile(prov.providerId)}
                        className="text-xs font-semibold text-[#14533D] hover:underline"
                      >
                        Ver perfil e serviços
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recently Added Providers */}
        <section aria-labelledby="recent-heading" className="space-y-4 border-t border-zinc-200 pt-8">
          <h2 id="recent-heading" className="font-display text-lg font-bold text-[#141815]">
            Adicionados Recentemente na Plataforma
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentlyAddedProviders.map((prov) => (
              <button
                key={prov.providerId}
                type="button"
                onClick={() => openProviderProfile(prov.providerId)}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 text-left transition-colors hover:border-[#14533D]"
              >
                <img
                  src={resolveMediaUrl(prov.avatarUrl, 'barber')}
                  alt={prov.businessName}
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 shrink-0 rounded-lg object-cover bg-[#F3F1EC]"
                />
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold text-[#141815]">
                    {prov.businessName}
                  </p>
                  <p className="truncate text-xs text-[#6E7771]">
                    {prov.neighborhood}, {prov.city}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // EXPLORE & SEARCH VIEW
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141815] sm:text-3xl">
            Explorar Serviços e Prestadores
          </h1>
          <p className="mt-1 text-sm text-[#4A524D]">
            Filtre por categoria, cidade, preço em Meticais, classificação e disponibilidade imediata.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExploreSubView('grid')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold ${
              exploreSubView === 'grid'
                ? 'border-[#14533D] bg-[#14533D] text-white'
                : 'border-zinc-300 bg-white text-[#141815]'
            }`}
          >
            <Compass className="h-4 w-4" />
            <span>Lista ({filteredServices.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setExploreSubView('map')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold ${
              exploreSubView === 'map'
                ? 'border-[#14533D] bg-[#14533D] text-white'
                : 'border-zinc-300 bg-white text-[#141815]'
            }`}
          >
            <MapIcon className="h-4 w-4" />
            <span>Mapa</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Que serviço procura?"
              aria-label="Pesquisar serviço ou prestador"
              className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-[#14533D] focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              aria-label="Filtrar por categoria"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
            >
              <option value="all">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.namePt}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div className="flex gap-2">
            <select
              aria-label="Filtrar por cidade"
              value={selectedCity}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedCity(next);
                if (next !== 'all') setUserLocationByCity(next);
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
            >
              <option value="all">Todas as cidades</option>
              {MOZAMBIQUE_CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={detectGpsLocation}
              disabled={isDetectingGps}
              title="Usar GPS actual"
              aria-label="Detectar localização GPS"
              className="shrink-0 rounded-lg border border-zinc-300 bg-[#FAF9F6] px-2.5 py-2 text-xs font-semibold text-[#141815] hover:bg-zinc-100"
            >
              <MapPin className="h-4 w-4 text-[#14533D]" />
            </button>
          </div>

          {/* Sort Filter */}
          <div>
            <select
              aria-label="Ordenar resultados"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByOption)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
            >
              <option value="rating">Ordenar: Melhor avaliação</option>
              <option value="distance">Ordenar: Menor distância</option>
              <option value="price_asc">Ordenar: Menor preço (MT)</option>
              <option value="price_desc">Ordenar: Maior preço (MT)</option>
              <option value="newest">Ordenar: Mais recentes</option>
            </select>
          </div>
        </div>

        {/* Second row: Price Range, Rating, Availability Toggle, Reset */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[#6E7771]" />
              <span className="text-xs font-semibold text-[#4A524D]">Preço (MT):</span>
              <input
                type="number"
                min={0}
                value={minPriceMzn}
                onChange={(e) => setMinPriceMzn(e.target.value)}
                placeholder="Mín"
                aria-label="Preço mínimo em Meticais"
                className="w-24 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs tabular-nums focus:border-[#14533D] focus:outline-none"
              />
              <span className="text-xs text-zinc-400">–</span>
              <input
                type="number"
                min={0}
                value={maxPriceMzn}
                onChange={(e) => setMaxPriceMzn(e.target.value)}
                placeholder="Máx"
                aria-label="Preço máximo em Meticais"
                className="w-24 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs tabular-nums focus:border-[#14533D] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#4A524D]">Avaliação:</span>
              <select
                aria-label="Avaliação mínima"
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus:border-[#14533D] focus:outline-none"
              >
                <option value={0}>Todas</option>
                <option value={4}>4.0+ estrelas</option>
                <option value={4.5}>4.5+ estrelas</option>
              </select>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#141815]">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="rounded border-zinc-300 text-[#14533D]"
              />
              <span>Apenas prestadores disponíveis agora</span>
            </label>
          </div>

          <button
            type="button"
            onClick={resetDiscoveryFilters}
            className="text-xs font-semibold text-[#14533D] hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Results View: Map or Grid */}
      {exploreSubView === 'map' && !bookingService && (
        <MozambiqueMapView
          providers={providers.filter((p) =>
            onlyAvailable ? p.availabilityStatus === 'available' : true
          )}
          services={filteredServices}
          userCoords={userCoords}
          googleMapsApiKey={googleMapsApiKey}
          gmpQuotaExceeded={gmpQuotaExceeded}
          onQuotaExceeded={markGmpQuotaExceeded}
          onSelectProvider={openProviderProfile}
        />
      )}

      {filteredServices.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
          <p className="font-display text-lg font-bold text-[#141815]">
            Nenhum serviço encontrado com os filtros actuais
          </p>
          <p className="mt-1 text-sm text-[#4A524D]">
            Experimente alargar o intervalo de preço, alterar a cidade ou incluir prestadores
            temporariamente indisponíveis.
          </p>
          <button
            type="button"
            onClick={resetDiscoveryFilters}
            className="mt-4 rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
          >
            Repor Filtros de Pesquisa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((svc) => (
            <ServiceCard
              key={svc.id}
              service={svc}
              onViewProvider={openProviderProfile}
              onRequestService={openBookingModal}
            />
          ))}
        </div>
      )}
    </div>
  );
};
