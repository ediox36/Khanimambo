import React, { useEffect, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Star } from 'lucide-react';
import { calculateDistanceKm, formatMzn } from '../utils/marketplaceLogic';
import type { ProviderProfile, ProviderService } from '../types/marketplace';

interface LatLngLiteral {
  lat: number;
  lng: number;
}

interface GmpPolylineInstance {
  setMap: (map: unknown | null) => void;
}

interface GmpRouteInstance {
  distanceMeters?: number | null;
  viewport?: unknown | null;
  createPolylines?: (options?: {
    polylineOptions?: Record<string, unknown>;
  }) => GmpPolylineInstance[];
}

interface GmpComputeRoutesResponse {
  routes?: GmpRouteInstance[];
}

interface GmpRoutesLibrary {
  Route: {
    computeRoutes: (req: {
      origin: LatLngLiteral;
      destination: LatLngLiteral;
      travelMode: unknown;
      fields: string[];
    }) => Promise<GmpComputeRoutesResponse>;
  };
  TravelMode?: {
    DRIVING?: unknown;
  };
}

interface RouteOverlayProps {
  origin: LatLngLiteral;
  destination: LatLngLiteral;
  onDistanceComputed?: (km: number, durationText?: string) => void;
  onQuotaError?: () => void;
}

const GoogleRouteOverlay: React.FC<RouteOverlayProps> = ({
  origin,
  destination,
  onDistanceComputed,
  onQuotaError,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes') as unknown as GmpRoutesLibrary | null;
  const onDistRef = React.useRef(onDistanceComputed);
  const onQuotaRef = React.useRef(onQuotaError);
  onDistRef.current = onDistanceComputed;
  onQuotaRef.current = onQuotaError;

  const origLat = origin.lat;
  const origLng = origin.lng;
  const destLat = destination.lat;
  const destLng = destination.lng;

  useEffect(() => {
    if (!routesLib || !map || typeof routesLib.Route?.computeRoutes !== 'function') return;

    let activePolylines: GmpPolylineInstance[] = [];
    let cancelled = false;

    const travelMode = routesLib.TravelMode?.DRIVING ?? 'DRIVING';

    routesLib.Route.computeRoutes({
      origin: { lat: origLat, lng: origLng },
      destination: { lat: destLat, lng: destLng },
      travelMode,
      fields: ['distanceMeters', 'durationMillis', 'path', 'viewport'],
    })
      .then((response: GmpComputeRoutesResponse) => {
        if (cancelled) return;
        if (response.routes && response.routes.length > 0) {
          const route = response.routes[0];
          if (typeof route.distanceMeters === 'number' && onDistRef.current) {
            const km = Math.round((route.distanceMeters / 1000) * 10) / 10;
            onDistRef.current(km);
          }
          if (typeof route.createPolylines === 'function') {
            try {
              activePolylines = route.createPolylines({
                polylineOptions: {
                  strokeColor: '#14533D',
                  strokeOpacity: 0.9,
                  strokeWeight: 4,
                },
              });
              for (const poly of activePolylines) {
                poly.setMap(map);
              }
            } catch {
              // Ignore polyline error if path not returned
            }
          }
          if (route.viewport) {
            try {
              (map as { fitBounds: (b: unknown) => void }).fitBounds(route.viewport);
            } catch {
              // Ignore bounds error
            }
          }
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('Quota')
        ) {
          onQuotaRef.current?.();
        }
      });

    return () => {
      cancelled = true;
      for (const poly of activePolylines) {
        try {
          poly.setMap(null);
        } catch {
          // ignore cleanup
        }
      }
    };
  }, [routesLib, map, origLat, origLng, destLat, destLng]);

  return null;
};

class MapRenderErrorBoundary extends React.Component<
  { onErrorFallback: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { onErrorFallback: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onErrorFallback();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

interface MozambiqueMapViewProps {
  providers: ProviderProfile[];
  services: ProviderService[];
  userCoords: { lat: number; lng: number; city: string; neighborhood: string };
  googleMapsApiKey: string;
  gmpQuotaExceeded: boolean;
  onQuotaExceeded: () => void;
  onSelectProvider: (providerId: string) => void;
  routeOrigin?: { lat: number; lng: number; label?: string };
  routeDestination?: { lat: number; lng: number; label?: string };
  onRouteDistanceComputed?: (km: number) => void;
  compactHeight?: boolean;
}

export const MozambiqueMapView: React.FC<MozambiqueMapViewProps> = ({
  providers,
  services,
  userCoords,
  googleMapsApiKey,
  gmpQuotaExceeded,
  onQuotaExceeded,
  onSelectProvider,
  routeOrigin,
  routeDestination,
  onRouteDistanceComputed,
  compactHeight = false,
}) => {
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [mapSdkFailed, setMapSdkFailed] = useState(false);
  const onDistCallbackRef = React.useRef(onRouteDistanceComputed);
  onDistCallbackRef.current = onRouteDistanceComputed;

  const activeProvider = useMemo(
    () => providers.find((p) => p.providerId === activeMarkerId) || null,
    [providers, activeMarkerId]
  );

  const cheapestServiceByProvider = useMemo(() => {
    const result: Record<string, ProviderService> = {};
    for (const svc of services) {
      if (!svc.isActive) continue;
      const existing = result[svc.providerId];
      if (!existing || svc.basePriceMzn < existing.basePriceMzn) {
        result[svc.providerId] = svc;
      }
    }
    return result;
  }, [services]);

  const directDistanceKm = useMemo(() => {
    if (!routeOrigin || !routeDestination) return null;
    return calculateDistanceKm(
      routeOrigin.lat,
      routeOrigin.lng,
      routeDestination.lat,
      routeDestination.lng
    );
  }, [routeOrigin, routeDestination]);

  useEffect(() => {
    if (directDistanceKm !== null && onDistCallbackRef.current) {
      onDistCallbackRef.current(directDistanceKm);
    }
  }, [directDistanceKm]);

  const canRenderGoogleMaps = Boolean(googleMapsApiKey) && !gmpQuotaExceeded && !mapSdkFailed;
  const centerPoint = routeOrigin
    ? { lat: routeOrigin.lat, lng: routeOrigin.lng }
    : { lat: userCoords.lat, lng: userCoords.lng };

  if (canRenderGoogleMaps) {
    return (
      <MapRenderErrorBoundary onErrorFallback={() => setMapSdkFailed(true)}>
        <div
          className={`relative w-full overflow-hidden rounded-xl border border-zinc-200 bg-[#F3F1EC] ${
            compactHeight ? 'h-48' : 'h-[440px]'
          }`}
          data-testid="google-maps-container"
        >
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={centerPoint}
            defaultZoom={12}
            gestureHandling="cooperative"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="h-full w-full"
          >
          {/* Customer / User location marker */}
          <AdvancedMarker
            position={{ lat: userCoords.lat, lng: userCoords.lng }}
            title={`A sua localização (${userCoords.city})`}
          >
            <Pin background="#141815" borderColor="#FFFFFF" glyphColor="#FFFFFF" scale={1.05} />
          </AdvancedMarker>

          {/* Provider markers */}
          {!routeOrigin &&
            providers.map((prov) => {
              const isAvailable = prov.availabilityStatus === 'available';
              return (
                <AdvancedMarker
                  key={prov.providerId}
                  position={{ lat: prov.lat, lng: prov.lng }}
                  title={prov.businessName}
                  onClick={() => setActiveMarkerId(prov.providerId)}
                >
                  <Pin
                    background={isAvailable ? '#14533D' : '#71717A'}
                    borderColor="#FFFFFF"
                    glyphColor="#FFFFFF"
                    scale={1.15}
                  />
                </AdvancedMarker>
              );
            })}

          {routeOrigin && routeDestination && (
            <>
              <AdvancedMarker position={routeOrigin} title={routeOrigin.label || 'Prestador'}>
                <Pin background="#14533D" borderColor="#FFFFFF" glyphColor="#FFFFFF" scale={1.15} />
              </AdvancedMarker>
              <AdvancedMarker position={routeDestination} title={routeDestination.label || 'Cliente'}>
                <Pin background="#B45309" borderColor="#FFFFFF" glyphColor="#FFFFFF" scale={1.15} />
              </AdvancedMarker>
              <GoogleRouteOverlay
                origin={routeOrigin}
                destination={routeDestination}
                onDistanceComputed={onRouteDistanceComputed}
                onQuotaError={onQuotaExceeded}
              />
            </>
          )}

          {activeProvider && (
            <InfoWindow
              position={{ lat: activeProvider.lat, lng: activeProvider.lng }}
              onCloseClick={() => setActiveMarkerId(null)}
            >
              <div className="max-w-[220px] p-1 text-zinc-900">
                <p className="font-display text-sm font-bold">{activeProvider.businessName}</p>
                <p className="text-xs text-zinc-600">
                  {activeProvider.neighborhood}, {activeProvider.city}
                </p>
                <p className="mt-1 text-xs font-medium text-amber-700">
                  ★ {activeProvider.averageRating.toFixed(1)} ({activeProvider.reviewCount})
                </p>
                {cheapestServiceByProvider[activeProvider.providerId] && (
                  <p className="mt-0.5 text-xs text-zinc-700 tabular-nums">
                    Desde{' '}
                    {cheapestServiceByProvider[activeProvider.providerId].pricingModel ===
                    'consultation'
                      ? 'Sob consulta'
                      : formatMzn(
                          cheapestServiceByProvider[activeProvider.providerId].basePriceMzn
                        )}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onSelectProvider(activeProvider.providerId)}
                  className="mt-2 w-full rounded-lg bg-[#14533D] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
                >
                  Ver Perfil e Serviços
                </button>
              </div>
            </InfoWindow>
          )}
          </GoogleMap>
        </div>
      </MapRenderErrorBoundary>
    );
  }

  // Interactive Mozambique Coordinate Map Fallback (used when Demo Key quota is exceeded or key not configured)
  const points = routeOrigin && routeDestination
    ? [
        { id: 'origin', label: routeOrigin.label || 'Prestador', lat: routeOrigin.lat, lng: routeOrigin.lng, kind: 'provider' as const },
        { id: 'dest', label: routeDestination.label || 'Cliente', lat: routeDestination.lat, lng: routeDestination.lng, kind: 'user' as const },
      ]
    : [
        { id: 'user', label: `Você (${userCoords.city})`, lat: userCoords.lat, lng: userCoords.lng, kind: 'user' as const },
        ...providers.map((p) => ({
          id: p.providerId,
          label: p.businessName,
          sublabel: `${p.neighborhood}, ${p.city}`,
          rating: p.averageRating,
          available: p.availabilityStatus === 'available',
          lat: p.lat,
          lng: p.lng,
          kind: 'provider' as const,
        })),
      ];

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats) - 0.018;
  const maxLat = Math.max(...lats) + 0.018;
  const minLng = Math.min(...lngs) - 0.018;
  const maxLng = Math.max(...lngs) + 0.018;

  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / Math.max(0.001, maxLng - minLng)) * 84 + 8;
    const y = (1 - (lat - minLat) / Math.max(0.001, maxLat - minLat)) * 78 + 11;
    return { x, y };
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-zinc-200 bg-[#EFECE4] ${
        compactHeight ? 'h-64' : 'h-[420px]'
      }`}
      data-testid="fallback-mozambique-map"
    >
      {/* Subtle architectural grid lines representing Maputo/Mozambique urban grid */}
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id="mz-grid" width="12.5" height="12.5" patternUnits="userSpaceOnUse">
            <path d="M 12.5 0 L 0 0 0 12.5" fill="none" stroke="#E2DDD2" strokeWidth="0.35" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#mz-grid)" />
        {/* Baía de Maputo coastline accent */}
        <path
          d="M 82 0 Q 90 35 78 68 T 88 100 L 100 100 L 100 0 Z"
          fill="#DCE7E4"
          opacity="0.75"
        />
        {routeOrigin && routeDestination && (() => {
          const p1 = project(routeOrigin.lat, routeOrigin.lng);
          const p2 = project(routeDestination.lat, routeDestination.lng);
          return (
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#14533D"
              strokeWidth="0.9"
              strokeDasharray="2,1.5"
            />
          );
        })()}
      </svg>

      {/* Top map caption */}
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-zinc-300/80 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-xs">
        <Navigation className="h-3.5 w-3.5 text-[#14533D]" />
        <span>
          {routeOrigin && routeDestination && directDistanceKm !== null
            ? `Distância estimada: ${directDistanceKm.toFixed(1)} km`
            : `Mapa de Prestadores · ${userCoords.city}`}
        </span>
      </div>

      {/* Interactive markers */}
      {points.map((pt) => {
        const pos = project(pt.lat, pt.lng);
        const isUser = pt.kind === 'user';
        const isSelected = activeMarkerId === pt.id;
        return (
          <button
            key={pt.id}
            type="button"
            onClick={() => {
              if (!isUser && !routeOrigin) {
                setActiveMarkerId(isSelected ? null : pt.id);
              }
            }}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            className="group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            aria-label={pt.label}
          >
            <div
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold shadow-sm transition-transform group-hover:scale-105 ${
                isUser
                  ? 'border-white bg-[#141815] text-white'
                  : isSelected
                  ? 'border-white bg-[#B45309] text-white'
                  : 'border-white bg-[#14533D] text-white'
              }`}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="max-w-[125px] truncate">{pt.label}</span>
            </div>
          </button>
        );
      })}

      {/* Selected provider card inside fallback map */}
      {activeProvider && !routeOrigin && (
        <div className="absolute bottom-3 left-3 right-3 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-md">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-zinc-900">
              {activeProvider.businessName}
            </p>
            <p className="truncate text-xs text-zinc-600">
              {activeProvider.neighborhood}, {activeProvider.city} ·{' '}
              <span className="inline-flex items-center gap-0.5 font-medium text-amber-700">
                <Star className="h-3 w-3 fill-amber-600 text-amber-600" />
                {activeProvider.averageRating.toFixed(1)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectProvider(activeProvider.providerId)}
            className="shrink-0 rounded-lg bg-[#14533D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
          >
            Abrir Perfil
          </button>
        </div>
      )}
    </div>
  );
};
