# BRND_OS Environment Variables

This audit is based on environment-variable references observed in `src/`, `prisma/`, `scripts/`, `next.config.ts`, `netlify.toml`, and `package.json`. It documents current implementation behavior, not desired future configuration.

## Summary

### Observed facts

- `env_template` previously documented only a subset of referenced variables.
- `.env.example` did not exist before this audit.
- `AUTH_SECRET` had a concrete-looking value in `env_template`; it has been replaced with a placeholder.
- `prisma/schema.indexer.prisma` requires `INDEXER_DATABASE_URL`.
- `prisma/schema.prisma` requires `MYSQL_DATABASE_URL` and references `MYSQL_SHADOW_DATABASE_URL`.
- The indexer client requires `INDEXER_DATABASE_URL` to include a `schema=` query param when indexer access is enabled.
- Several `NEXT_PUBLIC_*` variables are intentionally exposed to browser code.
- `NODE_ENV`, `NETLIFY`, `COMMIT_REF`, `CONTEXT`, `REVIEW_ID`, `DEPLOY_PRIME_URL`, and `npm_lifecycle_event` are platform/tooling variables, not app secrets.

### Inferences

- A full local development setup for dashboard work normally needs auth, Turso, Redis, and either an enabled indexer or explicit disabled flags.
- A production setup that serves onchain dashboard data needs the indexer, Turso, Redis, auth, and Web3 RPC variables to be valid.

### Existing documentation conflicts

- Some docs mention `.env.example`, but the repository previously had only `env_template`.
- `REDIS_MIGRATION_SUMMARY.md` mentions `REDIS_CACHE_ENABLED`; no runtime reference to `REDIS_CACHE_ENABLED` was found in the audited files.
- `netlify.toml` defines `NODE_VERSION` and `NPM_FLAGS` for Netlify, but app code does not read them via `process.env`.

## Required For Local Development

Minimum to start and authenticate locally:

- `AUTH_SECRET`
- `AUTH_URL` or `NEXTAUTH_URL`
- `ADMIN_PASSWORD` or a configured external auth path
- `ALLOWED_FIDS` if using allowlisted FID login behavior

Usually required for useful dashboard work:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `TURSO_ALLOWLIST_DATABASE_URL`
- `TURSO_ALLOWLIST_AUTH_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Required only for specific local flows:

- Season 2 live indexer views: `INDEXER_DISABLED=false` and `INDEXER_DATABASE_URL`
- Legacy/S1 fallbacks: `MYSQL_DISABLED=false` and `MYSQL_DATABASE_URL`
- Apply/token-gated wallet flow: `BASE_RPC_URL`, Redis variables, and Turso allowlist variables
- Onchain create/update publishing: `INDEXER_API_KEY`, `BASE_RPC_URL`, public Base RPC variables, and wallet project ID variables
- Intelligence: `GEMINI_API_KEY` or `OPENAI_API_KEY` depending on implementation path used
- Farcaster/Neynar enrichment: `NEYNAR_API_KEY`
- Logo upload: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_KEY`

## Production-Critical Variables

These appear production-critical for the current application if the corresponding subsystem is enabled:

- `AUTH_SECRET` / `NEXTAUTH_SECRET`
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `TURSO_ALLOWLIST_DATABASE_URL`, `TURSO_ALLOWLIST_AUTH_TOKEN`
- `INDEXER_DATABASE_URL` when `INDEXER_DISABLED` is not `true`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `BASE_RPC_URL`, `NEXT_PUBLIC_BASE_RPC_URL`, `NEXT_PUBLIC_BASE_RPC_URLS`
- `INDEXER_API_KEY` for prepare-metadata/onchain publishing
- `ADMIN_PASSWORD` and/or `ALLOWED_FIDS` for admin login paths
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` if Google login is expected
- `NEYNAR_API_KEY` if Farcaster enrichment is expected
- `GEMINI_API_KEY` if intelligence is enabled with Gemini
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_KEY` if image upload is enabled

## Audit Findings

### Referenced but undocumented before this audit

These were referenced in code/config but were not present in the previous `env_template`:

`ADMIN_PASSWORD`, `ALLOWED_FIDS`, `BACKEND_API_BASE_URL`, `BASE_RPC_URL`, `COMMIT_REF`, `CONTEXT`, `DEPLOY_PRIME_URL`, `DISABLE_ONCHAIN_GATING`, `GEMINI_API_KEY`, `INDEXER_API_KEY`, `INDEXER_DISABLED`, `INDEXER_SOURCE`, `MYSQL_DATABASE_URL_WRITE`, `MYSQL_DISABLED`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_RPC_URL`, `NEXT_PUBLIC_BASE_RPC_URLS`, `NEXT_PUBLIC_DISABLE_ONCHAIN_GATING`, `NEXT_PUBLIC_FARCASTER_RELAY_URL`, `NEXT_PUBLIC_FARCASTER_RPC_URL`, `NEXT_PUBLIC_MAINNET_RPC_URL`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEYNAR_API_KEY`, `NEYNAR_TIMEOUT_MS`, `NODE_ENV`, `OPENAI_API_KEY`, `RATE_LIMIT_ENABLED`, `READONLY_DATABASE_URL`, `REDIS_DEBUG`, `REVIEW_ID`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`, `npm_lifecycle_event`.

### Variables in previous env template with no runtime reference

None found. All variables from the previous `env_template` are referenced by code, Prisma schema, or scripts.

### Variables mentioned in docs/config but not read by app code

- `REDIS_CACHE_ENABLED`: mentioned in Redis docs, no runtime reference found.
- `NODE_VERSION`: defined in `netlify.toml` build environment for platform behavior.
- `NPM_FLAGS`: defined in `netlify.toml` build environment for platform behavior.

## Variable Reference

Required values are conditional because many subsystems can be disabled or are used only by specific routes/scripts.

### Auth

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `AUTH_SECRET` | NextAuth JWT/session secret; middleware and auth fallback read it. | Required for runtime auth unless `NEXTAUTH_SECRET` is used. | Server runtime, build fallback logic | Dev, prod, runtime | `replace-with-random-base64-secret` |
| `NEXTAUTH_SECRET` | Legacy/alternate secret name used as fallback. | Optional if `AUTH_SECRET` is set. | Server runtime | Dev, prod, runtime | `replace-with-random-base64-secret` |
| `AUTH_URL` | Canonical auth/application URL; used for Farcaster domain fallback. | Recommended. | Server runtime | Dev, prod, runtime | `http://localhost:3000` |
| `NEXTAUTH_URL` | Alternate canonical auth URL fallback. | Optional if `AUTH_URL` is set. | Server runtime | Dev, prod, runtime | `https://cntr.brnd.land` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. | Required only for Google login. | Server runtime | Dev, prod, runtime | `1234567890-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. | Required only for Google login. | Server runtime secret | Dev, prod, runtime | `google-client-secret` |
| `ADMIN_PASSWORD` | Password credential path for Farcaster/admin login. | Required if password auth is used. | Server runtime secret | Dev, prod, runtime | `replace-with-strong-password` |
| `ALLOWED_FIDS` | Comma-separated FID allowlist for auth/admin elevation checks. | Optional, but important for allowlist login behavior. | Server runtime | Dev, prod, runtime | `123,456` |
| `RATE_LIMIT_ENABLED` | Disables auth rate limiting when set to `false`. | Optional; defaults to enabled outside development. | Server runtime | Prod runtime | `true` |

### Turso / libSQL

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `TURSO_DATABASE_URL` | Main operational libSQL DB for brands, applications, admin users, metrics, caches, materializations. | Required for most dashboard/admin flows. | Server runtime, scripts | Dev, prod, runtime | `libsql://example-org-example.turso.io` |
| `TURSO_AUTH_TOKEN` | Auth token for main Turso DB. | Required with `TURSO_DATABASE_URL`. | Server runtime secret, scripts | Dev, prod, runtime | `turso-token` |
| `TURSO_ALLOWLIST_DATABASE_URL` | Separate libSQL DB for wallet allowlist and token gate settings. | Required for allowlist/token gate/apply flows. | Server runtime | Dev, prod, runtime | `libsql://example-org-allowlist.turso.io` |
| `TURSO_ALLOWLIST_AUTH_TOKEN` | Auth token for allowlist/settings Turso DB. | Required with `TURSO_ALLOWLIST_DATABASE_URL`. | Server runtime secret | Dev, prod, runtime | `turso-allowlist-token` |

### Postgres Indexer

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `INDEXER_DATABASE_URL` | Postgres indexer connection for Season 2 read-side data. Must include `schema=` when enabled. | Required when `INDEXER_DISABLED` is not `true`. | Server runtime, Prisma, scripts | Dev, prod, build/scripts | `postgresql://user:pass@host:5432/db?sslmode=require&schema=production` |
| `INDEXER_DISABLED` | Disables indexer reads and uses stubs/empty data in several paths. | Optional; defaults vary by code path. | Server runtime, build | Dev, prod, build/runtime | `true` or `false` |
| `INDEXER_API_KEY` | Bearer token for external backend prepare-metadata endpoint. | Required for onchain metadata preparation. | Server runtime secret | Dev, prod, runtime | `indexer-api-key` |
| `INDEXER_SOURCE` | Source header for external backend prepare-metadata endpoint. | Optional; defaults to `ponder-stories-in-motion-v8`. | Server runtime | Dev, prod, runtime | `ponder-stories-in-motion-v8` |
| `BACKEND_API_BASE_URL` | External backend base URL for metadata preparation. | Optional; defaults to Railway URL in code. | Server runtime | Dev, prod, runtime | `https://api.example.com` |

### MySQL Legacy

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `MYSQL_DATABASE_URL` | Legacy MySQL connection for Season 1 data, metadata fallback, snapshots, and default Prisma schema. | Required when MySQL fallback/S1 scripts are enabled. | Server runtime, Prisma, scripts | Dev, prod, scripts | `mysql://user:pass@host:3306/db` |
| `MYSQL_DATABASE_URL_WRITE` | Optional write URL for category sync script; falls back to `MYSQL_DATABASE_URL`. | Optional. | Script runtime | Scripts | `mysql://user:pass@host:3306/db` |
| `MYSQL_SHADOW_DATABASE_URL` | Shadow DB for Prisma migrate/dev/diff. | Required only for Prisma migrate workflows. | Prisma tooling | Dev/build tooling | `mysql://user:pass@host:3306/shadow_db` |
| `MYSQL_DISABLED` | Disables MySQL-dependent fallback paths in several modules. | Optional. | Server runtime | Dev, prod, runtime | `true` or `false` |
| `READONLY_DATABASE_URL` | Alternate read-only DB URL used by `src/lib/prisma-read.ts`. | Optional; only required where that client is used. | Server runtime | Runtime | `mysql://user:pass@host:3306/db` |

### Redis / Upstash

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint for cache, rate limits, locks, wallet nonces. | Required for Redis-backed flows; some paths degrade without it. | Server runtime | Dev, prod, runtime | `https://example.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token. | Required with `UPSTASH_REDIS_REST_URL`. | Server runtime secret | Dev, prod, runtime | `upstash-token` |
| `REDIS_DEBUG` | Enables extra Redis/cache debug logging in metadata enrichment modules. | Optional. | Server runtime | Dev/runtime | `false` |

### AI Providers

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `GEMINI_API_KEY` | Gemini API key for SQL generation, summaries, suggestions, analysis posts. | Required for active Gemini intelligence flow. | Server runtime secret | Dev, prod, runtime | `gemini-api-key` |
| `OPENAI_API_KEY` | OpenAI API key for alternate helper in `src/lib/openai.ts`. | Optional unless OpenAI helper path is used. | Server runtime secret | Dev, prod, runtime | `sk-...` |

### Web3 / Base

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `BASE_RPC_URL` | Server-side Base RPC URL for token balance verification in apply flow. | Required unless onchain gating is disabled. | Server runtime | Dev, prod, runtime | `https://mainnet.base.org` |
| `NEXT_PUBLIC_BASE_RPC_URL` | Browser/client Base RPC fallback. | Optional but recommended for Web3 UI. | Public client + server components | Dev, prod, runtime | `https://mainnet.base.org` |
| `NEXT_PUBLIC_BASE_RPC_URLS` | Comma-separated Base RPC URLs for fallback attempts. | Optional. | Public client + server components | Dev, prod, runtime | `https://rpc1.example,https://rpc2.example` |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | Ethereum mainnet RPC URL for wagmi mainnet transport. | Optional; code has publicnode fallback. | Public client | Dev, prod, runtime | `https://ethereum.publicnode.com` |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Reown/WalletConnect project ID. | Optional; code has fallback project ID. | Public client | Dev, prod, runtime | `reown-project-id` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Alternate WalletConnect project ID fallback. | Optional if `NEXT_PUBLIC_REOWN_PROJECT_ID` is set. | Public client | Dev, prod, runtime | `walletconnect-project-id` |
| `NEXT_PUBLIC_APP_URL` | Public app URL used in wallet metadata and Farcaster auth provider config. | Recommended. | Public client | Dev, prod, runtime | `http://localhost:3000` |
| `DISABLE_ONCHAIN_GATING` | Server flag to bypass token balance gating in apply flow. | Optional; should be deliberate. | Server runtime | Dev, prod, runtime | `false` |
| `NEXT_PUBLIC_DISABLE_ONCHAIN_GATING` | Public UI flag for disabled onchain gating state. | Optional. | Public client | Dev, prod, runtime | `false` |

### Farcaster / Neynar

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_FARCASTER_RPC_URL` | Farcaster auth client Ethereum RPC URL; defaults to Optimism mainnet. | Optional. | Public client/provider config | Dev, prod, runtime | `https://mainnet.optimism.io` |
| `NEXT_PUBLIC_FARCASTER_RELAY_URL` | Farcaster auth relay URL; defaults to official relay. | Optional. | Public client/provider config | Dev, prod, runtime | `https://relay.farcaster.xyz` |
| `NEYNAR_API_KEY` | Neynar API key for Farcaster user/channel enrichment. | Required for Neynar fetches. | Server runtime secret | Dev, prod, runtime | `neynar-api-key` |
| `NEYNAR_TIMEOUT_MS` | Neynar fetch timeout in milliseconds. | Optional; defaults to `4000`. | Server runtime | Dev, prod, runtime | `4000` |

### Images / Storage

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID for Images upload API. | Required for logo uploads. | Server runtime | Dev, prod, runtime | `cloudflare-account-id` |
| `CLOUDFLARE_IMAGES_API_KEY` | Cloudflare Images API token. | Required for logo uploads. | Server runtime secret | Dev, prod, runtime | `cloudflare-images-token` |
| `PINATA_GATEWAY_TOKEN` | Token for Pinata IPFS gateway requests for NFT/metadata images. | Optional; public gateways are fallback in some metadata paths. | Server runtime | Dev, prod, runtime | `pinata-gateway-token` |

### Google Sheets / Snapshots

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `BRANDS_SHEET_ID` | Google Sheet ID for brand snapshot/admin sheet import. | Optional; code has default sheet ID. | Server route, scripts | Dev, prod, scripts/runtime | `14gyWsl5RKuh1KohELC3zZbeW1Ywrtjd6x9T3jWqWhmI` |
| `BRANDS_SHEET_GID` | Google Sheet gid/tab for brand snapshot/admin sheet import. | Optional; defaults to `0`. | Server route, scripts | Dev, prod, scripts/runtime | `0` |

### Deployment / Build

| Variable | Purpose | Required | Runtime scope | Used in | Safe example |
| --- | --- | --- | --- | --- | --- |
| `NETLIFY` | Enables Netlify-specific standalone output and changes Prisma generation script behavior. | Provided by Netlify; optional locally. | Build/runtime config | Build | `true` |
| `NODE_ENV` | Controls development/production behavior, Prisma logs, indexer stub defaults, Next runtime behavior. | Provided by Node/Next; normally not set manually except scripts. | Build/runtime | Dev, prod, build/runtime | `development` or `production` |
| `COMMIT_REF` | Deployment metadata returned by admin indexer diagnostics route. | Optional/platform-provided. | Server runtime diagnostics | Prod/runtime | `abcdef123` |
| `CONTEXT` | Deployment context returned by admin indexer diagnostics route. | Optional/platform-provided. | Server runtime diagnostics | Prod/runtime | `production` |
| `REVIEW_ID` | Deployment review ID returned by admin indexer diagnostics route. | Optional/platform-provided. | Server runtime diagnostics | Prod/runtime | `123` |
| `DEPLOY_PRIME_URL` | Deployment URL returned by admin indexer diagnostics route. | Optional/platform-provided. | Server runtime diagnostics | Prod/runtime | `https://deploy-preview.example.netlify.app` |
| `npm_lifecycle_event` | npm lifecycle event used by auth code to permit build-only secret fallback. | Provided by npm; do not set manually. | Build tooling | Build | `build` |

## Source Trace

Primary audited files include:

- `src/auth.ts`
- `src/middleware.ts`
- `src/config/wagmi.ts`
- `src/context/FarcasterProvider.tsx`
- `src/lib/prisma*.ts`
- `src/lib/turso*.ts`
- `src/lib/redis.ts`
- `src/lib/actions/brand-actions.ts`
- `src/lib/gemini.ts`
- `src/lib/openai.ts`
- `src/lib/neynar.ts`
- `src/lib/intelligence/*`
- `src/lib/seasons/**`
- `src/app/api/**`
- `src/components/dashboard/*OnchainPanel.tsx`
- `prisma/schema*.prisma`
- `scripts/*`
- `next.config.ts`
- `netlify.toml`
- `package.json`
