import type {
  PricingBreakdown,
  PricingModel,
  ProviderService,
  RequestLocationMode,
  RequestStatus,
  ServiceLocationMode,
  SortByOption,
  UserRole,
} from '../types/marketplace.ts';

/**
 * Formats an integer/number amount in Mozambican Meticais (MT).
 */
export function formatMzn(amount: number): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} MT`;
}

/**
 * Formats an ISO date string into Mozambican DD/MM/AAAA format.
 */
export function formatMozDate(isoOrDate: string): string {
  if (!isoOrDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    const [y, m, d] = isoOrDate.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(isoOrDate);
  if (Number.isNaN(dt.getTime())) return isoOrDate;
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats an ISO timestamp into Mozambican DD/MM/AAAA, HH:mm format.
 */
export function formatMozDateTime(isoString: string): string {
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return isoString;
  const datePart = formatMozDate(isoString);
  const hours = String(dt.getHours()).padStart(2, '0');
  const mins = String(dt.getMinutes()).padStart(2, '0');
  return `${datePart}, ${hours}:${mins}`;
}

/**
 * Validates and normalizes Mozambican phone numbers (+258 82/83/84/85/86/87 XXX XXXX).
 */
export function validateMozambiquePhone(rawPhone: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const digits = rawPhone.replace(/[^\d]/g, '');
  let localDigits = digits;
  if (digits.startsWith('258') && digits.length === 12) {
    localDigits = digits.slice(3);
  } else if (digits.startsWith('00258') && digits.length === 14) {
    localDigits = digits.slice(5);
  }

  if (localDigits.length !== 9) {
    return {
      valid: false,
      normalized: rawPhone.trim(),
      error: 'O número moçambicano deve ter 9 dígitos após +258 (ex: +258 84 123 4567).',
    };
  }

  if (!/^8[2-7]\d{7}$/.test(localDigits)) {
    return {
      valid: false,
      normalized: rawPhone.trim(),
      error: 'Prefixo inválido. Use um número móvel de Moçambique (+258 82, 83, 84, 85, 86 ou 87).',
    };
  }

  const normalized = `+258 ${localDigits.slice(0, 2)} ${localDigits.slice(2, 5)} ${localDigits.slice(5)}`;
  return { valid: true, normalized };
}

/**
 * Calculates urban road-adjusted distance in km between two coordinates using Haversine.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  // Apply 1.22 urban street factor when points are distinct
  const roadKm = straightKm < 0.05 ? 0 : straightKm * 1.22;
  return Math.round(roadKm * 10) / 10;
}

/**
 * Calculates transparent service + transportation pricing breakdown in MZN.
 */
export function calculatePricingBreakdown(params: {
  pricingModel: PricingModel;
  basePriceMzn: number;
  transportFeeMzn: number;
  freeTransportRadiusKm: number;
  extraKmRateMzn: number;
  locationMode: RequestLocationMode;
  distanceKm: number;
}): PricingBreakdown {
  const isConsultation = params.pricingModel === 'consultation';
  const servicePriceMzn = isConsultation ? 0 : Math.max(0, Math.round(params.basePriceMzn));
  const safeDistance = Math.max(0, Math.round(params.distanceKm * 10) / 10);

  if (params.locationMode === 'provider_location') {
    return {
      pricingModel: params.pricingModel,
      locationMode: params.locationMode,
      distanceKm: safeDistance,
      servicePriceMzn,
      transportFeeMzn: 0,
      freeRadiusApplied: false,
      extraKmCharged: 0,
      estimatedTotalMzn: servicePriceMzn,
      isConsultation,
    };
  }

  const freeRadius = Math.max(0, params.freeTransportRadiusKm);
  if (safeDistance <= freeRadius) {
    return {
      pricingModel: params.pricingModel,
      locationMode: params.locationMode,
      distanceKm: safeDistance,
      servicePriceMzn,
      transportFeeMzn: 0,
      freeRadiusApplied: true,
      extraKmCharged: 0,
      estimatedTotalMzn: servicePriceMzn,
      isConsultation,
    };
  }

  const extraKm = Math.max(0, Math.round((safeDistance - freeRadius) * 10) / 10);
  const baseTransport = Math.max(0, params.transportFeeMzn);
  const perKmRate = Math.max(0, params.extraKmRateMzn);
  const transportFeeMzn = Math.round(baseTransport + extraKm * perKmRate);

  return {
    pricingModel: params.pricingModel,
    locationMode: params.locationMode,
    distanceKm: safeDistance,
    servicePriceMzn,
    transportFeeMzn,
    freeRadiusApplied: false,
    extraKmCharged: extraKm,
    estimatedTotalMzn: servicePriceMzn + transportFeeMzn,
    isConsultation,
  };
}

/**
 * Validates whether a service request can transition from currentStatus to nextStatus.
 */
export function canTransitionRequestStatus(
  currentStatus: RequestStatus,
  nextStatus: RequestStatus,
  actorRole: UserRole
): { allowed: boolean; reason?: string } {
  if (currentStatus === nextStatus) {
    return { allowed: false, reason: 'O pedido já se encontra neste estado.' };
  }

  const terminalStatuses: RequestStatus[] = ['completed', 'rejected', 'cancelled'];
  if (terminalStatuses.includes(currentStatus)) {
    return { allowed: false, reason: 'Este pedido já foi finalizado e não pode ser alterado.' };
  }

  if (actorRole === 'admin') {
    return { allowed: true };
  }

  if (actorRole === 'provider') {
    const providerMap: Record<RequestStatus, RequestStatus[]> = {
      pending: ['accepted', 'rejected'],
      accepted: ['confirmed', 'in_progress', 'cancelled'],
      confirmed: ['in_progress', 'completed', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      rejected: [],
      completed: [],
      cancelled: [],
    };
    if (providerMap[currentStatus].includes(nextStatus)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Transição de estado não permitida para o prestador.' };
  }

  // Customer transitions
  const customerMap: Record<RequestStatus, RequestStatus[]> = {
    pending: ['cancelled'],
    accepted: ['confirmed', 'cancelled'],
    confirmed: ['cancelled'],
    in_progress: [],
    rejected: [],
    completed: [],
    cancelled: [],
  };
  if (customerMap[currentStatus].includes(nextStatus)) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'Transição de estado não permitida para o cliente.' };
}

/**
 * Enforces review eligibility rules:
 * - Only customers of completed requests
 * - 1 review per completed request
 * - Rating 1..5
 */
export function canSubmitReview(params: {
  requestStatus: RequestStatus;
  requestCustomerId: string;
  actorUid: string;
  existingReviewCountForRequest: number;
  rating: number;
  comment: string;
}): { allowed: boolean; reason?: string } {
  if (params.requestCustomerId !== params.actorUid) {
    return { allowed: false, reason: 'Apenas o cliente que solicitou o serviço pode avaliar.' };
  }
  if (params.requestStatus !== 'completed') {
    return {
      allowed: false,
      reason: 'Só é possível avaliar após o serviço ser marcado como concluído.',
    };
  }
  if (params.existingReviewCountForRequest > 0) {
    return { allowed: false, reason: 'Este pedido já recebeu uma avaliação.' };
  }
  if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
    return { allowed: false, reason: 'A classificação deve ser entre 1 e 5 estrelas.' };
  }
  if (params.comment.trim().length < 5) {
    return { allowed: false, reason: 'Escreva um comentário com pelo menos 5 caracteres.' };
  }
  return { allowed: true };
}

/**
 * Recomputes average rating and review count from non-hidden reviews.
 */
export function computeProviderRatingStats(
  reviews: Array<{ rating: number; isModeratedHidden?: boolean }>
): { averageRating: number; reviewCount: number } {
  const visible = reviews.filter((r) => !r.isModeratedHidden);
  if (visible.length === 0) {
    return { averageRating: 0, reviewCount: 0 };
  }
  const sum = visible.reduce((acc, r) => acc + r.rating, 0);
  const avg = Math.round((sum / visible.length) * 10) / 10;
  return { averageRating: avg, reviewCount: visible.length };
}

export interface ServiceFilterOptions {
  searchQuery?: string;
  categoryId?: string;
  city?: string;
  minPriceMzn?: number | null;
  maxPriceMzn?: number | null;
  minRating?: number | null;
  onlyAvailable?: boolean;
  sortBy?: SortByOption;
  userLat?: number;
  userLng?: number;
}

/**
 * Filters and sorts marketplace services according to customer discovery criteria.
 */
export function filterAndSortServices(
  services: ProviderService[],
  filters: ServiceFilterOptions
): Array<ProviderService & { distanceKm: number }> {
  const query = (filters.searchQuery || '').trim().toLowerCase();
  const onlyAvailable = filters.onlyAvailable !== false;
  const userLat = filters.userLat ?? -25.9692;
  const userLng = filters.userLng ?? 32.5732;

  const enriched = services
    .filter((svc) => {
      if (!svc.isActive) return false;
      if (onlyAvailable && !svc.providerAvailable) return false;

      if (filters.categoryId && filters.categoryId !== 'all' && svc.categoryId !== filters.categoryId) {
        return false;
      }

      if (
        filters.city &&
        filters.city !== 'all' &&
        svc.city.toLowerCase() !== filters.city.trim().toLowerCase()
      ) {
        return false;
      }

      if (
        typeof filters.minPriceMzn === 'number' &&
        svc.pricingModel !== 'consultation' &&
        svc.basePriceMzn < filters.minPriceMzn
      ) {
        return false;
      }

      if (
        typeof filters.maxPriceMzn === 'number' &&
        svc.pricingModel !== 'consultation' &&
        svc.basePriceMzn > filters.maxPriceMzn
      ) {
        return false;
      }

      if (typeof filters.minRating === 'number' && filters.minRating > 0) {
        if (svc.providerRating < filters.minRating) return false;
      }

      if (query) {
        const haystack = [
          svc.title,
          svc.description,
          svc.categoryName,
          svc.providerName,
          svc.city,
          svc.neighborhood,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    })
    .map((svc) => ({
      ...svc,
      distanceKm: calculateDistanceKm(userLat, userLng, svc.lat, svc.lng),
    }));

  const sortBy = filters.sortBy || 'rating';
  enriched.sort((a, b) => {
    switch (sortBy) {
      case 'distance':
        return a.distanceKm - b.distanceKm;
      case 'price_asc': {
        const pa = a.pricingModel === 'consultation' ? Number.MAX_SAFE_INTEGER : a.basePriceMzn;
        const pb = b.pricingModel === 'consultation' ? Number.MAX_SAFE_INTEGER : b.basePriceMzn;
        return pa - pb;
      }
      case 'price_desc': {
        const pa = a.pricingModel === 'consultation' ? -1 : a.basePriceMzn;
        const pb = b.pricingModel === 'consultation' ? -1 : b.basePriceMzn;
        return pb - pa;
      }
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'rating':
      default:
        if (b.providerRating !== a.providerRating) {
          return b.providerRating - a.providerRating;
        }
        return a.distanceKm - b.distanceKm;
    }
  });

  return enriched;
}

export const REQUEST_STATUS_LABELS_PT: Record<RequestStatus, string> = {
  pending: 'Pendente',
  accepted: 'Aceite',
  rejected: 'Rejeitado',
  confirmed: 'Confirmado',
  in_progress: 'Em Curso',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const PRICING_MODEL_LABELS_PT: Record<PricingModel, string> = {
  fixed: 'Preço fixo',
  starting_from: 'A partir de',
  consultation: 'Sob consulta',
};

export const LOCATION_MODE_LABELS_PT: Record<ServiceLocationMode, string> = {
  provider_location: 'No local do prestador',
  customer_location: 'Ao domicílio do cliente',
  both: 'Local do prestador ou domicílio',
};
