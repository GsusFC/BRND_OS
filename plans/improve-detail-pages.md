# Plan: Improve User and Brand Detail Pages

## Summary
Improve robustness, error handling, and UX of User and Brand detail pages. Fix data loading issues where data might be missing or causing crashes.

## Context
User reports that some data doesn't load or doesn't exist on these pages.
Code analysis reveals:
- **User Page (`src/app/dashboard/users/[id]/page.tsx`)**:
    - `parseBrandIds` throws errors on invalid JSON, potentially crashing the page.
    - Minimal empty states.
- **Brand Page (`src/app/dashboard/brands/[id]/page.tsx`)**:
    - `brandVoteWhere` relies on string matching for JSON arrays, which is fragile.
    - Neynar data fetching logic is complex.

## Goals
- Prevent page crashes due to malformed data.
- Improve handling of missing metadata (Farcaster/MySQL).
- Enhance empty states for missing data.
- Optimize data fetching where possible.

## Implementation Steps

### 1. User Detail Page (`src/app/dashboard/users/[id]/page.tsx`)
- [ ] **Fix `parseBrandIds`**: Make it safe (try-catch, return default/empty) instead of throwing.
- [ ] **Improve Metadata Enrichment**: Ensure `getBrandsMetadata` handles missing brands gracefully.
- [ ] **UI Enhancements**:
    - Add fallback for missing user photo/username.
    - Improve "No podiums" state.
    - Check if `user` is null handling is sufficient (currently 404s).

### 2. Brand Detail Page (`src/app/dashboard/brands/[id]/page.tsx`)
- [ ] **Fix `brandVoteWhere`**: Review query performance. While schema is limited, ensure patterns cover all cases (e.g. single item array `[1]`).
- [ ] **Neynar Data**:
    - Ensure `channelId` normalization is robust.
    - handle cases where `fetchChannelByIdCached` returns error gracefully.
- [ ] **UI Enhancements**:
    - Fallbacks for missing logos/descriptions.
    - Better empty states for Withdrawals and Casts.

### 3. Shared/General
- [ ] **Verification**: Ensure `next/image` usage is correct.
- [ ] **Error Boundaries**: Consider adding page-level `error.tsx` if not present (Next.js handles this, but custom UI is better).

## Verification
- Visit a User page with known votes.
- Visit a User page with NO votes.
- Visit a Brand page with votes and metadata.
- Visit a Brand page without metadata (only onchain).
