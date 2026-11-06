# Security Specification — Kanimambo Marketplace

## 1. Data Invariants
1. **PII Isolation**: `/users/{userId}` contains `email`, `phone`, and `address` and is strictly readable only by `request.auth.uid == userId` or verified admins (`isAdmin()`). Public discovery queries `/public_providers/{providerId}`, which contains zero private PII.
2. **Identity Integrity**: Every write operation verifies `incoming().uid == request.auth.uid`, `incoming().providerId == request.auth.uid`, `incoming().customerId == request.auth.uid`, or `incoming().reporterUid == request.auth.uid` as appropriate.
3. **Self-Assigned Privilege Prevention**: Users cannot set `isVerified: true` on `/public_providers/{providerId}` or `isSuspended: true` on their own profile. Only verified admins (`isAdmin()`) may verify providers, suspend accounts, manage categories, or moderate reviews.
4. **Terminal State & Workflow Integrity**: A `service_request` is always created by the customer in `pending` status (`hasReview == false`). Once `completed`, `rejected`, or `cancelled`, status transitions are locked (except marking `hasReview: true` once when the customer submits a review on a `completed` request).
5. **Verified Completed-Request Review Rule**: A review in `/reviews/{reviewId}` can ONLY be created by the customer of a `completed` `service_request`, and providers cannot update or delete reviews.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Shadow Update on Provider Verification**: Authenticated provider sends `update` to `/public_providers/{uid}` including `isVerified: true` -> `PERMISSION_DENIED`.
2. **PII Blanket Read**: Authenticated non-owner sends `get` or `list` to `/users/{otherUid}` -> `PERMISSION_DENIED`.
3. **Email Spoofing Admin Bypass**: Unverified token (`email_verified == false`) with admin email attempts admin write -> `PERMISSION_DENIED`.
4. **Resource Poisoning via Oversized ID**: Client attempts write to `/provider_services/{200_char_id}` -> `PERMISSION_DENIED` (`isValidId`).
5. **Identity Spoofing on Service Request**: Customer A creates `/service_requests/{id}` with `customerId: "customerB"` -> `PERMISSION_DENIED`.
6. **Status Shortcutting on Create**: Customer creates `/service_requests/{id}` with `status: "completed"` -> `PERMISSION_DENIED`.
7. **Review Without Completed Request**: Customer creates `/reviews/{id}` referencing a `pending` request -> `PERMISSION_DENIED`.
8. **Provider Deleting Negative Review**: Provider calls `delete` on `/reviews/{reviewId}` -> `PERMISSION_DENIED`.
9. **Provider Editing Customer Review**: Provider calls `update` on `/reviews/{reviewId}` changing `rating` -> `PERMISSION_DENIED`.
10. **Cross-User Notification Read**: User A reads `/notifications/{notifOfUserB}` -> `PERMISSION_DENIED`.
11. **Value Poisoning on Rating**: Customer submits `/reviews/{id}` with `rating: 99` or `rating: "five"` -> `PERMISSION_DENIED`.
12. **Immortal Field Mutation**: User updates `/users/{uid}` changing `createdAt` -> `PERMISSION_DENIED`.
