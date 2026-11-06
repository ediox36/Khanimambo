import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { firebaseAuth, googleProvider, verifyFirestoreConnection } from '../lib/firebase';
import { findNearestMozCity, resolveLocationCoords } from '../data/mozambiqueLocations';
import { calculateDistanceKm, filterAndSortServices } from '../utils/marketplaceLogic';
import type {
  AccountMode,
  AvailabilityStatus,
  ContentReport,
  NotificationItem,
  PlatformAnalytics,
  PlatformSettings,
  PortfolioItem,
  PricingModel,
  ProviderProfile,
  ProviderService,
  RequestLocationMode,
  RequestStatus,
  RequestStatusHistoryItem,
  ReviewItem,
  ServiceCategory,
  ServiceLocationMode,
  ServiceRequest,
  SortByOption,
  UserProfile,
} from '../types/marketplace';

export type ActiveTab =
  | 'home'
  | 'explore'
  | 'requests'
  | 'provider_dashboard'
  | 'notifications'
  | 'settings'
  | 'admin';

export interface AdminOverviewData {
  analytics: PlatformAnalytics;
  users: UserProfile[];
  providers: ProviderProfile[];
  categories: ServiceCategory[];
  services: ProviderService[];
  requests: ServiceRequest[];
  reviews: ReviewItem[];
  reports: ContentReport[];
  settings: PlatformSettings;
}

interface MarketplaceContextValue {
  // Navigation & Modals
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  authModalOpen: boolean;
  authModalInitialMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  needsGoogleOnboarding: boolean;
  setNeedsGoogleOnboarding: (val: boolean) => void;

  selectedProviderId: string | null;
  openProviderProfile: (providerId: string) => void;
  closeProviderProfile: () => void;

  bookingService: ProviderService | null;
  openBookingModal: (service: ProviderService) => void;
  closeBookingModal: () => void;

  // Platform config & quota
  googleMapsApiKey: string;
  gmpQuotaExceeded: boolean;
  markGmpQuotaExceeded: () => void;
  isLoading: boolean;
  toastBanner: { type: 'success' | 'error' | 'info'; message: string } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

  // Marketplace Data
  categories: ServiceCategory[];
  providers: ProviderProfile[];
  services: ProviderService[];
  portfolios: PortfolioItem[];
  reviews: ReviewItem[];
  settings: PlatformSettings;

  // Search & Discovery Filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  minPriceMzn: string;
  setMinPriceMzn: (val: string) => void;
  maxPriceMzn: string;
  setMaxPriceMzn: (val: string) => void;
  minRating: number;
  setMinRating: (val: number) => void;
  onlyAvailable: boolean;
  setOnlyAvailable: (val: boolean) => void;
  sortBy: SortByOption;
  setSortBy: (val: SortByOption) => void;
  userCoords: { lat: number; lng: number; city: string; neighborhood: string };
  setUserLocationByCity: (city: string, neighborhood?: string) => void;
  detectGpsLocation: () => Promise<void>;
  isDetectingGps: boolean;
  resetDiscoveryFilters: () => void;
  filteredServices: Array<ProviderService & { distanceKm: number }>;

  // Auth & User State
  token: string | null;
  currentUser: UserProfile | null;
  currentProvider: ProviderProfile | null;
  requests: ServiceRequest[];
  requestHistory: RequestStatusHistoryItem[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  adminData: AdminOverviewData | null;

  // Auth Actions
  sendVerificationCode: (identifier: string) => Promise<{ verificationCodePreview?: string }>;
  verifyCode: (identifier: string, code: string) => Promise<void>;
  registerAccount: (payload: Record<string, unknown>) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsDemo: (role: 'customer' | 'provider' | 'admin') => Promise<void>;
  logout: () => Promise<void>;

  // Account & Role Switching Actions
  updateAccountProfile: (payload: Record<string, unknown>) => Promise<void>;
  switchOrConfigureRole: (payload: {
    targetMode?: AccountMode;
    enableProviderRole?: boolean;
    disableProviderRole?: boolean;
    businessName?: string;
    bio?: string;
    city?: string;
    neighborhood?: string;
    address?: string;
    phone?: string;
  }) => Promise<void>;
  deactivateOrDeleteAccount: (mode: 'deactivate' | 'delete') => Promise<void>;

  // Provider Actions
  updateAvailability: (status: AvailabilityStatus, pauseReason?: string) => Promise<void>;
  createService: (payload: {
    title: string;
    categoryId: string;
    description: string;
    durationMinutes: number;
    pricingModel: PricingModel;
    basePriceMzn: number;
    transportFeeMzn: number;
    freeTransportRadiusKm: number;
    extraKmRateMzn: number;
    serviceLocationMode: ServiceLocationMode;
    imageUrl?: string;
  }) => Promise<void>;
  updateService: (serviceId: string, payload: Partial<ProviderService>) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  addPortfolioItem: (payload: { title: string; categoryName: string; imageUrl: string }) => Promise<void>;
  deletePortfolioItem: (itemId: string) => Promise<void>;

  // Requests & Reviews Actions
  createServiceRequest: (payload: {
    serviceId: string;
    preferredDate: string;
    preferredTime: string;
    locationMode: RequestLocationMode;
    customerCity: string;
    customerNeighborhood: string;
    customerAddress: string;
    customerLat?: number;
    customerLng?: number;
    specialInstructions?: string;
  }) => Promise<ServiceRequest>;
  updateRequestStatus: (requestId: string, status: RequestStatus, note?: string) => Promise<void>;
  submitReview: (payload: {
    requestId: string;
    rating: number;
    comment: string;
    photoUrl?: string;
  }) => Promise<void>;
  submitReport: (payload: {
    targetType: 'review' | 'provider' | 'service';
    targetId: string;
    targetLabel: string;
    reason: string;
    details?: string;
  }) => Promise<void>;

  // Notifications
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  requestBrowserNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;

  // Admin Actions
  refreshAdminOverview: () => Promise<void>;
  adminVerifyProvider: (providerId: string, isVerified?: boolean) => Promise<void>;
  adminSuspendUser: (uid: string, isSuspended?: boolean) => Promise<void>;
  adminCreateCategory: (payload: {
    namePt: string;
    nameEn?: string;
    descriptionPt?: string;
  }) => Promise<void>;
  adminToggleCategory: (categoryId: string, isActive: boolean) => Promise<void>;
  adminModerateReview: (reviewId: string, isModeratedHidden?: boolean) => Promise<void>;
  adminUpdateReport: (
    reportId: string,
    status: ContentReport['status'],
    adminNotes?: string
  ) => Promise<void>;
  adminUpdateSettings: (payload: Partial<PlatformSettings>) => Promise<void>;

  refreshMarketplace: () => Promise<void>;
}

const TOKEN_STORAGE_KEY = 'kanimambo_session_token_v1';

const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: 'Kanimambo',
  defaultCurrency: 'MZN',
  defaultCountryCode: '+258',
  defaultLanguage: 'pt-MZ',
  requireProviderVerification: true,
  commissionPercent: 8,
  supportPhone: '+258 84 300 9000',
  supportEmail: 'suporte@kanimambo.co.mz',
  updatedAt: new Date().toISOString(),
};

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'register'>('login');
  const [needsGoogleOnboarding, setNeedsGoogleOnboarding] = useState(false);

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [bookingService, setBookingService] = useState<ProviderService | null>(null);

  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastBanner, setToastBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [minPriceMzn, setMinPriceMzn] = useState('');
  const [maxPriceMzn, setMaxPriceMzn] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [sortBy, setSortBy] = useState<SortByOption>('rating');
  const [userCoords, setUserCoords] = useState({
    lat: -25.9665,
    lng: 32.592,
    city: 'Maputo',
    neighborhood: 'Polana Cimento',
  });
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  // User Session
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentProvider, setCurrentProvider] = useState<ProviderProfile | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [requestHistory, setRequestHistory] = useState<RequestStatusHistoryItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [adminData, setAdminData] = useState<AdminOverviewData | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToastBanner({ message, type });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToastBanner(null);
      }, 4800);
    },
    []
  );

  const markGmpQuotaExceeded = useCallback(() => {
    setGmpQuotaExceeded(true);
  }, []);

  useEffect(() => {
    const onQuotaEvent = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaEvent);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaEvent);
  }, []);

  const apiFetch = useCallback(
    async <T,>(url: string, options?: RequestInit, overrideToken?: string | null): Promise<T> => {
      const activeToken = overrideToken !== undefined ? overrideToken : tokenRef.current;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options?.headers as Record<string, string>) || {}),
      };
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Erro HTTP ${res.status}`);
      }
      return data as T;
    },
    []
  );

  const refreshMarketplace = useCallback(async () => {
    const data = await apiFetch<{
      categories: ServiceCategory[];
      providers: ProviderProfile[];
      services: ProviderService[];
      portfolios: PortfolioItem[];
      reviews: ReviewItem[];
      settings: PlatformSettings;
    }>('/api/marketplace/bootstrap', undefined, null);

    setCategories(data.categories);
    setProviders(data.providers);
    setServices(data.services);
    setPortfolios(data.portfolios);
    setReviews(data.reviews);
    setSettings(data.settings);
  }, [apiFetch]);

  const refreshUserWorkspaceData = useCallback(
    async (activeToken: string | null) => {
      if (!activeToken) {
        setCurrentUser(null);
        setCurrentProvider(null);
        setRequests([]);
        setRequestHistory([]);
        setNotifications([]);
        setAdminData(null);
        return;
      }

      try {
        const me = await apiFetch<{ user: UserProfile; provider: ProviderProfile | null }>(
          '/api/auth/me',
          undefined,
          activeToken
        );
        setCurrentUser(me.user);
        setCurrentProvider(me.provider);
        setUserCoords({
          lat: me.user.lat,
          lng: me.user.lng,
          city: me.user.city,
          neighborhood: me.user.neighborhood,
        });

        const [reqData, notifData] = await Promise.all([
          apiFetch<{ requests: ServiceRequest[]; history: RequestStatusHistoryItem[] }>(
            '/api/requests',
            undefined,
            activeToken
          ),
          apiFetch<{ notifications: NotificationItem[] }>('/api/notifications', undefined, activeToken),
        ]);
        setRequests(reqData.requests);
        setRequestHistory(reqData.history);
        setNotifications(notifData.notifications);

        if (me.user.roles.includes('admin')) {
          const ov = await apiFetch<AdminOverviewData>('/api/admin/overview', undefined, activeToken);
          setAdminData(ov);
        } else {
          setAdminData(null);
        }
      } catch {
        // Clear stale token
        try {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          // ignore
        }
        tokenRef.current = null;
        setToken(null);
        setCurrentUser(null);
        setCurrentProvider(null);
        setRequests([]);
        setRequestHistory([]);
        setNotifications([]);
        setAdminData(null);
      }
    },
    [apiFetch]
  );

  // Initial load once on mount
  useEffect(() => {
    let mounted = true;
    verifyFirestoreConnection().catch(() => {});
    (async () => {
      try {
        const [pubCfg] = await Promise.all([
          apiFetch<{ googleMapsApiKey?: string }>('/api/public-config', undefined, null),
          refreshMarketplace(),
        ]);
        if (mounted && pubCfg.googleMapsApiKey) {
          setGoogleMapsApiKey(pubCfg.googleMapsApiKey);
        }
        if (mounted && tokenRef.current) {
          await refreshUserWorkspaceData(tokenRef.current);
        }
      } catch (err) {
        console.error('Bootstrap error:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiFetch, refreshMarketplace, refreshUserWorkspaceData]);

  const currentUid = currentUser?.uid || null;
  const browserPushEnabledRef = useRef<boolean>(false);
  browserPushEnabledRef.current = Boolean(currentUser?.notificationPrefs.browserPush);

  // Real-time WebSocket connection (/ws)
  useEffect(() => {
    if (!token || !currentUid) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
    let ws: WebSocket | null = null;
    let closedByCleanup = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closedByCleanup) return;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as { event?: string; payload?: unknown };
          if (msg.event === 'notification:new' && msg.payload) {
            const notif = msg.payload as NotificationItem;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === notif.id)) return prev;
              return [notif, ...prev];
            });
            showToast(notif.title, 'info');
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              window.Notification.permission === 'granted' &&
              browserPushEnabledRef.current
            ) {
              try {
                new window.Notification(notif.title, { body: notif.body });
              } catch {
                // ignore if blocked by iframe sandbox
              }
            }
          } else if (msg.event === 'request:updated' && msg.payload) {
            const { request, historyEntry } = msg.payload as {
              request?: ServiceRequest;
              historyEntry?: RequestStatusHistoryItem;
            };
            if (request) {
              setRequests((prev) => {
                const exists = prev.some((r) => r.id === request.id);
                return exists
                  ? prev.map((r) => (r.id === request.id ? request : r))
                  : [request, ...prev];
              });
            }
            if (historyEntry) {
              setRequestHistory((prev) => {
                if (prev.some((h) => h.id === historyEntry.id)) return prev;
                return [...prev, historyEntry];
              });
            }
          } else if (msg.event === 'marketplace:updated') {
            refreshMarketplace().catch(() => {});
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (!closedByCleanup) {
          reconnectTimer = window.setTimeout(connect, 4000);
        }
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [token, currentUid, refreshMarketplace, showToast]);

  const commitSession = useCallback(
    async (nextToken: string, user: UserProfile, provider: ProviderProfile | null) => {
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      } catch {
        // ignore
      }
      setToken(nextToken);
      setCurrentUser(user);
      setCurrentProvider(provider);
      setUserCoords({
        lat: user.lat,
        lng: user.lng,
        city: user.city,
        neighborhood: user.neighborhood,
      });
      await refreshUserWorkspaceData(nextToken);
    },
    [refreshUserWorkspaceData]
  );

  const openAuthModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthModalInitialMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const openProviderProfile = useCallback((providerId: string) => {
    setSelectedProviderId(providerId);
  }, []);

  const closeProviderProfile = useCallback(() => {
    setSelectedProviderId(null);
  }, []);

  const openBookingModal = useCallback(
    (service: ProviderService) => {
      if (!currentUser) {
        openAuthModal('login');
        showToast('Inicie sessão ou crie uma conta para solicitar este serviço.', 'info');
        return;
      }
      if (service.providerId === currentUser.uid) {
        showToast('Não pode solicitar o seu próprio serviço.', 'error');
        return;
      }
      if (!service.providerAvailable) {
        showToast('Este prestador está actualmente indisponível para novos pedidos.', 'error');
        return;
      }
      setBookingService(service);
    },
    [currentUser, openAuthModal, showToast]
  );

  const closeBookingModal = useCallback(() => {
    setBookingService(null);
  }, []);

  const setUserLocationByCity = useCallback((city: string, neighborhood?: string) => {
    const coords = resolveLocationCoords(city, neighborhood);
    setUserCoords({
      lat: coords.lat,
      lng: coords.lng,
      city,
      neighborhood: neighborhood || '',
    });
  }, []);

  const detectGpsLocation = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      showToast('Geolocalização não suportada neste navegador. Seleccione a cidade.', 'error');
      return;
    }
    setIsDetectingGps(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
        });
      });
      const nearest = findNearestMozCity(pos.coords.latitude, pos.coords.longitude);
      setUserCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        city: nearest.city,
        neighborhood: nearest.neighborhood,
      });
      setSelectedCity(nearest.city);
      setSortBy('distance');
      showToast(`Localização detectada: ${nearest.neighborhood}, ${nearest.city}`, 'success');
    } catch {
      // Fallback gracefully to Polana Cimento, Maputo if permission denied in headless browser
      const fallback = resolveLocationCoords('Maputo', 'Polana Cimento');
      setUserCoords({
        lat: fallback.lat,
        lng: fallback.lng,
        city: 'Maputo',
        neighborhood: 'Polana Cimento',
      });
      setSelectedCity('Maputo');
      setSortBy('distance');
      showToast('Localização definida para Maputo (Polana Cimento).', 'info');
    } finally {
      setIsDetectingGps(false);
    }
  }, [showToast]);

  const resetDiscoveryFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategoryId('all');
    setSelectedCity('all');
    setMinPriceMzn('');
    setMaxPriceMzn('');
    setMinRating(0);
    setOnlyAvailable(true);
    setSortBy('rating');
  }, []);

  const filteredServices = useMemo(() => {
    const minP = minPriceMzn.trim() !== '' && !Number.isNaN(Number(minPriceMzn)) ? Number(minPriceMzn) : null;
    const maxP = maxPriceMzn.trim() !== '' && !Number.isNaN(Number(maxPriceMzn)) ? Number(maxPriceMzn) : null;
    return filterAndSortServices(services, {
      searchQuery,
      categoryId: selectedCategoryId,
      city: selectedCity,
      minPriceMzn: minP,
      maxPriceMzn: maxP,
      minRating: minRating > 0 ? minRating : null,
      onlyAvailable,
      sortBy,
      userLat: userCoords.lat,
      userLng: userCoords.lng,
    });
  }, [
    services,
    searchQuery,
    selectedCategoryId,
    selectedCity,
    minPriceMzn,
    maxPriceMzn,
    minRating,
    onlyAvailable,
    sortBy,
    userCoords.lat,
    userCoords.lng,
  ]);

  const sendVerificationCode = useCallback(
    async (identifier: string) => {
      return apiFetch<{ verificationCodePreview?: string }>('/api/auth/send-verification', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      });
    },
    [apiFetch]
  );

  const verifyCode = useCallback(
    async (identifier: string, code: string) => {
      await apiFetch('/api/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ identifier, code }),
      });
    },
    [apiFetch]
  );

  const registerAccount = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await apiFetch<{
        token: string;
        user: UserProfile;
        provider: ProviderProfile | null;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await commitSession(res.token, res.user, res.provider);
      await refreshMarketplace();
      setAuthModalOpen(false);
      if (res.user.activeMode === 'provider') {
        setActiveTab('provider_dashboard');
      }
      showToast('Conta criada e verificada com sucesso!', 'success');
    },
    [apiFetch, commitSession, refreshMarketplace, showToast]
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{
        token: string;
        user: UserProfile;
        provider: ProviderProfile | null;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await commitSession(res.token, res.user, res.provider);
      setAuthModalOpen(false);
      if (res.user.roles.includes('admin')) {
        setActiveTab('admin');
      } else if (res.user.activeMode === 'provider') {
        setActiveTab('provider_dashboard');
      }
      showToast(`Bem-vindo de volta, ${res.user.fullName}!`, 'success');
    },
    [apiFetch, commitSession, showToast]
  );

  const loginWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const idToken = await result.user.getIdToken();
    const res = await apiFetch<{
      token: string;
      user: UserProfile;
      provider: ProviderProfile | null;
      needsOnboarding?: boolean;
    }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    await commitSession(res.token, res.user, res.provider);
    setAuthModalOpen(false);
    if (res.needsOnboarding) {
      setNeedsGoogleOnboarding(true);
    }
    showToast(`Sessão iniciada como ${res.user.fullName}`, 'success');
  }, [apiFetch, commitSession, showToast]);

  const loginAsDemo = useCallback(
    async (role: 'customer' | 'provider' | 'admin') => {
      const res = await apiFetch<{
        token: string;
        user: UserProfile;
        provider: ProviderProfile | null;
      }>('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      await commitSession(res.token, res.user, res.provider);
      setAuthModalOpen(false);
      if (role === 'admin') {
        setActiveTab('admin');
      } else if (role === 'provider') {
        setActiveTab('provider_dashboard');
      } else {
        setActiveTab('home');
      }
      showToast(`Sessão iniciada: ${res.user.fullName}`, 'success');
    },
    [apiFetch, commitSession, showToast]
  );

  const logout = useCallback(async () => {
    try {
      await signOut(firebaseAuth);
    } catch {
      // ignore if local session only
    }
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    setToken(null);
    setCurrentUser(null);
    setCurrentProvider(null);
    setRequests([]);
    setRequestHistory([]);
    setNotifications([]);
    setAdminData(null);
    setActiveTab('home');
    showToast('Sessão terminada.', 'info');
  }, [showToast]);

  const updateAccountProfile = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await apiFetch<{ user: UserProfile; provider: ProviderProfile | null }>(
        '/api/account/profile',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );
      setCurrentUser(res.user);
      setCurrentProvider(res.provider);
      setUserCoords({
        lat: res.user.lat,
        lng: res.user.lng,
        city: res.user.city,
        neighborhood: res.user.neighborhood,
      });
      await refreshMarketplace();
      showToast('Definições da conta actualizadas.', 'success');
    },
    [apiFetch, refreshMarketplace, showToast]
  );

  const switchOrConfigureRole = useCallback(
    async (payload: {
      targetMode?: AccountMode;
      enableProviderRole?: boolean;
      disableProviderRole?: boolean;
      businessName?: string;
      bio?: string;
      city?: string;
      neighborhood?: string;
      address?: string;
      phone?: string;
    }) => {
      const res = await apiFetch<{ user: UserProfile; provider: ProviderProfile | null }>(
        '/api/account/role',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setCurrentUser(res.user);
      setCurrentProvider(res.provider);
      await refreshMarketplace();
      if (res.user.activeMode === 'provider') {
        setActiveTab('provider_dashboard');
        showToast('Modo Prestador activado!', 'success');
      } else {
        if (activeTab === 'provider_dashboard') {
          setActiveTab('home');
        }
        showToast('Modo Cliente activado!', 'success');
      }
    },
    [activeTab, apiFetch, refreshMarketplace, showToast]
  );

  const deactivateOrDeleteAccount = useCallback(
    async (mode: 'deactivate' | 'delete') => {
      await apiFetch(`/api/account?mode=${mode}`, { method: 'DELETE' });
      await logout();
      await refreshMarketplace();
    },
    [apiFetch, logout, refreshMarketplace]
  );

  const updateAvailability = useCallback(
    async (availabilityStatus: AvailabilityStatus, pauseReason?: string) => {
      const res = await apiFetch<{ provider: ProviderProfile }>('/api/provider/availability', {
        method: 'PATCH',
        body: JSON.stringify({ availabilityStatus, pauseReason }),
      });
      setCurrentProvider(res.provider);
      await refreshMarketplace();
      const labelMap: Record<AvailabilityStatus, string> = {
        available: 'Disponível para receber pedidos',
        paused: 'Disponibilidade pausada temporariamente',
        unavailable: 'Indisponível — oculto das pesquisas de disponibilidade',
      };
      showToast(labelMap[availabilityStatus], 'success');
    },
    [apiFetch, refreshMarketplace, showToast]
  );

  const createService = useCallback(
    async (payload: {
      title: string;
      categoryId: string;
      description: string;
      durationMinutes: number;
      pricingModel: PricingModel;
      basePriceMzn: number;
      transportFeeMzn: number;
      freeTransportRadiusKm: number;
      extraKmRateMzn: number;
      serviceLocationMode: ServiceLocationMode;
      imageUrl?: string;
    }) => {
      await apiFetch('/api/provider/services', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await refreshMarketplace();
      showToast('Serviço publicado com sucesso!', 'success');
    },
    [apiFetch, refreshMarketplace, showToast]
  );

  const updateService = useCallback(
    async (serviceId: string, payload: Partial<ProviderService>) => {
      await apiFetch(`/api/provider/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refreshMarketplace();
      showToast('Serviço actualizado.', 'success');
    },
    [apiFetch, refreshMarketplace, showToast]
  );

  const deleteService = useCallback(
    async (serviceId: string) => {
      await apiFetch(`/api/provider/services/${serviceId}`, { method: 'DELETE' });
      await refreshMarketplace();
      showToast('Serviço eliminado.', 'info');
    },
    [apiFetch, refreshMarketplace, showToast]
  );

  const addPortfolioItem = useCallback(
    async (payload: { title: string; categoryName: string; imageUrl: string }) => {
      await apiFetch('/api/provider/portfolio', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await refreshMarketplace();
      showToast('Foto adicionada ao portfólio.', 'success');
    },
    [apiFetch, refreshMarketplace, showToast]
  );

  const deletePortfolioItem = useCallback(
    async (itemId: string) => {
      await apiFetch(`/api/provider/portfolio/${itemId}`, { method: 'DELETE' });
      await refreshMarketplace();
      showToast('Foto removida do portfólio.', 'info');
    },
    [apiFetch, refreshMarketplace, showToast]
  );

  const createServiceRequest = useCallback(
    async (payload: {
      serviceId: string;
      preferredDate: string;
      preferredTime: string;
      locationMode: RequestLocationMode;
      customerCity: string;
      customerNeighborhood: string;
      customerAddress: string;
      customerLat?: number;
      customerLng?: number;
      specialInstructions?: string;
    }) => {
      const res = await apiFetch<{
        request: ServiceRequest;
        historyEntry: RequestStatusHistoryItem;
      }>('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setRequests((prev) => {
        if (prev.some((r) => r.id === res.request.id)) return prev;
        return [res.request, ...prev];
      });
      setRequestHistory((prev) => {
        if (prev.some((h) => h.id === res.historyEntry.id)) return prev;
        return [...prev, res.historyEntry];
      });
      setBookingService(null);
      setActiveTab('requests');
      showToast('Pedido de serviço enviado ao prestador!', 'success');
      return res.request;
    },
    [apiFetch, showToast]
  );

  const updateRequestStatus = useCallback(
    async (requestId: string, status: RequestStatus, note?: string) => {
      const res = await apiFetch<{
        request: ServiceRequest;
        historyEntry: RequestStatusHistoryItem;
      }>(`/api/requests/${requestId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      });
      setRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
      setRequestHistory((prev) => {
        if (prev.some((h) => h.id === res.historyEntry.id)) return prev;
        return [...prev, res.historyEntry];
      });
      await refreshMarketplace();
      showToast('Estado do pedido actualizado.', 'success');
    },
    [apiFetch, refreshMarketplace, showToast]
  );

  const submitReview = useCallback(
    async (payload: {
      requestId: string;
      rating: number;
      comment: string;
      photoUrl?: string;
    }) => {
      const res = await apiFetch<{ review: ReviewItem; provider: ProviderProfile | null }>(
        '/api/reviews',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setRequests((prev) =>
        prev.map((r) => (r.id === payload.requestId ? { ...r, hasReview: true } : r))
      );
      await refreshMarketplace();
      if (res.provider && currentProvider?.providerId === res.provider.providerId) {
        setCurrentProvider(res.provider);
      }
      showToast('Obrigado pela sua avaliação!', 'success');
    },
    [apiFetch, currentProvider?.providerId, refreshMarketplace, showToast]
  );

  const submitReport = useCallback(
    async (payload: {
      targetType: 'review' | 'provider' | 'service';
      targetId: string;
      targetLabel: string;
      reason: string;
      details?: string;
    }) => {
      if (!currentUser) {
        openAuthModal('login');
        return;
      }
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Denúncia registada para análise da equipa Kanimambo.', 'success');
    },
    [apiFetch, currentUser, openAuthModal, showToast]
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      await apiFetch(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
    },
    [apiFetch]
  );

  const markAllNotificationsRead = useCallback(async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    showToast('Todas as notificações marcadas como lidas.', 'info');
  }, [apiFetch, showToast]);

  const requestBrowserNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Notificações do navegador não suportadas neste dispositivo.', 'info');
      return 'unsupported' as const;
    }
    const perm = await window.Notification.requestPermission();
    if (perm === 'granted') {
      showToast('Notificações em tempo real no navegador activadas!', 'success');
    } else {
      showToast('Permissão de notificações do navegador não concedida.', 'info');
    }
    return perm;
  }, [showToast]);

  const refreshAdminOverview = useCallback(async () => {
    if (!currentUser?.roles.includes('admin')) return;
    const ov = await apiFetch<AdminOverviewData>('/api/admin/overview');
    setAdminData(ov);
  }, [apiFetch, currentUser]);

  const adminVerifyProvider = useCallback(
    async (providerId: string, isVerified?: boolean) => {
      await apiFetch(`/api/admin/providers/${providerId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ isVerified }),
      });
      await Promise.all([refreshAdminOverview(), refreshMarketplace()]);
      showToast('Estado de verificação do prestador actualizado.', 'success');
    },
    [apiFetch, refreshAdminOverview, refreshMarketplace, showToast]
  );

  const adminSuspendUser = useCallback(
    async (uid: string, isSuspended?: boolean) => {
      await apiFetch(`/api/admin/users/${uid}/suspend`, {
        method: 'PATCH',
        body: JSON.stringify({ isSuspended }),
      });
      await Promise.all([refreshAdminOverview(), refreshMarketplace()]);
      showToast('Estado da conta actualizado.', 'success');
    },
    [apiFetch, refreshAdminOverview, refreshMarketplace, showToast]
  );

  const adminCreateCategory = useCallback(
    async (payload: { namePt: string; nameEn?: string; descriptionPt?: string }) => {
      await apiFetch('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await Promise.all([refreshAdminOverview(), refreshMarketplace()]);
      showToast('Categoria adicionada.', 'success');
    },
    [apiFetch, refreshAdminOverview, refreshMarketplace, showToast]
  );

  const adminToggleCategory = useCallback(
    async (categoryId: string, isActive: boolean) => {
      await apiFetch(`/api/admin/categories/${categoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      await Promise.all([refreshAdminOverview(), refreshMarketplace()]);
      showToast('Categoria actualizada.', 'info');
    },
    [apiFetch, refreshAdminOverview, refreshMarketplace, showToast]
  );

  const adminModerateReview = useCallback(
    async (reviewId: string, isModeratedHidden?: boolean) => {
      await apiFetch(`/api/admin/reviews/${reviewId}/moderate`, {
        method: 'PATCH',
        body: JSON.stringify({ isModeratedHidden }),
      });
      await Promise.all([refreshAdminOverview(), refreshMarketplace()]);
      showToast('Moderação da avaliação aplicada.', 'success');
    },
    [apiFetch, refreshAdminOverview, refreshMarketplace, showToast]
  );

  const adminUpdateReport = useCallback(
    async (reportId: string, status: ContentReport['status'], adminNotes?: string) => {
      await apiFetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNotes }),
      });
      await refreshAdminOverview();
      showToast('Denúncia actualizada.', 'success');
    },
    [apiFetch, refreshAdminOverview, showToast]
  );

  const adminUpdateSettings = useCallback(
    async (payload: Partial<PlatformSettings>) => {
      const res = await apiFetch<{ settings: PlatformSettings }>('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSettings(res.settings);
      await refreshAdminOverview();
      showToast('Definições da plataforma guardadas.', 'success');
    },
    [apiFetch, refreshAdminOverview, showToast]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const value: MarketplaceContextValue = {
    activeTab,
    setActiveTab,
    authModalOpen,
    authModalInitialMode,
    openAuthModal,
    closeAuthModal,
    needsGoogleOnboarding,
    setNeedsGoogleOnboarding,
    selectedProviderId,
    openProviderProfile,
    closeProviderProfile,
    bookingService,
    openBookingModal,
    closeBookingModal,
    googleMapsApiKey,
    gmpQuotaExceeded,
    markGmpQuotaExceeded,
    isLoading,
    toastBanner,
    showToast,
    categories,
    providers,
    services,
    portfolios,
    reviews,
    settings,
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
    filteredServices,
    token,
    currentUser,
    currentProvider,
    requests,
    requestHistory,
    notifications,
    unreadNotificationsCount,
    adminData,
    sendVerificationCode,
    verifyCode,
    registerAccount,
    loginWithPassword,
    loginWithGoogle,
    loginAsDemo,
    logout,
    updateAccountProfile,
    switchOrConfigureRole,
    deactivateOrDeleteAccount,
    updateAvailability,
    createService,
    updateService,
    deleteService,
    addPortfolioItem,
    deletePortfolioItem,
    createServiceRequest,
    updateRequestStatus,
    submitReview,
    submitReport,
    markNotificationRead,
    markAllNotificationsRead,
    requestBrowserNotificationPermission,
    refreshAdminOverview,
    adminVerifyProvider,
    adminSuspendUser,
    adminCreateCategory,
    adminToggleCategory,
    adminModerateReview,
    adminUpdateReport,
    adminUpdateSettings,
    refreshMarketplace,
  };

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
};

export function useMarketplace(): MarketplaceContextValue {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) {
    throw new Error('useMarketplace must be used inside MarketplaceProvider');
  }
  return ctx;
}
