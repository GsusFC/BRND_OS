---
description: Comprehensive code review to ensure quality, security, and alignment with principles.
---

# Compound Engineering: Review

This workflow acts as an automated senior engineer reviewer.
Goal: "Quality compounds." - Catch issues early, enforce standards.

## 1. Scope Analysis
- [ ] **Identify Changes**: Look at the files changed (or ask user for target files).

## 2. Static Analysis & Standards
- [ ] **Read Files**: Read the content of the target files.
- [ ] **Check Rules**:
    - [ ] **Tailwind**: Are there arbitrary values (e.g., `w-[350px]`)? Suggest standard classes.
    - [ ] **React**: Is `useMemo`/`useCallback` used correctly? Are we using Server Components where possible?
    - [ ] **TypeScript**: Are there `any` types? Are interfaces defined?
    - [ ] **Hardcoding**: Are secrets or URLs hardcoded? (Should be in `.env`).
    - [ ] **Duplication**: Could this logic be shared? (But remember: *Prefer duplication over complexity* if abstraction is premature).

## 3. Specialized Agent Reviews

### 🏎️ Performance Oracle
*Focus: Speed, Efficiency, Scalability*
- [ ] **Database Queries**:
    - Check for **N+1 problems** (loops triggering queries).
    - Ensure indexes exist for filtered columns (`WHERE`, `JOIN`).
    - Verify `select` is used to fetch only needed fields (avoid `SELECT *`).
- [ ] **React/Next.js**:
    - Identify unnecessary re-renders.
    - Check for large client-side bundles (move to Server Components where possible).
    - Verify `next/image` usage and optimization.
    - Check for proper use of `React.cache` or `unstable_cache` for expensive data.

### 🛡️ Data Integrity Guardian
*Focus: Consistency, Safety, Schema*
- [ ] **Schema & Migrations**:
    - Is `schema.prisma` aligned with the code?
    - Are migrations safe (non-destructive)?
    - Check for missing Foreign Keys or constraints.
- [ ] **Transactions**:
    - Are multi-step writes wrapped in `$transaction`?
    - Is there a risk of "partial state" (zombie data)?
- [ ] **Validation**:
    - Is input validated (Zod) before reaching the DB?
    - Are types strictly defined (no casting `as any`)?

### 🏗️ Architecture Strategist
*Focus: Structure, Patterns, Long-term Health*
- [ ] **Separation of Concerns**:
    - UI components shouldn't contain complex business logic (use hooks or libs).
    - Database logic should live in `lib/` or Server Actions, not client components.
- [ ] **Next.js Patterns**:
    - Correct usage of **Server Actions** vs **API Routes**.
    - Proper error boundaries and loading states.
- [ ] **Code Reusability**:
    - Is this a one-off hack or a reusable pattern?
    - Does it follow the "Compound" principle (making future work easier)?

## 4. Documentation Check
- [ ] **Docs**: Does this change require updating `README.md` or `DATABASE_SCHEMA.md`?
- [ ] **Comments**: Are complex parts explained?

## 5. Report
- [ ] **Output**: detailed list of findings formatted as:
    - **Critical**: Must fix.
    - **Improvement**: Good to have.
    - **Question**: Clarification needed.
