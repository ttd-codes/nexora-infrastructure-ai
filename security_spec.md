# NEXORA Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Tenant Ownership**: Every domain document (`locations`, `assets`, `maintenanceRecords`, `documents`, `recommendations`, `notifications`, `ruleConfigs`) must carry `ownerUid == request.auth.uid` on creation and preserve `ownerUid` immutably on update.
2. **Email Verification Mandate**: Standard reads/writes require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Zero Self-Escalation**: Users creating their profile in `/users/{userId}` can only assign non-privileged roles (`engineer`, `technician`, `viewer`) unless authenticated as the bootstrapped admin (`thiviyadarshan2007@gmail.com`) or listed in `/admins/{uid}`.
4. **Immutable Provenance**: `createdAt` and `ownerUid` are immutable after creation; `createdAt == request.time` on create and `updatedAt == request.time` on update.
5. **Bounded Types & Sizes**: All document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars); all strings and arrays enforce explicit `.size()` bounds.

## 2. Dirty Dozen Attack Vectors (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/assets/{assetId}` -> DENIED.
2. Unverified email write on `/assets/{assetId}` -> DENIED.
3. Forged `ownerUid` on create in `/maintenanceRecords/{recordId}` -> DENIED.
4. Cross-tenant `list` query without matching `ownerUid` -> DENIED.
5. Cross-tenant `get` on `/users/{otherUserId}` (PII leak) -> DENIED.
6. Self-escalation setting `role: "admin"` in `/users/{uid}` -> DENIED.
7. Shadow update injecting extra undeclared field `isVerified: true` -> DENIED.
8. Mutating `ownerUid` or `createdAt` during an `update` -> DENIED.
9. Oversized document ID (`> 128` chars or invalid chars) -> DENIED.
10. Unbounded array (`components.size() > 25`) or oversized description (`> 3000` chars) -> DENIED.
11. Client-forged timestamp (`createdAt != request.time`) -> DENIED.
12. Creating a `maintenanceRecord` referencing an `assetId` that does not exist or belongs to another user -> DENIED.
