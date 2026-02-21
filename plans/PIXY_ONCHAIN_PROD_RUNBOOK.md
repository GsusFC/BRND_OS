# Pixy Onchain Update - Production Runbook

## Scope
- Environment: `https://cntr.brnd.land`
- Goal: validate complete `Update Onchain` flow for Pixy:
1. wallet signature
2. tx sent (`updateBrand`)
3. receipt confirmation
4. DB sync + UI reflection

## Preconditions
- Admin account logged in.
- Injected wallet connected (MetaMask/Coinbase extension), Base chain selected.
- Wallet is authorized admin on contract (`isAdmin=true` in panel).
- Target brand selected: Pixy (confirm `brandId` in panel context).

## Evidence to collect (required)
- Connected wallet address.
- Tx hash (from wallet or UI logs).
- Receipt confirmation time (seconds from submit to mined).
- Final UI message (`Brand updated onchain.` or detailed failure).
- Browser console telemetry entries with prefix `[onchain-observability]`.

## Happy path procedure
1. Open dashboard and select Pixy in `Update Onchain`.
2. Apply a controlled non-breaking edit (for example description suffix).
3. Click `Update Onchain`.
4. Approve wallet signature.
5. Wait for `signing -> confirming -> idle`.
6. Confirm success message and refresh view.
7. Verify persisted values in table/detail.
8. Optional integrity check: verify tx on Base explorer and match metadata hash.

## Failure diagnosis by stage

### 1) Signature timeout
- UI message: wallet signature timed out with injected-wallet guidance.
- Event expected: `update_onchain_signing_timeout`.
- Checks:
  - wallet pop-up focused and unlocked
  - no WalletConnect fallback active
  - extension permissions allowed for site

### 2) Receipt timeout / RPC congestion
- UI message references tx hash (if available) and possible pending confirmation.
- Event expected: `update_onchain_receipt_timeout`.
- Checks:
  - inspect tx hash on explorer
  - retry after congestion
  - compare failing `rpcUsed` from telemetry

### 3) DB sync failed after onchain success
- UI message starts with `Onchain updated, but DB sync failed...`.
- Event expected: `update_onchain_db_sync_failed` with `code`.
- Codes:
  - `DB_CONN`: DB connectivity problem
  - `VALIDATION`: server payload validation mismatch
  - `NOT_FOUND`: brand missing in DB
  - `UNKNOWN`: fallback bucket

### 4) Permission regression
- UI blocks before signing with unauthorized/admin status message.
- No tx hash should be emitted.

## Console telemetry contract
All critical events are logged with:
- `event`
- `brandId`
- `fid`
- `connectedAddress`
- `chainId`
- `rpcUsed`
- `txHash`
- `elapsedMs`
- optional `code`, `reason`

Events:
- `update_onchain_start`
- `update_onchain_tx_sent`
- `update_onchain_signing_timeout`
- `update_onchain_receipt_timeout`
- `update_onchain_db_sync_failed`
- `update_onchain_success`

## Acceptance checklist
- At least one successful Pixy update in production using injected wallet.
- Confirmed tx hash and receipt captured.
- DB sync succeeded and UI reflects updated values after refresh.
- In any failure case, telemetry + UI message identifies stage in under 10 minutes.
