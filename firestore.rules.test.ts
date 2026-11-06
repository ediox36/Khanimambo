import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

test('firestore.rules includes default-deny global safety net', () => {
  assert.match(rulesContent, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules enforces PII isolation on users collection', () => {
  assert.match(rulesContent, /match \/users\/\{userId\}[\s\S]*allow get: if isValidId\(userId\) && \(isOwner\(userId\) \|\| isAdmin\(\)\);/);
  assert.match(rulesContent, /match \/users\/\{userId\}[\s\S]*allow list: if isAdmin\(\);/);
});

test('firestore.rules prevents provider self-verification or rating tampering', () => {
  assert.match(
    rulesContent,
    /match \/public_providers\/\{providerId\}[\s\S]*incoming\(\)\.isVerified == false/
  );
  assert.match(
    rulesContent,
    /match \/public_providers\/\{providerId\}[\s\S]*affectedKeys\(\)\.hasOnly\(\[\s*'displayName', 'businessName', 'avatarUrl', 'bio', 'city',\s*'neighborhood', 'lat', 'lng', 'availabilityStatus',\s*'pauseReason', 'updatedAt'\s*\]\)/
  );
});

test('firestore.rules restricts reviews to completed requests and forbids provider deletion', () => {
  assert.match(
    rulesContent,
    /match \/reviews\/\{reviewId\}[\s\S]*\.data\.status == 'completed'/
  );
  assert.match(
    rulesContent,
    /match \/reviews\/\{reviewId\}[\s\S]*allow delete: if isValidId\(reviewId\) && isAdmin\(\);/
  );
});

test('firestore.rules enforces email_verified == true for writes and admin check', () => {
  assert.match(rulesContent, /function isVerifiedUser\(\) \{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;\s*\}/);
  assert.match(rulesContent, /function isAdmin\(\) \{\s*return isVerifiedUser\(\)/);
});
