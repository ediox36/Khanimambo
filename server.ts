import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { WebSocket, WebSocketServer } from 'ws';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { resolveLocationCoords } from './src/data/mozambiqueLocations.ts';
import {
  SEED_CATEGORIES,
  SEED_IMAGE_PATHS,
  SEED_NOTIFICATIONS,
  SEED_PLATFORM_SETTINGS,
  SEED_PORTFOLIOS,
  SEED_PROVIDERS,
  SEED_REPORTS,
  SEED_REQUESTS,
  SEED_REQUEST_HISTORY,
  SEED_REVIEWS,
  SEED_SERVICES,
  SEED_USERS,
} from './src/data/seedMarketplaceData.ts';
import {
  calculateDistanceKm,
  calculatePricingBreakdown,
  canSubmitReview,
  canTransitionRequestStatus,
  computeProviderRatingStats,
  formatMzn,
  validateMozambiquePhone,
} from './src/utils/marketplaceLogic.ts';
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
  UserProfile,
  UserRole,
} from './src/types/marketplace.ts';

dotenv.config();

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const adminAuth = getAuth();

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`${firebaseConfig.projectId}:${firebaseConfig.appId}`).digest('hex');

interface PasswordSecretRecord {
  uid: string;
  email: string;
  salt: string;
  hash: string;
}

interface VerificationCodeRecord {
  code: string;
  expiresAt: number;
  verified: boolean;
}

interface MarketplaceDatabase {
  users: UserProfile[];
  secrets: PasswordSecretRecord[];
  providers: ProviderProfile[];
  categories: ServiceCategory[];
  services: ProviderService[];
  portfolios: PortfolioItem[];
  requests: ServiceRequest[];
  requestHistory: RequestStatusHistoryItem[];
  reviews: ReviewItem[];
  notifications: NotificationItem[];
  reports: ContentReport[];
  settings: PlatformSettings;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'marketplace_db.json');

function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function createInitialDb(): MarketplaceDatabase {
  const defaultPass = hashPassword('Kanimambo2026!');
  const secrets: PasswordSecretRecord[] = SEED_USERS.map((u) => ({
    uid: u.uid,
    email: u.email.toLowerCase(),
    salt: defaultPass.salt,
    hash: defaultPass.hash,
  }));

  return {
    users: structuredClone(SEED_USERS),
    secrets,
    providers: structuredClone(SEED_PROVIDERS),
    categories: structuredClone(SEED_CATEGORIES),
    services: structuredClone(SEED_SERVICES),
    portfolios: structuredClone(SEED_PORTFOLIOS),
    requests: structuredClone(SEED_REQUESTS),
    requestHistory: structuredClone(SEED_REQUEST_HISTORY),
    reviews: structuredClone(SEED_REVIEWS),
    notifications: structuredClone(SEED_NOTIFICATIONS),
    reports: structuredClone(SEED_REPORTS),
    settings: structuredClone(SEED_PLATFORM_SETTINGS),
  };
}

function loadDatabase(): MarketplaceDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = createInitialDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as MarketplaceDatabase;
    if (!parsed.users || !parsed.categories || !parsed.providers) {
      throw new Error('Corrupt DB structure');
    }
    return parsed;
  } catch (err) {
    console.warn('Initializing fresh marketplace database:', err);
    const initial = createInitialDb();
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    } catch {
      // Ignore disk write failure in read-only edge cases
    }
    return initial;
  }
}

let dbState: MarketplaceDatabase = loadDatabase();
const verificationCodes: Record<string, VerificationCodeRecord> = {};

function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
}

function signSessionToken(uid: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid, iat: Date.now(), exp: Date.now() + 1000 * 60 * 60 * 24 * 14 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `km_sess_${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  if (!token.startsWith('km_sess_')) return null;
  const rest = token.slice('km_sess_'.length);
  const parts = rest.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

// Real-time WebSocket client registry keyed by uid
const wsClientsByUid: Record<string, Set<WebSocket>> = {};

function sendWsToUser(uid: string, event: string, payload: unknown) {
  const sockets = wsClientsByUid[uid];
  if (!sockets || sockets.size === 0) return;
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

function broadcastWs(event: string, payload: unknown) {
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const uid of Object.keys(wsClientsByUid)) {
    const sockets = wsClientsByUid[uid];
    if (!sockets) continue;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

function pushNotification(params: {
  recipientUid: string;
  type: NotificationItem['type'];
  title: string;
  body: string;
  relatedRequestId?: string;
}): NotificationItem {
  const item: NotificationItem = {
    id: generateId('notif'),
    recipientUid: params.recipientUid,
    type: params.type,
    title: params.title,
    body: params.body,
    relatedRequestId: params.relatedRequestId,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  dbState.notifications.unshift(item);
  saveDatabase();
  sendWsToUser(params.recipientUid, 'notification:new', item);
  return item;
}

function syncProviderServicesMetadata(provider: ProviderProfile) {
  const isAvailable = provider.availabilityStatus === 'available' && !provider.isSuspended;
  for (const svc of dbState.services) {
    if (svc.providerId === provider.providerId) {
      svc.providerName = provider.businessName || provider.displayName;
      svc.providerAvatar = provider.avatarUrl;
      svc.providerVerified = provider.isVerified;
      svc.providerAvailable = isAvailable;
      svc.providerAvailabilityStatus = provider.availabilityStatus;
      svc.providerRating = provider.averageRating;
      svc.providerReviewCount = provider.reviewCount;
      svc.city = provider.city;
      svc.neighborhood = provider.neighborhood;
      svc.lat = provider.lat;
      svc.lng = provider.lng;
      svc.updatedAt = new Date().toISOString();
    }
  }
}

interface AuthedRequest extends express.Request {
  authUser?: UserProfile;
}

async function resolveAuthUser(token: string): Promise<UserProfile | null> {
  const localUid = verifySessionToken(token);
  if (localUid) {
    return dbState.users.find((u) => u.uid === localUid) || null;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    let user = dbState.users.find((u) => u.uid === decoded.uid);
    if (!user && decoded.email) {
      user = dbState.users.find((u) => u.email.toLowerCase() === decoded.email!.toLowerCase());
    }
    return user || null;
  } catch {
    return null;
  }
}

const requireAuth: express.RequestHandler = async (req: AuthedRequest, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão necessária. Por favor, inicie sessão.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const user = await resolveAuthUser(token);
  if (!user) {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return;
  }
  if (user.isSuspended) {
    res.status(403).json({ error: 'A sua conta encontra-se suspensa. Contacte o suporte.' });
    return;
  }
  req.authUser = user;
  next();
};

const requireAdmin: express.RequestHandler = (req: AuthedRequest, res, next) => {
  if (!req.authUser || !req.authUser.roles.includes('admin')) {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return;
  }
  next();
};

function computePlatformAnalytics(): PlatformAnalytics {
  const totalUsers = dbState.users.length;
  const totalCustomers = dbState.users.filter((u) => u.roles.includes('customer')).length;
  const totalProviders = dbState.providers.length;
  const activeProviders = dbState.providers.filter((p) => !p.isSuspended).length;
  const availableProviders = dbState.providers.filter(
    (p) => !p.isSuspended && p.availabilityStatus === 'available'
  ).length;
  const verifiedProviders = dbState.providers.filter((p) => p.isVerified && !p.isSuspended).length;
  const totalServices = dbState.services.length;
  const activeServices = dbState.services.filter((s) => s.isActive).length;
  const totalRequests = dbState.requests.length;
  const pendingRequests = dbState.requests.filter((r) => r.status === 'pending').length;
  const completedRequests = dbState.requests.filter((r) => r.status === 'completed').length;

  const ratedProviders = dbState.providers.filter((p) => p.reviewCount > 0);
  const averageProviderRating =
    ratedProviders.length > 0
      ? Math.round(
          (ratedProviders.reduce((acc, p) => acc + p.averageRating, 0) / ratedProviders.length) * 10
        ) / 10
      : 5.0;

  const openReports = dbState.reports.filter((r) => r.status === 'open').length;

  return {
    totalUsers,
    totalCustomers,
    totalProviders,
    activeProviders,
    availableProviders,
    verifiedProviders,
    totalServices,
    activeServices,
    totalRequests,
    pendingRequests,
    completedRequests,
    averageProviderRating,
    openReports,
  };
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  app.use(express.json({ limit: '4mb' }));

  // WebSocket upgrade handler on /ws
  server.on('upgrade', async (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname !== '/ws') {
      return;
    }
    const token = reqUrl.searchParams.get('token') || '';
    const user = token ? await resolveAuthUser(token) : null;
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      if (!wsClientsByUid[user.uid]) {
        wsClientsByUid[user.uid] = new Set();
      }
      wsClientsByUid[user.uid].add(ws);

      ws.send(JSON.stringify({ event: 'ws:connected', payload: { uid: user.uid } }));

      ws.on('close', () => {
        wsClientsByUid[user.uid]?.delete(ws);
      });
    });
  });

  // Health & Public Config
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/public-config', (_req, res) => {
    res.json({
      googleMapsApiKey:
        process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
      appUrl: process.env.APP_URL || '',
      platformName: dbState.settings.platformName,
      defaultCurrency: dbState.settings.defaultCurrency,
      defaultCountryCode: dbState.settings.defaultCountryCode,
    });
  });

  // Public Marketplace Bootstrap
  app.get('/api/marketplace/bootstrap', (_req, res) => {
    const activeCategories = dbState.categories
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const visibleProviders = dbState.providers.filter((p) => !p.isSuspended);
    const activeServices = dbState.services.filter((s) => s.isActive);
    const visibleReviews = dbState.reviews.filter((r) => !r.isModeratedHidden);

    res.json({
      categories: activeCategories,
      providers: visibleProviders,
      services: activeServices,
      portfolios: dbState.portfolios,
      reviews: visibleReviews,
      settings: dbState.settings,
    });
  });

  // Account Verification Code Flow
  app.post('/api/auth/send-verification', (req, res) => {
    const { identifier } = req.body as { identifier?: string };
    const clean = (identifier || '').trim().toLowerCase();
    if (!clean || clean.length < 4) {
      res.status(400).json({ error: 'Informe um email ou número +258 válido.' });
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    verificationCodes[clean] = {
      code,
      expiresAt: Date.now() + 1000 * 60 * 15,
      verified: false,
    };
    res.json({
      sent: true,
      message: 'Código de verificação enviado.',
      verificationCodePreview: code,
    });
  });

  app.post('/api/auth/verify-code', (req, res) => {
    const { identifier, code } = req.body as { identifier?: string; code?: string };
    const clean = (identifier || '').trim().toLowerCase();
    const record = verificationCodes[clean];
    if (!record) {
      res.status(400).json({ error: 'Solicite primeiro um código de verificação.' });
      return;
    }
    if (Date.now() > record.expiresAt) {
      res.status(400).json({ error: 'O código expirou. Solicite um novo código.' });
      return;
    }
    if (record.code !== (code || '').trim()) {
      res.status(400).json({ error: 'Código de verificação incorrecto.' });
      return;
    }
    record.verified = true;
    res.json({ verified: true });
  });

  // Email + Phone + Password Registration (Customer or Provider)
  app.post('/api/auth/register', (req, res) => {
    const body = req.body as {
      accountType?: 'customer' | 'provider';
      fullName?: string;
      businessName?: string;
      email?: string;
      phone?: string;
      password?: string;
      city?: string;
      neighborhood?: string;
      address?: string;
      avatarUrl?: string;
      bio?: string;
      verificationCode?: string;
      initialService?: {
        title?: string;
        categoryId?: string;
        description?: string;
        durationMinutes?: number;
        pricingModel?: PricingModel;
        basePriceMzn?: number;
        transportFeeMzn?: number;
        freeTransportRadiusKm?: number;
        extraKmRateMzn?: number;
        serviceLocationMode?: ServiceLocationMode;
        imageUrl?: string;
      };
    };

    const accountType: AccountMode = body.accountType === 'provider' ? 'provider' : 'customer';
    const fullName = (body.fullName || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const city = (body.city || 'Maputo').trim();
    const neighborhood = (body.neighborhood || 'Polana Cimento').trim();
    const address = (body.address || '').trim();

    if (fullName.length < 2) {
      res.status(400).json({ error: 'O nome completo é obrigatório.' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Endereço de email inválido.' });
      return;
    }
    const phoneCheck = validateMozambiquePhone(body.phone || '');
    if (!phoneCheck.valid) {
      res.status(400).json({ error: phoneCheck.error });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
      return;
    }
    if (dbState.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'Já existe uma conta registada com este endereço de email.' });
      return;
    }

    // Validate verification code if sent, or validate provided 6-digit code
    const verifRecord = verificationCodes[email] || verificationCodes[phoneCheck.normalized.toLowerCase()];
    const codeInput = (body.verificationCode || '').trim();
    if (verifRecord) {
      if (!verifRecord.verified && verifRecord.code !== codeInput) {
        res.status(400).json({ error: 'Código de verificação da conta inválido.' });
        return;
      }
      verifRecord.verified = true;
    } else if (!/^\d{6}$/.test(codeInput)) {
      res.status(400).json({ error: 'Por favor, solicite e valide o código de verificação de 6 dígitos.' });
      return;
    }

    if (accountType === 'provider') {
      const bio = (body.bio || '').trim();
      if (bio.length < 10) {
        res.status(400).json({
          error: 'Como prestador, escreva uma descrição profissional com pelo menos 10 caracteres.',
        });
        return;
      }
    }

    const now = new Date().toISOString();
    const uid = generateId(accountType === 'provider' ? 'prov' : 'cust');
    const coords = resolveLocationCoords(city, neighborhood);
    const roles: UserRole[] =
      accountType === 'provider' ? ['customer', 'provider'] : ['customer'];
    if (email === 'edio37muhanzule@gmail.com') {
      roles.push('admin');
    }

    const defaultAvatar =
      accountType === 'provider' ? SEED_IMAGE_PATHS.hair : SEED_IMAGE_PATHS.hero;
    const avatarUrl = (body.avatarUrl || '').trim() || defaultAvatar;

    const newUser: UserProfile = {
      uid,
      fullName,
      email,
      phone: phoneCheck.normalized,
      avatarUrl,
      city,
      neighborhood,
      address,
      lat: coords.lat,
      lng: coords.lng,
      roles,
      activeMode: accountType,
      isAccountVerified: true,
      isSuspended: false,
      language: 'pt-MZ',
      notificationPrefs: {
        inApp: true,
        browserPush: true,
        bookingUpdates: true,
        reviewsAndPromos: true,
      },
      privacyPrefs: {
        showNeighborhoodPublicly: true,
        allowDistanceCalculation: true,
      },
      createdAt: now,
      updatedAt: now,
    };

    const passRecord = hashPassword(password);
    dbState.users.push(newUser);
    dbState.secrets.push({
      uid,
      email,
      salt: passRecord.salt,
      hash: passRecord.hash,
    });

    let newProvider: ProviderProfile | null = null;
    if (accountType === 'provider') {
      const businessName = (body.businessName || '').trim() || fullName;
      newProvider = {
        providerId: uid,
        displayName: fullName,
        businessName,
        avatarUrl,
        bio: (body.bio || '').trim(),
        city,
        neighborhood,
        address,
        lat: coords.lat,
        lng: coords.lng,
        availabilityStatus: 'available',
        isVerified: !dbState.settings.requireProviderVerification ? false : false,
        isSuspended: false,
        averageRating: 0,
        reviewCount: 0,
        completedCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      dbState.providers.push(newProvider);

      // Create initial service if provided
      if (body.initialService && (body.initialService.title || '').trim().length >= 3) {
        const svcIn = body.initialService;
        const initialSvcTitle = (svcIn.title || '').trim();
        const cat =
          dbState.categories.find((c) => c.id === svcIn.categoryId) || dbState.categories[0];
        const newService: ProviderService = {
          id: generateId('svc'),
          providerId: uid,
          providerName: businessName,
          providerAvatar: avatarUrl,
          providerVerified: newProvider.isVerified,
          categoryId: cat.id,
          categoryName: cat.namePt,
          title: initialSvcTitle,
          description:
            (svcIn.description || '').trim() ||
            `Serviço profissional de ${initialSvcTitle} em ${neighborhood}, ${city}.`,
          durationMinutes: Number(svcIn.durationMinutes) || 60,
          pricingModel: svcIn.pricingModel || 'fixed',
          basePriceMzn:
            svcIn.pricingModel === 'consultation' ? 0 : Math.max(0, Number(svcIn.basePriceMzn) || 1000),
          transportFeeMzn: Math.max(0, Number(svcIn.transportFeeMzn) || 200),
          freeTransportRadiusKm: Math.max(0, Number(svcIn.freeTransportRadiusKm) ?? 3),
          extraKmRateMzn: Math.max(0, Number(svcIn.extraKmRateMzn) || 50),
          serviceLocationMode: svcIn.serviceLocationMode || 'both',
          imageUrl: (svcIn.imageUrl || '').trim() || SEED_IMAGE_PATHS.hero,
          isActive: true,
          providerAvailable: true,
          providerAvailabilityStatus: 'available',
          providerRating: 0,
          providerReviewCount: 0,
          city,
          neighborhood,
          lat: coords.lat,
          lng: coords.lng,
          createdAt: now,
          updatedAt: now,
        };
        dbState.services.unshift(newService);
      }
    }

    pushNotification({
      recipientUid: uid,
      type: 'account_update',
      title: 'Bem-vindo à Kanimambo!',
      body:
        accountType === 'provider'
          ? 'A sua conta de prestador foi verificada. Active ou ajuste os seus serviços no painel.'
          : 'A sua conta de cliente foi verificada. Explore prestadores disponíveis em Moçambique.',
    });

    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'provider_registered' });

    const token = signSessionToken(uid);
    res.status(201).json({
      token,
      user: newUser,
      provider: newProvider,
    });
  });

  // Email + Password Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      res.status(400).json({ error: 'Informe o email e a palavra-passe.' });
      return;
    }

    const user = dbState.users.find((u) => u.email.toLowerCase() === cleanEmail);
    const secret = dbState.secrets.find((s) => s.email.toLowerCase() === cleanEmail);
    if (!user || !secret || !verifyPassword(password, secret.salt, secret.hash)) {
      res.status(401).json({ error: 'Email ou palavra-passe incorrectos.' });
      return;
    }
    if (user.isSuspended) {
      res.status(403).json({ error: 'Esta conta foi suspensa pela administração.' });
      return;
    }

    const provider = dbState.providers.find((p) => p.providerId === user.uid) || null;
    const token = signSessionToken(user.uid);
    res.json({ token, user, provider });
  });

  // Google Sign-In Session Exchange (verifies Firebase ID token via firebase-admin)
  app.post('/api/auth/google', async (req, res) => {
    const { idToken, preferredMode } = req.body as {
      idToken?: string;
      preferredMode?: AccountMode;
    };
    if (!idToken) {
      res.status(400).json({ error: 'Token Google em falta.' });
      return;
    }

    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = (decoded.email || '').toLowerCase();
      let user =
        dbState.users.find((u) => u.uid === decoded.uid) ||
        (email ? dbState.users.find((u) => u.email.toLowerCase() === email) : undefined);

      let needsOnboarding = false;
      if (!user) {
        const now = new Date().toISOString();
        const coords = resolveLocationCoords('Maputo', 'Polana Cimento');
        const roles: UserRole[] = ['customer'];
        if (email === 'edio37muhanzule@gmail.com') {
          roles.push('admin');
        }
        user = {
          uid: decoded.uid,
          fullName: decoded.name || email.split('@')[0] || 'Utilizador Kanimambo',
          email: email || `${decoded.uid}@kanimambo.co.mz`,
          phone: '+258 84 000 0000',
          avatarUrl: decoded.picture || SEED_IMAGE_PATHS.hero,
          city: 'Maputo',
          neighborhood: 'Polana Cimento',
          address: '',
          lat: coords.lat,
          lng: coords.lng,
          roles,
          activeMode: preferredMode === 'provider' ? 'customer' : 'customer',
          isAccountVerified: true,
          isSuspended: false,
          language: 'pt-MZ',
          notificationPrefs: {
            inApp: true,
            browserPush: true,
            bookingUpdates: true,
            reviewsAndPromos: true,
          },
          privacyPrefs: {
            showNeighborhoodPublicly: true,
            allowDistanceCalculation: true,
          },
          createdAt: now,
          updatedAt: now,
        };
        dbState.users.push(user);
        needsOnboarding = true;
        saveDatabase();
      }

      if (user.isSuspended) {
        res.status(403).json({ error: 'Esta conta encontra-se suspensa.' });
        return;
      }

      const provider = dbState.providers.find((p) => p.providerId === user!.uid) || null;
      const token = signSessionToken(user.uid);
      res.json({ token, user, provider, needsOnboarding });
    } catch (err) {
      console.error('Google token verification failed:', err);
      res.status(401).json({ error: 'Falha ao validar a sessão Google.' });
    }
  });

  // Quick Demo Account Switcher for immediate evaluation of Customer / Provider / Admin roles
  app.post('/api/auth/demo-login', (req, res) => {
    const { role } = req.body as { role?: 'customer' | 'provider' | 'admin' };
    let targetUid = 'user-customer-demo';
    if (role === 'provider') targetUid = 'prov-polana-chic';
    if (role === 'admin') targetUid = 'user-admin-edio';

    const user = dbState.users.find((u) => u.uid === targetUid);
    if (!user) {
      res.status(404).json({ error: 'Conta de demonstração não encontrada.' });
      return;
    }
    const provider = dbState.providers.find((p) => p.providerId === user.uid) || null;
    const token = signSessionToken(user.uid);
    res.json({ token, user, provider });
  });

  // Current Session Info
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const provider = dbState.providers.find((p) => p.providerId === user.uid) || null;
    res.json({ user, provider });
  });

  // Update Account Settings & Personal Information
  app.patch('/api/account/profile', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const body = req.body as {
      fullName?: string;
      businessName?: string;
      bio?: string;
      phone?: string;
      city?: string;
      neighborhood?: string;
      address?: string;
      lat?: number;
      lng?: number;
      avatarUrl?: string;
      language?: 'pt-MZ' | 'en';
      notificationPrefs?: UserProfile['notificationPrefs'];
      privacyPrefs?: UserProfile['privacyPrefs'];
      currentPassword?: string;
      newPassword?: string;
    };

    if (body.fullName !== undefined) {
      if (body.fullName.trim().length < 2) {
        res.status(400).json({ error: 'O nome deve ter pelo menos 2 caracteres.' });
        return;
      }
      user.fullName = body.fullName.trim();
    }

    if (body.phone !== undefined) {
      const check = validateMozambiquePhone(body.phone);
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }
      user.phone = check.normalized;
    }

    if (body.city !== undefined || body.neighborhood !== undefined) {
      const nextCity = (body.city ?? user.city).trim();
      const nextNeighborhood = (body.neighborhood ?? user.neighborhood).trim();
      user.city = nextCity;
      user.neighborhood = nextNeighborhood;
      if (typeof body.lat === 'number' && typeof body.lng === 'number') {
        user.lat = body.lat;
        user.lng = body.lng;
      } else {
        const coords = resolveLocationCoords(nextCity, nextNeighborhood);
        user.lat = coords.lat;
        user.lng = coords.lng;
      }
    }

    if (body.address !== undefined) {
      user.address = body.address.trim();
    }
    if (body.avatarUrl !== undefined && body.avatarUrl.trim()) {
      user.avatarUrl = body.avatarUrl.trim();
    }
    if (body.language === 'pt-MZ' || body.language === 'en') {
      user.language = body.language;
    }
    if (body.notificationPrefs) {
      user.notificationPrefs = { ...user.notificationPrefs, ...body.notificationPrefs };
    }
    if (body.privacyPrefs) {
      user.privacyPrefs = { ...user.privacyPrefs, ...body.privacyPrefs };
    }

    if (body.newPassword) {
      if (body.newPassword.length < 6) {
        res.status(400).json({ error: 'A nova palavra-passe deve ter pelo menos 6 caracteres.' });
        return;
      }
      const existingSecret = dbState.secrets.find((s) => s.uid === user.uid);
      if (existingSecret) {
        if (!body.currentPassword || !verifyPassword(body.currentPassword, existingSecret.salt, existingSecret.hash)) {
          res.status(400).json({ error: 'Palavra-passe actual incorrecta.' });
          return;
        }
        const nextHash = hashPassword(body.newPassword);
        existingSecret.salt = nextHash.salt;
        existingSecret.hash = nextHash.hash;
      } else {
        const nextHash = hashPassword(body.newPassword);
        dbState.secrets.push({
          uid: user.uid,
          email: user.email.toLowerCase(),
          salt: nextHash.salt,
          hash: nextHash.hash,
        });
      }
    }

    user.updatedAt = new Date().toISOString();

    const provider = dbState.providers.find((p) => p.providerId === user.uid) || null;
    if (provider) {
      provider.displayName = user.fullName;
      if (body.businessName !== undefined && body.businessName.trim().length >= 2) {
        provider.businessName = body.businessName.trim();
      }
      if (body.bio !== undefined && body.bio.trim().length >= 10) {
        provider.bio = body.bio.trim();
      }
      provider.avatarUrl = user.avatarUrl;
      provider.city = user.city;
      provider.neighborhood = user.neighborhood;
      provider.address = user.address;
      provider.lat = user.lat;
      provider.lng = user.lng;
      provider.updatedAt = user.updatedAt;
      syncProviderServicesMetadata(provider);
    }

    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'profile_updated', providerId: user.uid });
    res.json({ user, provider });
  });

  // Flexible Account Type & Role Switching (Customer <-> Provider <-> Both)
  app.post('/api/account/role', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const body = req.body as {
      targetMode?: AccountMode;
      enableProviderRole?: boolean;
      disableProviderRole?: boolean;
      businessName?: string;
      bio?: string;
      city?: string;
      neighborhood?: string;
      address?: string;
      phone?: string;
    };

    const now = new Date().toISOString();
    let provider = dbState.providers.find((p) => p.providerId === user.uid) || null;

    if (body.phone) {
      const check = validateMozambiquePhone(body.phone);
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }
      user.phone = check.normalized;
    }

    if (body.city || body.neighborhood) {
      user.city = (body.city || user.city).trim();
      user.neighborhood = (body.neighborhood || user.neighborhood).trim();
      const coords = resolveLocationCoords(user.city, user.neighborhood);
      user.lat = coords.lat;
      user.lng = coords.lng;
    }

    if (body.address !== undefined) {
      user.address = body.address.trim();
    }

    if (body.disableProviderRole) {
      user.roles = user.roles.filter((r) => r !== 'provider');
      if (!user.roles.includes('customer')) user.roles.unshift('customer');
      user.activeMode = 'customer';
      if (provider) {
        provider.availabilityStatus = 'unavailable';
        provider.updatedAt = now;
        syncProviderServicesMetadata(provider);
      }
      user.updatedAt = now;
      saveDatabase();
      broadcastWs('marketplace:updated', { reason: 'role_changed' });
      res.json({ user, provider });
      return;
    }

    if (body.enableProviderRole || body.targetMode === 'provider') {
      if (!provider) {
        const businessName = (body.businessName || '').trim() || user.fullName;
        const bio = (body.bio || '').trim();
        if (bio.length < 10) {
          res.status(400).json({
            error:
              'Para activar o perfil de prestador, insira uma descrição profissional com pelo menos 10 caracteres.',
          });
          return;
        }
        provider = {
          providerId: user.uid,
          displayName: user.fullName,
          businessName,
          avatarUrl: user.avatarUrl,
          bio,
          city: user.city,
          neighborhood: user.neighborhood,
          address: user.address,
          lat: user.lat,
          lng: user.lng,
          availabilityStatus: 'available',
          isVerified: false,
          isSuspended: false,
          averageRating: 0,
          reviewCount: 0,
          completedCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        dbState.providers.push(provider);
      } else {
        if (body.businessName && body.businessName.trim().length >= 2) {
          provider.businessName = body.businessName.trim();
        }
        if (body.bio && body.bio.trim().length >= 10) {
          provider.bio = body.bio.trim();
        }
        provider.updatedAt = now;
      }

      if (!user.roles.includes('provider')) {
        user.roles.push('provider');
      }
      if (!user.roles.includes('customer')) {
        user.roles.unshift('customer');
      }
      user.activeMode = 'provider';
    } else if (body.targetMode === 'customer') {
      if (!user.roles.includes('customer')) {
        user.roles.unshift('customer');
      }
      user.activeMode = 'customer';
    }

    user.updatedAt = now;
    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'role_switched' });
    res.json({ user, provider });
  });

  // Deactivate or Delete Account
  app.delete('/api/account', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const mode = (req.query.mode as string) || 'deactivate';
    const provider = dbState.providers.find((p) => p.providerId === user.uid);

    if (mode === 'delete') {
      dbState.users = dbState.users.filter((u) => u.uid !== user.uid);
      dbState.secrets = dbState.secrets.filter((s) => s.uid !== user.uid);
      dbState.providers = dbState.providers.filter((p) => p.providerId !== user.uid);
      dbState.services = dbState.services.filter((s) => s.providerId !== user.uid);
      dbState.portfolios = dbState.portfolios.filter((p) => p.providerId !== user.uid);
    } else {
      user.isSuspended = true;
      user.updatedAt = new Date().toISOString();
      if (provider) {
        provider.availabilityStatus = 'unavailable';
        provider.isSuspended = true;
        provider.updatedAt = user.updatedAt;
        syncProviderServicesMetadata(provider);
      }
    }

    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'account_deactivated' });
    res.json({ success: true });
  });

  // Provider Availability ON / OFF / Paused Toggle
  app.patch('/api/provider/availability', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const provider = dbState.providers.find((p) => p.providerId === user.uid);
    if (!provider) {
      res.status(403).json({ error: 'Active o perfil de prestador primeiro.' });
      return;
    }

    const { availabilityStatus, pauseReason } = req.body as {
      availabilityStatus?: AvailabilityStatus;
      pauseReason?: string;
    };

    if (!availabilityStatus || !['available', 'unavailable', 'paused'].includes(availabilityStatus)) {
      res.status(400).json({ error: 'Estado de disponibilidade inválido.' });
      return;
    }

    provider.availabilityStatus = availabilityStatus;
    provider.pauseReason = availabilityStatus === 'paused' ? (pauseReason || '').trim() : '';
    provider.updatedAt = new Date().toISOString();
    syncProviderServicesMetadata(provider);

    saveDatabase();
    broadcastWs('marketplace:updated', {
      reason: 'availability_changed',
      providerId: provider.providerId,
      availabilityStatus,
    });

    res.json({ provider });
  });

  // Provider Service Management (Create, Update, Delete)
  app.post('/api/provider/services', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const provider = dbState.providers.find((p) => p.providerId === user.uid);
    if (!provider) {
      res.status(403).json({ error: 'Apenas prestadores podem registar serviços.' });
      return;
    }

    const body = req.body as {
      title?: string;
      categoryId?: string;
      description?: string;
      durationMinutes?: number;
      pricingModel?: PricingModel;
      basePriceMzn?: number;
      transportFeeMzn?: number;
      freeTransportRadiusKm?: number;
      extraKmRateMzn?: number;
      serviceLocationMode?: ServiceLocationMode;
      imageUrl?: string;
    };

    const title = (body.title || '').trim();
    const description = (body.description || '').trim();
    if (title.length < 3) {
      res.status(400).json({ error: 'O título do serviço deve ter pelo menos 3 caracteres.' });
      return;
    }
    if (description.length < 10) {
      res.status(400).json({ error: 'A descrição do serviço deve ter pelo menos 10 caracteres.' });
      return;
    }

    const category =
      dbState.categories.find((c) => c.id === body.categoryId) || dbState.categories[0];
    const pricingModel: PricingModel =
      body.pricingModel && ['fixed', 'starting_from', 'consultation'].includes(body.pricingModel)
        ? body.pricingModel
        : 'fixed';
    const serviceLocationMode: ServiceLocationMode =
      body.serviceLocationMode &&
      ['provider_location', 'customer_location', 'both'].includes(body.serviceLocationMode)
        ? body.serviceLocationMode
        : 'both';

    const now = new Date().toISOString();
    const newService: ProviderService = {
      id: generateId('svc'),
      providerId: provider.providerId,
      providerName: provider.businessName || provider.displayName,
      providerAvatar: provider.avatarUrl,
      providerVerified: provider.isVerified,
      categoryId: category.id,
      categoryName: category.namePt,
      title,
      description,
      durationMinutes: Math.max(15, Math.min(1440, Number(body.durationMinutes) || 60)),
      pricingModel,
      basePriceMzn:
        pricingModel === 'consultation' ? 0 : Math.max(0, Number(body.basePriceMzn) || 0),
      transportFeeMzn: Math.max(0, Number(body.transportFeeMzn) || 0),
      freeTransportRadiusKm: Math.max(0, Number(body.freeTransportRadiusKm) || 0),
      extraKmRateMzn: Math.max(0, Number(body.extraKmRateMzn) || 0),
      serviceLocationMode,
      imageUrl: (body.imageUrl || '').trim() || SEED_IMAGE_PATHS.hero,
      isActive: true,
      providerAvailable: provider.availabilityStatus === 'available' && !provider.isSuspended,
      providerAvailabilityStatus: provider.availabilityStatus,
      providerRating: provider.averageRating,
      providerReviewCount: provider.reviewCount,
      city: provider.city,
      neighborhood: provider.neighborhood,
      lat: provider.lat,
      lng: provider.lng,
      createdAt: now,
      updatedAt: now,
    };

    dbState.services.unshift(newService);
    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'service_created', serviceId: newService.id });

    res.status(201).json({ service: newService });
  });

  app.patch('/api/provider/services/:serviceId', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { serviceId } = req.params;
    const service = dbState.services.find((s) => s.id === serviceId);
    if (!service) {
      res.status(404).json({ error: 'Serviço não encontrado.' });
      return;
    }
    if (service.providerId !== user.uid && !user.roles.includes('admin')) {
      res.status(403).json({ error: 'Sem permissão para editar este serviço.' });
      return;
    }

    const body = req.body as Partial<ProviderService>;
    if (body.title !== undefined) {
      if (body.title.trim().length < 3) {
        res.status(400).json({ error: 'O título deve ter pelo menos 3 caracteres.' });
        return;
      }
      service.title = body.title.trim();
    }
    if (body.description !== undefined) {
      if (body.description.trim().length < 10) {
        res.status(400).json({ error: 'A descrição deve ter pelo menos 10 caracteres.' });
        return;
      }
      service.description = body.description.trim();
    }
    if (body.categoryId !== undefined) {
      const cat = dbState.categories.find((c) => c.id === body.categoryId);
      if (cat) {
        service.categoryId = cat.id;
        service.categoryName = cat.namePt;
      }
    }
    if (body.durationMinutes !== undefined) {
      service.durationMinutes = Math.max(15, Math.min(1440, Number(body.durationMinutes) || 60));
    }
    if (body.pricingModel !== undefined) {
      service.pricingModel = body.pricingModel;
    }
    if (body.basePriceMzn !== undefined) {
      service.basePriceMzn =
        service.pricingModel === 'consultation' ? 0 : Math.max(0, Number(body.basePriceMzn) || 0);
    }
    if (body.transportFeeMzn !== undefined) {
      service.transportFeeMzn = Math.max(0, Number(body.transportFeeMzn) || 0);
    }
    if (body.freeTransportRadiusKm !== undefined) {
      service.freeTransportRadiusKm = Math.max(0, Number(body.freeTransportRadiusKm) || 0);
    }
    if (body.extraKmRateMzn !== undefined) {
      service.extraKmRateMzn = Math.max(0, Number(body.extraKmRateMzn) || 0);
    }
    if (body.serviceLocationMode !== undefined) {
      service.serviceLocationMode = body.serviceLocationMode;
    }
    if (body.imageUrl !== undefined && body.imageUrl.trim()) {
      service.imageUrl = body.imageUrl.trim();
    }
    if (typeof body.isActive === 'boolean') {
      service.isActive = body.isActive;
    }

    service.updatedAt = new Date().toISOString();
    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'service_updated', serviceId: service.id });

    res.json({ service });
  });

  app.delete('/api/provider/services/:serviceId', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { serviceId } = req.params;
    const service = dbState.services.find((s) => s.id === serviceId);
    if (!service) {
      res.status(404).json({ error: 'Serviço não encontrado.' });
      return;
    }
    if (service.providerId !== user.uid && !user.roles.includes('admin')) {
      res.status(403).json({ error: 'Sem permissão para eliminar este serviço.' });
      return;
    }

    dbState.services = dbState.services.filter((s) => s.id !== serviceId);
    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'service_deleted', serviceId });

    res.json({ deleted: true });
  });

  // Portfolio Management
  app.post('/api/provider/portfolio', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const provider = dbState.providers.find((p) => p.providerId === user.uid);
    if (!provider) {
      res.status(403).json({ error: 'Apenas prestadores podem adicionar ao portfólio.' });
      return;
    }
    const { title, categoryName, imageUrl } = req.body as {
      title?: string;
      categoryName?: string;
      imageUrl?: string;
    };
    if (!title || title.trim().length < 2 || !imageUrl) {
      res.status(400).json({ error: 'Título e imagem são obrigatórios para o portfólio.' });
      return;
    }

    const item: PortfolioItem = {
      id: generateId('port'),
      providerId: provider.providerId,
      title: title.trim(),
      categoryName: (categoryName || 'Trabalho Realizado').trim(),
      imageUrl: imageUrl.trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.portfolios.unshift(item);
    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'portfolio_updated' });
    res.status(201).json({ item });
  });

  app.delete('/api/provider/portfolio/:itemId', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const item = dbState.portfolios.find((p) => p.id === req.params.itemId);
    if (!item) {
      res.status(404).json({ error: 'Item não encontrado.' });
      return;
    }
    if (item.providerId !== user.uid && !user.roles.includes('admin')) {
      res.status(403).json({ error: 'Sem permissão para remover este item.' });
      return;
    }
    dbState.portfolios = dbState.portfolios.filter((p) => p.id !== item.id);
    saveDatabase();
    res.json({ deleted: true });
  });

  // Service Requests Workflow (Customer & Provider)
  app.get('/api/requests', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const requests = dbState.requests
      .filter(
        (r) =>
          r.customerId === user.uid ||
          r.providerId === user.uid ||
          user.roles.includes('admin')
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const requestIds = new Set(requests.map((r) => r.id));
    const history = dbState.requestHistory.filter((h) => requestIds.has(h.requestId));

    res.json({ requests, history });
  });

  app.post('/api/requests', requireAuth, (req: AuthedRequest, res) => {
    const customer = req.authUser!;
    const body = req.body as {
      serviceId?: string;
      preferredDate?: string;
      preferredTime?: string;
      locationMode?: RequestLocationMode;
      customerCity?: string;
      customerNeighborhood?: string;
      customerAddress?: string;
      customerLat?: number;
      customerLng?: number;
      specialInstructions?: string;
    };

    const service = dbState.services.find((s) => s.id === body.serviceId);
    if (!service || !service.isActive) {
      res.status(404).json({ error: 'O serviço seleccionado não está disponível.' });
      return;
    }

    const provider = dbState.providers.find((p) => p.providerId === service.providerId);
    if (!provider || provider.isSuspended || provider.availabilityStatus !== 'available') {
      res.status(409).json({
        error:
          'Este prestador encontra-se indisponível ou temporariamente pausado e não pode receber pedidos neste momento.',
      });
      return;
    }

    if (provider.providerId === customer.uid) {
      res.status(400).json({ error: 'Não pode solicitar o seu próprio serviço.' });
      return;
    }

    const preferredDate = (body.preferredDate || '').trim();
    const preferredTime = (body.preferredTime || '').trim();
    if (!preferredDate || !preferredTime) {
      res.status(400).json({ error: 'Seleccione a data e hora preferidas para o serviço.' });
      return;
    }

    const locationMode: RequestLocationMode =
      body.locationMode === 'provider_location' ? 'provider_location' : 'customer_location';
    if (
      service.serviceLocationMode !== 'both' &&
      service.serviceLocationMode !== locationMode
    ) {
      res.status(400).json({ error: 'Modalidade de localização não suportada por este serviço.' });
      return;
    }

    const customerCity = (body.customerCity || customer.city || 'Maputo').trim();
    const customerNeighborhood = (
      body.customerNeighborhood ||
      customer.neighborhood ||
      'Polana Cimento'
    ).trim();
    const customerAddress = (body.customerAddress || customer.address || '').trim();
    const resolvedCoords =
      typeof body.customerLat === 'number' && typeof body.customerLng === 'number'
        ? { lat: body.customerLat, lng: body.customerLng }
        : resolveLocationCoords(customerCity, customerNeighborhood);

    const distanceKm = calculateDistanceKm(
      provider.lat,
      provider.lng,
      resolvedCoords.lat,
      resolvedCoords.lng
    );

    const pricing = calculatePricingBreakdown({
      pricingModel: service.pricingModel,
      basePriceMzn: service.basePriceMzn,
      transportFeeMzn: service.transportFeeMzn,
      freeTransportRadiusKm: service.freeTransportRadiusKm,
      extraKmRateMzn: service.extraKmRateMzn,
      locationMode,
      distanceKm,
    });

    const now = new Date().toISOString();
    const newRequest: ServiceRequest = {
      id: generateId('req'),
      customerId: customer.uid,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      providerId: provider.providerId,
      providerName: provider.businessName || provider.displayName,
      serviceId: service.id,
      serviceTitle: service.title,
      pricingModel: service.pricingModel,
      preferredDate,
      preferredTime,
      locationMode,
      customerCity,
      customerNeighborhood,
      customerAddress,
      customerLat: resolvedCoords.lat,
      customerLng: resolvedCoords.lng,
      distanceKm: pricing.distanceKm,
      servicePriceMzn: pricing.servicePriceMzn,
      transportFeeMzn: pricing.transportFeeMzn,
      estimatedTotalMzn: pricing.estimatedTotalMzn,
      specialInstructions: (body.specialInstructions || '').trim(),
      status: 'pending',
      hasReview: false,
      createdAt: now,
      updatedAt: now,
    };

    const historyEntry: RequestStatusHistoryItem = {
      id: generateId('hist'),
      requestId: newRequest.id,
      fromStatus: null,
      toStatus: 'pending',
      changedByUid: customer.uid,
      changedByName: customer.fullName,
      changedByRole: 'customer',
      note: 'Pedido submetido pelo cliente.',
      createdAt: now,
    };

    dbState.requests.unshift(newRequest);
    dbState.requestHistory.push(historyEntry);

    const priceLabel =
      service.pricingModel === 'consultation'
        ? `Sob consulta (+ ${formatMzn(pricing.transportFeeMzn)} deslocação)`
        : formatMzn(pricing.estimatedTotalMzn);

    pushNotification({
      recipientUid: provider.providerId,
      type: 'request_created',
      title: 'Novo pedido de serviço',
      body: `${customer.fullName} solicitou "${service.title}" para ${preferredDate} às ${preferredTime} (${priceLabel}).`,
      relatedRequestId: newRequest.id,
    });

    saveDatabase();
    sendWsToUser(provider.providerId, 'request:updated', {
      request: newRequest,
      historyEntry,
    });
    sendWsToUser(customer.uid, 'request:updated', {
      request: newRequest,
      historyEntry,
    });

    res.status(201).json({ request: newRequest, historyEntry });
  });

  app.patch('/api/requests/:requestId/status', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const { requestId } = req.params;
    const { status: nextStatus, note } = req.body as {
      status?: RequestStatus;
      note?: string;
    };

    const request = dbState.requests.find((r) => r.id === requestId);
    if (!request) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    let actorRole: UserRole = 'customer';
    if (actor.roles.includes('admin') && actor.uid !== request.customerId && actor.uid !== request.providerId) {
      actorRole = 'admin';
    } else if (actor.uid === request.providerId) {
      actorRole = 'provider';
    } else if (actor.uid === request.customerId) {
      actorRole = 'customer';
    } else {
      res.status(403).json({ error: 'Sem permissão para actualizar este pedido.' });
      return;
    }

    if (!nextStatus) {
      res.status(400).json({ error: 'Estado de destino obrigatório.' });
      return;
    }

    const transition = canTransitionRequestStatus(request.status, nextStatus, actorRole);
    if (!transition.allowed) {
      res.status(400).json({ error: transition.reason });
      return;
    }

    const prevStatus = request.status;
    const now = new Date().toISOString();
    request.status = nextStatus;
    request.updatedAt = now;

    if (nextStatus === 'completed') {
      const provider = dbState.providers.find((p) => p.providerId === request.providerId);
      if (provider) {
        provider.completedCount += 1;
        provider.updatedAt = now;
      }
    }

    const defaultNotes: Record<RequestStatus, string> = {
      pending: 'Pedido pendente.',
      accepted: 'Pedido aceite pelo prestador.',
      rejected: 'Pedido rejeitado pelo prestador.',
      confirmed: 'Agendamento confirmado.',
      in_progress: 'Serviço iniciado.',
      completed: 'Serviço marcado como concluído.',
      cancelled: 'Pedido cancelado.',
    };

    const historyEntry: RequestStatusHistoryItem = {
      id: generateId('hist'),
      requestId: request.id,
      fromStatus: prevStatus,
      toStatus: nextStatus,
      changedByUid: actor.uid,
      changedByName: actor.fullName,
      changedByRole: actorRole,
      note: (note || '').trim() || defaultNotes[nextStatus],
      createdAt: now,
    };
    dbState.requestHistory.push(historyEntry);

    // Notify counterparty
    const notifyTargetUid =
      actor.uid === request.providerId ? request.customerId : request.providerId;

    const notifMap: Record<RequestStatus, { type: NotificationItem['type']; title: string; body: string }> = {
      pending: {
        type: 'request_created',
        title: 'Pedido pendente',
        body: `O pedido "${request.serviceTitle}" está pendente.`,
      },
      accepted: {
        type: 'request_accepted',
        title: 'Pedido aceite!',
        body: `${request.providerName} aceitou o seu pedido para "${request.serviceTitle}".`,
      },
      rejected: {
        type: 'request_rejected',
        title: 'Pedido recusado',
        body: `${request.providerName} não pôde aceitar o pedido para "${request.serviceTitle}".`,
      },
      confirmed: {
        type: 'request_confirmed',
        title: 'Agendamento confirmado',
        body: `O serviço "${request.serviceTitle}" foi confirmado para ${request.preferredDate} às ${request.preferredTime}.`,
      },
      in_progress: {
        type: 'request_in_progress',
        title: 'Serviço em curso',
        body: `${request.providerName} iniciou o serviço "${request.serviceTitle}".`,
      },
      completed: {
        type: 'request_completed',
        title: 'Serviço concluído!',
        body: `"${request.serviceTitle}" foi concluído. Já pode avaliar a experiência no perfil do prestador.`,
      },
      cancelled: {
        type: 'request_cancelled',
        title: 'Pedido cancelado',
        body: `${actor.fullName} cancelou o pedido "${request.serviceTitle}".`,
      },
    };

    const notifMeta = notifMap[nextStatus];
    pushNotification({
      recipientUid: notifyTargetUid,
      type: notifMeta.type,
      title: notifMeta.title,
      body: notifMeta.body,
      relatedRequestId: request.id,
    });

    saveDatabase();
    sendWsToUser(request.customerId, 'request:updated', { request, historyEntry });
    sendWsToUser(request.providerId, 'request:updated', { request, historyEntry });

    res.json({ request, historyEntry });
  });

  // Ratings & Public Reviews System
  app.post('/api/reviews', requireAuth, (req: AuthedRequest, res) => {
    const customer = req.authUser!;
    const { requestId, rating, comment, photoUrl } = req.body as {
      requestId?: string;
      rating?: number;
      comment?: string;
      photoUrl?: string;
    };

    const request = dbState.requests.find((r) => r.id === requestId);
    if (!request) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    const existingForRequest = dbState.reviews.filter((rev) => rev.requestId === request.id);
    const check = canSubmitReview({
      requestStatus: request.status,
      requestCustomerId: request.customerId,
      actorUid: customer.uid,
      existingReviewCountForRequest: existingForRequest.length,
      rating: Number(rating),
      comment: comment || '',
    });

    if (!check.allowed) {
      res.status(400).json({ error: check.reason });
      return;
    }

    const now = new Date().toISOString();
    const newReview: ReviewItem = {
      id: generateId('rev'),
      requestId: request.id,
      providerId: request.providerId,
      providerName: request.providerName,
      customerId: customer.uid,
      customerName: customer.fullName,
      serviceId: request.serviceId,
      serviceTitle: request.serviceTitle,
      rating: Number(rating),
      comment: (comment || '').trim(),
      photoUrl: (photoUrl || '').trim() || undefined,
      isModeratedHidden: false,
      createdAt: now,
    };

    dbState.reviews.unshift(newReview);
    request.hasReview = true;
    request.updatedAt = now;

    // Recalculate provider average rating & review count
    const provider = dbState.providers.find((p) => p.providerId === request.providerId);
    if (provider) {
      const providerReviews = dbState.reviews.filter((r) => r.providerId === provider.providerId);
      const stats = computeProviderRatingStats(providerReviews);
      provider.averageRating = stats.averageRating;
      provider.reviewCount = stats.reviewCount;
      provider.updatedAt = now;
      syncProviderServicesMetadata(provider);
    }

    pushNotification({
      recipientUid: request.providerId,
      type: 'review_created',
      title: `Nova avaliação de ${newReview.rating} estrelas`,
      body: `${customer.fullName} avaliou "${request.serviceTitle}": "${newReview.comment.slice(0, 80)}"`,
      relatedRequestId: request.id,
    });

    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'review_created', providerId: request.providerId });
    sendWsToUser(customer.uid, 'request:updated', { request });

    res.status(201).json({ review: newReview, provider });
  });

  // Notifications Center
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const notifications = dbState.notifications
      .filter((n) => n.recipientUid === user.uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ notifications });
  });

  app.patch('/api/notifications/:notificationId/read', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const notif = dbState.notifications.find((n) => n.id === req.params.notificationId);
    if (!notif || notif.recipientUid !== user.uid) {
      res.status(404).json({ error: 'Notificação não encontrada.' });
      return;
    }
    notif.isRead = true;
    saveDatabase();
    res.json({ notification: notif });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    for (const n of dbState.notifications) {
      if (n.recipientUid === user.uid) {
        n.isRead = true;
      }
    }
    saveDatabase();
    res.json({ success: true });
  });

  // Content & Review Reporting
  app.post('/api/reports', requireAuth, (req: AuthedRequest, res) => {
    const reporter = req.authUser!;
    const { targetType, targetId, targetLabel, reason, details } = req.body as {
      targetType?: 'review' | 'provider' | 'service';
      targetId?: string;
      targetLabel?: string;
      reason?: string;
      details?: string;
    };

    if (!targetType || !targetId || !reason || reason.trim().length < 3) {
      res.status(400).json({ error: 'Indique o motivo da denúncia.' });
      return;
    }

    const now = new Date().toISOString();
    const report: ContentReport = {
      id: generateId('rep'),
      reporterUid: reporter.uid,
      reporterName: reporter.fullName,
      targetType,
      targetId,
      targetLabel: (targetLabel || targetId).trim(),
      reason: reason.trim(),
      details: (details || '').trim(),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    dbState.reports.unshift(report);
    saveDatabase();
    res.status(201).json({ report });
  });

  // Administrator Dashboard Endpoints
  app.get('/api/admin/overview', requireAuth, requireAdmin, (_req, res) => {
    res.json({
      analytics: computePlatformAnalytics(),
      users: dbState.users,
      providers: dbState.providers,
      categories: dbState.categories.sort((a, b) => a.sortOrder - b.sortOrder),
      services: dbState.services,
      requests: dbState.requests.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      reviews: dbState.reviews,
      reports: dbState.reports,
      settings: dbState.settings,
    });
  });

  app.patch(
    '/api/admin/providers/:providerId/verify',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res) => {
      const provider = dbState.providers.find((p) => p.providerId === req.params.providerId);
      if (!provider) {
        res.status(404).json({ error: 'Prestador não encontrado.' });
        return;
      }
      const { isVerified } = req.body as { isVerified?: boolean };
      provider.isVerified = typeof isVerified === 'boolean' ? isVerified : !provider.isVerified;
      provider.updatedAt = new Date().toISOString();
      syncProviderServicesMetadata(provider);

      pushNotification({
        recipientUid: provider.providerId,
        type: 'provider_verified',
        title: provider.isVerified
          ? 'Conta de prestador verificada!'
          : 'Verificação de prestador removida',
        body: provider.isVerified
          ? 'O seu perfil recebeu o selo de prestador verificado na Kanimambo.'
          : 'O selo de verificação do seu perfil foi actualizado pela administração.',
      });

      saveDatabase();
      broadcastWs('marketplace:updated', { reason: 'provider_verified', providerId: provider.providerId });
      res.json({ provider, analytics: computePlatformAnalytics() });
    }
  );

  app.patch('/api/admin/users/:uid/suspend', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const target = dbState.users.find((u) => u.uid === req.params.uid);
    if (!target) {
      res.status(404).json({ error: 'Utilizador não encontrado.' });
      return;
    }
    if (target.uid === req.authUser!.uid) {
      res.status(400).json({ error: 'Não pode suspender a sua própria conta de administrador.' });
      return;
    }

    const { isSuspended } = req.body as { isSuspended?: boolean };
    target.isSuspended = typeof isSuspended === 'boolean' ? isSuspended : !target.isSuspended;
    target.updatedAt = new Date().toISOString();

    const provider = dbState.providers.find((p) => p.providerId === target.uid);
    if (provider) {
      provider.isSuspended = target.isSuspended;
      if (target.isSuspended) {
        provider.availabilityStatus = 'unavailable';
      }
      provider.updatedAt = target.updatedAt;
      syncProviderServicesMetadata(provider);
    }

    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'user_suspended' });
    res.json({ user: target, provider, analytics: computePlatformAnalytics() });
  });

  app.post('/api/admin/categories', requireAuth, requireAdmin, (req, res) => {
    const { namePt, nameEn, descriptionPt, iconName } = req.body as {
      namePt?: string;
      nameEn?: string;
      descriptionPt?: string;
      iconName?: string;
    };
    if (!namePt || namePt.trim().length < 2) {
      res.status(400).json({ error: 'Nome da categoria em português é obrigatório.' });
      return;
    }
    const slug = namePt
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    const newCat: ServiceCategory = {
      id: generateId('cat'),
      slug,
      namePt: namePt.trim(),
      nameEn: (nameEn || namePt).trim(),
      descriptionPt: (descriptionPt || '').trim(),
      iconName: (iconName || 'Briefcase').trim(),
      isActive: true,
      sortOrder: dbState.categories.length + 1,
    };
    dbState.categories.push(newCat);
    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'category_added' });
    res.status(201).json({ category: newCat });
  });

  app.patch('/api/admin/categories/:categoryId', requireAuth, requireAdmin, (req, res) => {
    const cat = dbState.categories.find((c) => c.id === req.params.categoryId);
    if (!cat) {
      res.status(404).json({ error: 'Categoria não encontrada.' });
      return;
    }
    const { namePt, nameEn, descriptionPt, isActive } = req.body as Partial<ServiceCategory>;
    if (namePt !== undefined && namePt.trim().length >= 2) cat.namePt = namePt.trim();
    if (nameEn !== undefined && nameEn.trim().length >= 2) cat.nameEn = nameEn.trim();
    if (descriptionPt !== undefined) cat.descriptionPt = descriptionPt.trim();
    if (typeof isActive === 'boolean') cat.isActive = isActive;
    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'category_updated' });
    res.json({ category: cat });
  });

  app.patch('/api/admin/reviews/:reviewId/moderate', requireAuth, requireAdmin, (req, res) => {
    const review = dbState.reviews.find((r) => r.id === req.params.reviewId);
    if (!review) {
      res.status(404).json({ error: 'Avaliação não encontrada.' });
      return;
    }
    const { isModeratedHidden } = req.body as { isModeratedHidden?: boolean };
    review.isModeratedHidden =
      typeof isModeratedHidden === 'boolean' ? isModeratedHidden : !review.isModeratedHidden;

    const provider = dbState.providers.find((p) => p.providerId === review.providerId);
    if (provider) {
      const stats = computeProviderRatingStats(
        dbState.reviews.filter((r) => r.providerId === provider.providerId)
      );
      provider.averageRating = stats.averageRating;
      provider.reviewCount = stats.reviewCount;
      provider.updatedAt = new Date().toISOString();
      syncProviderServicesMetadata(provider);
    }

    saveDatabase();
    broadcastWs('marketplace:updated', { reason: 'review_moderated' });
    res.json({ review, provider, analytics: computePlatformAnalytics() });
  });

  app.patch('/api/admin/reports/:reportId', requireAuth, requireAdmin, (req, res) => {
    const report = dbState.reports.find((r) => r.id === req.params.reportId);
    if (!report) {
      res.status(404).json({ error: 'Denúncia não encontrada.' });
      return;
    }
    const { status, adminNotes } = req.body as {
      status?: ContentReport['status'];
      adminNotes?: string;
    };
    if (status && ['open', 'resolved', 'dismissed'].includes(status)) {
      report.status = status;
    }
    if (adminNotes !== undefined) {
      report.adminNotes = adminNotes.trim();
    }
    report.updatedAt = new Date().toISOString();
    saveDatabase();
    res.json({ report, analytics: computePlatformAnalytics() });
  });

  app.patch('/api/admin/settings', requireAuth, requireAdmin, (req, res) => {
    const body = req.body as Partial<PlatformSettings>;
    dbState.settings = {
      ...dbState.settings,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    saveDatabase();
    res.json({ settings: dbState.settings });
  });

  // Vite middleware in development, static dist serving in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kanimambo server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
