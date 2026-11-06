import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceKm,
  calculatePricingBreakdown,
  canSubmitReview,
  canTransitionRequestStatus,
  computeProviderRatingStats,
  filterAndSortServices,
  formatMzn,
  validateMozambiquePhone,
} from './marketplaceLogic.ts';
import type { ProviderService } from '../types/marketplace.ts';

test('formatMzn formats Mozambican Meticais cleanly', () => {
  assert.equal(formatMzn(1500), '1 500 MT');
  assert.equal(formatMzn(0), '0 MT');
  assert.equal(formatMzn(24500), '24 500 MT');
});

test('validateMozambiquePhone accepts valid +258 numbers and rejects invalid ones', () => {
  const valid84 = validateMozambiquePhone('+258 84 321 9876');
  assert.equal(valid84.valid, true);
  assert.equal(valid84.normalized, '+258 84 321 9876');

  const validLocal = validateMozambiquePhone('821234567');
  assert.equal(validLocal.valid, true);
  assert.equal(validLocal.normalized, '+258 82 123 4567');

  const invalidPrefix = validateMozambiquePhone('+258 71 123 4567');
  assert.equal(invalidPrefix.valid, false);

  const tooShort = validateMozambiquePhone('+258 84 123');
  assert.equal(tooShort.valid, false);
});

test('calculateDistanceKm computes realistic urban distance between Maputo neighborhoods', () => {
  // Polana Cimento to Baixa de Maputo (~2.3 km)
  const dist = calculateDistanceKm(-25.9665, 32.5920, -25.9752, 32.5715);
  assert.ok(dist > 1.5 && dist < 4.0, `Expected 1.5..4.0 km, got ${dist}`);

  // Same point = 0 km
  assert.equal(calculateDistanceKm(-25.9665, 32.5920, -25.9665, 32.5920), 0);
});

test('calculatePricingBreakdown handles provider location, free radius, and extra km rates', () => {
  // At provider location -> 0 transport fee
  const atSalon = calculatePricingBreakdown({
    pricingModel: 'fixed',
    basePriceMzn: 1200,
    transportFeeMzn: 250,
    freeTransportRadiusKm: 3,
    extraKmRateMzn: 50,
    locationMode: 'provider_location',
    distanceKm: 8,
  });
  assert.equal(atSalon.transportFeeMzn, 0);
  assert.equal(atSalon.estimatedTotalMzn, 1200);

  // Within free radius -> 0 transport fee
  const withinFree = calculatePricingBreakdown({
    pricingModel: 'fixed',
    basePriceMzn: 1200,
    transportFeeMzn: 250,
    freeTransportRadiusKm: 3,
    extraKmRateMzn: 50,
    locationMode: 'customer_location',
    distanceKm: 2.5,
  });
  assert.equal(withinFree.transportFeeMzn, 0);
  assert.equal(withinFree.freeRadiusApplied, true);
  assert.equal(withinFree.estimatedTotalMzn, 1200);

  // Beyond free radius (5 km vs 3 km free = 2 extra km * 50 + 250 base = 350 MT)
  const beyondFree = calculatePricingBreakdown({
    pricingModel: 'starting_from',
    basePriceMzn: 1500,
    transportFeeMzn: 250,
    freeTransportRadiusKm: 3,
    extraKmRateMzn: 50,
    locationMode: 'customer_location',
    distanceKm: 5,
  });
  assert.equal(beyondFree.transportFeeMzn, 350);
  assert.equal(beyondFree.estimatedTotalMzn, 1850);

  // Consultation pricing model
  const consult = calculatePricingBreakdown({
    pricingModel: 'consultation',
    basePriceMzn: 0,
    transportFeeMzn: 300,
    freeTransportRadiusKm: 2,
    extraKmRateMzn: 40,
    locationMode: 'customer_location',
    distanceKm: 4,
  });
  assert.equal(consult.isConsultation, true);
  assert.equal(consult.servicePriceMzn, 0);
  assert.equal(consult.transportFeeMzn, 380);
  assert.equal(consult.estimatedTotalMzn, 380);
});

test('canTransitionRequestStatus enforces 7-status workflow rules', () => {
  assert.equal(canTransitionRequestStatus('pending', 'accepted', 'provider').allowed, true);
  assert.equal(canTransitionRequestStatus('pending', 'rejected', 'provider').allowed, true);
  assert.equal(canTransitionRequestStatus('pending', 'completed', 'provider').allowed, false);
  assert.equal(canTransitionRequestStatus('accepted', 'confirmed', 'customer').allowed, true);
  assert.equal(canTransitionRequestStatus('confirmed', 'in_progress', 'provider').allowed, true);
  assert.equal(canTransitionRequestStatus('in_progress', 'completed', 'provider').allowed, true);
  assert.equal(canTransitionRequestStatus('completed', 'cancelled', 'customer').allowed, false);
});

test('canSubmitReview restricts reviews to completed requests by owning customer once', () => {
  assert.equal(
    canSubmitReview({
      requestStatus: 'pending',
      requestCustomerId: 'c1',
      actorUid: 'c1',
      existingReviewCountForRequest: 0,
      rating: 5,
      comment: 'Excelente atendimento!',
    }).allowed,
    false
  );

  assert.equal(
    canSubmitReview({
      requestStatus: 'completed',
      requestCustomerId: 'c1',
      actorUid: 'c2',
      existingReviewCountForRequest: 0,
      rating: 5,
      comment: 'Excelente atendimento!',
    }).allowed,
    false
  );

  assert.equal(
    canSubmitReview({
      requestStatus: 'completed',
      requestCustomerId: 'c1',
      actorUid: 'c1',
      existingReviewCountForRequest: 1,
      rating: 5,
      comment: 'Excelente atendimento!',
    }).allowed,
    false
  );

  assert.equal(
    canSubmitReview({
      requestStatus: 'completed',
      requestCustomerId: 'c1',
      actorUid: 'c1',
      existingReviewCountForRequest: 0,
      rating: 5,
      comment: 'Excelente atendimento!',
    }).allowed,
    true
  );
});

test('computeProviderRatingStats ignores moderated hidden reviews', () => {
  const stats = computeProviderRatingStats([
    { rating: 5, isModeratedHidden: false },
    { rating: 4, isModeratedHidden: false },
    { rating: 1, isModeratedHidden: true },
  ]);
  assert.equal(stats.reviewCount, 2);
  assert.equal(stats.averageRating, 4.5);
});

test('filterAndSortServices hides unavailable providers by default and sorts by distance/price', () => {
  const baseService: ProviderService = {
    id: 's1',
    providerId: 'p1',
    providerName: 'Salão Polana',
    providerAvatar: '',
    providerVerified: true,
    categoryId: 'cat-hair',
    categoryName: 'Penteados e Tranças',
    title: 'Tranças Box Braids',
    description: 'Tranças profissionais com acabamento limpo.',
    durationMinutes: 180,
    pricingModel: 'fixed',
    basePriceMzn: 2500,
    transportFeeMzn: 200,
    freeTransportRadiusKm: 3,
    extraKmRateMzn: 50,
    serviceLocationMode: 'both',
    imageUrl: '',
    isActive: true,
    providerAvailable: true,
    providerAvailabilityStatus: 'available',
    providerRating: 4.9,
    providerReviewCount: 14,
    city: 'Maputo',
    neighborhood: 'Polana Cimento',
    lat: -25.9665,
    lng: 32.5920,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };

  const unavailableService: ProviderService = {
    ...baseService,
    id: 's2',
    providerId: 'p2',
    providerName: 'Studio Matola',
    providerAvailable: false,
    providerAvailabilityStatus: 'unavailable',
    basePriceMzn: 1800,
    city: 'Matola',
    neighborhood: 'Matola A',
    lat: -25.9680,
    lng: 32.4630,
  };

  const availableOnly = filterAndSortServices([baseService, unavailableService], {
    onlyAvailable: true,
  });
  assert.equal(availableOnly.length, 1);
  assert.equal(availableOnly[0].id, 's1');

  const allServices = filterAndSortServices([baseService, unavailableService], {
    onlyAvailable: false,
    sortBy: 'price_asc',
  });
  assert.equal(allServices.length, 2);
  assert.equal(allServices[0].id, 's2');
});
