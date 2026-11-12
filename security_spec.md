# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Identity Integrity**: Every user document `/users/{userId}` and private document `/users/{userId}/private/{docId}` must have `uid == userId` and `userId == request.auth.uid`.
2. **PII Isolation**: `/users/{userId}` contains zero PII (no email, phone, or CV). All sensitive data (email, CV attachment, private mission/shop state) is strictly isolated inside `/users/{userId}/private/{docId}` where only the owner (`request.auth.uid == userId`) or a verified admin can read/write, and only when `/users/$(userId)` exists (Master Gate).
3. **Admin Moderation Gate**: User-submitted events in `/user_events/{eventId}` must be created with `status == 'pending'` and `creatorUid == request.auth.uid`. Only an admin (`isAdmin()`) can transition `status` to `'approved'` or `'rejected'`. Once `status == 'rejected'`, non-admins are locked out of updates (Terminal State Locking).
4. **Strict Key & Size Enforcement**: Every `create` operation enforces `hasAll` and `hasOnly` on keys. Every `update` operation wraps logic with `isValid[Entity](incoming())` and restricts mutated fields via `affectedKeys().hasOnly(...)`. Every string has explicit `.size()` bounds.
5. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must match `request.time`, and `createdAt` is immutable on update.
6. **Verified User Requirement**: All writes require `isVerifiedUser()` (`request.auth != null && request.auth.token.email_verified == true`).

## 2. The "Dirty Dozen" Payloads (Adversarial Test Cases)
1. **Shadow Field Injection on User Profile**: Creating `/users/user_1` with `{ ..., "isAdmin": true }` -> Rejected by `hasOnly()`.
2. **Unverified Email Admin Spoof**: Calling admin update with `email == 'jold0214@gmail.com'` but `email_verified == false` -> Rejected by `isAdmin()`.
3. **Cross-User Private CV Read (PII Leak)**: `user_2` attempting `get` on `/users/user_1/private/main` -> Rejected by `isOwner(userId)`.
4. **Orphaned Subcollection Write**: Creating `/users/user_1/private/main` when parent `/users/user_1` does not exist -> Rejected by Master Gate `exists(/databases/$(database)/documents/users/$(userId))`.
5. **Self-Approved Event Creation**: User creating `/user_events/ev_1` with `status: 'approved'` -> Rejected because non-admin create mandates `incoming().status == 'pending'`.
6. **Privilege Escalation on Event Update**: Event creator updating `status` from `'pending'` to `'approved'` -> Rejected because creator action branch forbids `status` changes.
7. **Terminal State Bypass**: Creator attempting to update an event whose existing `status` is `'rejected'` -> Rejected by Terminal State Lock `existing().status != 'rejected'`.
8. **ID Poisoning Attack**: Creating document with 500-character ID or invalid characters (`$`, `/`, spaces) -> Rejected by `isValidId()`.
9. **Value Poisoning / Oversized Payload**: Updating `bio` with a 10,000-character string -> Rejected by `isValidUserPublicProfile(incoming())` (`bio.size() <= 600`).
10. **Timestamp Forgery**: Creating a registration with a past or future `createdAt` instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
11. **Immutable Field Mutation**: Updating `creatorUid` or `createdAt` on `/user_events/{eventId}` -> Rejected by immutability checks.
12. **Blanket List Query Scraping**: Listing `/event_registrations` or `/job_applications` without filtering by `resource.data.userUid == request.auth.uid` -> Rejected by Query Enforcer in `allow list`.
