export type AccountMode = 'customer' | 'provider';

export type UserRole = 'customer' | 'provider' | 'admin';

export type AvailabilityStatus = 'available' | 'unavailable' | 'paused';

export type PricingModel = 'fixed' | 'starting_from' | 'consultation';

export type ServiceLocationMode = 'provider_location' | 'customer_location' | 'both';

export type RequestLocationMode = 'provider_location' | 'customer_location';

export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type SortByOption = 'distance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';

export interface NotificationPreferences {
  inApp: boolean;
  browserPush: boolean;
  bookingUpdates: boolean;
  reviewsAndPromos: boolean;
}

export interface PrivacyPreferences {
  showNeighborhoodPublicly: boolean;
  allowDistanceCalculation: boolean;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  city: string;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  roles: UserRole[];
  activeMode: AccountMode;
  isAccountVerified: boolean;
  isSuspended: boolean;
  language: 'pt-MZ' | 'en';
  notificationPrefs: NotificationPreferences;
  privacyPrefs: PrivacyPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfile {
  providerId: string;
  displayName: string;
  businessName: string;
  avatarUrl: string;
  bio: string;
  city: string;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  availabilityStatus: AvailabilityStatus;
  pauseReason?: string;
  isVerified: boolean;
  isSuspended: boolean;
  averageRating: number;
  reviewCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  namePt: string;
  nameEn: string;
  descriptionPt: string;
  iconName: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ProviderService {
  id: string;
  providerId: string;
  providerName: string;
  providerAvatar: string;
  providerVerified: boolean;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  durationMinutes: number;
  pricingModel: PricingModel;
  basePriceMzn: number;
  transportFeeMzn: number;
  freeTransportRadiusKm: number;
  extraKmRateMzn: number;
  serviceLocationMode: ServiceLocationMode;
  imageUrl: string;
  isActive: boolean;
  providerAvailable: boolean;
  providerAvailabilityStatus: AvailabilityStatus;
  providerRating: number;
  providerReviewCount: number;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
}

export interface PricingBreakdown {
  pricingModel: PricingModel;
  locationMode: RequestLocationMode;
  distanceKm: number;
  servicePriceMzn: number;
  transportFeeMzn: number;
  freeRadiusApplied: boolean;
  extraKmCharged: number;
  estimatedTotalMzn: number;
  isConsultation: boolean;
}

export interface ServiceRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  providerId: string;
  providerName: string;
  serviceId: string;
  serviceTitle: string;
  pricingModel: PricingModel;
  preferredDate: string;
  preferredTime: string;
  locationMode: RequestLocationMode;
  customerCity: string;
  customerNeighborhood: string;
  customerAddress: string;
  customerLat: number;
  customerLng: number;
  distanceKm: number;
  servicePriceMzn: number;
  transportFeeMzn: number;
  estimatedTotalMzn: number;
  specialInstructions: string;
  status: RequestStatus;
  hasReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RequestStatusHistoryItem {
  id: string;
  requestId: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  changedByUid: string;
  changedByName: string;
  changedByRole: UserRole;
  note: string;
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  requestId: string;
  providerId: string;
  providerName: string;
  customerId: string;
  customerName: string;
  serviceId: string;
  serviceTitle: string;
  rating: number;
  comment: string;
  photoUrl?: string;
  isModeratedHidden: boolean;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  recipientUid: string;
  type:
    | 'request_created'
    | 'request_accepted'
    | 'request_rejected'
    | 'request_confirmed'
    | 'request_in_progress'
    | 'request_completed'
    | 'request_cancelled'
    | 'review_created'
    | 'provider_verified'
    | 'account_update';
  title: string;
  body: string;
  relatedRequestId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface PortfolioItem {
  id: string;
  providerId: string;
  title: string;
  categoryName: string;
  imageUrl: string;
  createdAt: string;
}

export interface ContentReport {
  id: string;
  reporterUid: string;
  reporterName: string;
  targetType: 'review' | 'provider' | 'service';
  targetId: string;
  targetLabel: string;
  reason: string;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSettings {
  platformName: string;
  defaultCurrency: string;
  defaultCountryCode: string;
  defaultLanguage: 'pt-MZ' | 'en';
  requireProviderVerification: boolean;
  commissionPercent: number;
  supportPhone: string;
  supportEmail: string;
  updatedAt: string;
}

export interface PlatformAnalytics {
  totalUsers: number;
  totalCustomers: number;
  totalProviders: number;
  activeProviders: number;
  availableProviders: number;
  verifiedProviders: number;
  totalServices: number;
  activeServices: number;
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  averageProviderRating: number;
  openReports: number;
}
