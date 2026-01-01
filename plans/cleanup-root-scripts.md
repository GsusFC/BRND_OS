# Plan: Cleanup Root Scripts

## Summary
Move utility scripts from the project root to `scripts/` to declutter the workspace and improve project organization.

## Context
The root directory currently contains over 10 utility scripts (e.g., `check-brands.js`, `test-connection.js`) mixed with configuration files. This makes it harder to find critical config files and violates the "Place for everything" principle.

## Goals
- Clean up the root directory.
- Group related maintenance/test scripts in `scripts/`.
- Ensure `package.json` scripts are updated to point to the new locations.

## Implementation Steps
- [x] **Move Files**: Move the following files to `scripts/`:
    - `check-brands.js`
    - `check-columns.js`
    - `check-tables.js`
    - `fetch-categories.js`
    - `generate-categories-sql.js`
    - `insert-categories.sql`
    - `list-models.js`
    - `sync-categories-direct.js`
    - `sync-categories-direct.mjs`
    - `sync-categories.ts`
    - `test-auth.js`
    - `test-connection-safe.js`
    - `test-direct-mysql.js`
    - `test-prod-connection.js`
- [x] **Update package.json**: Check `package.json` for any "scripts" that reference these files and update the paths.
    - *Note: No scripts in package.json referenced these files directly.*
    - *Note: Fixed relative imports in `sync-categories.ts` and `sync-categories-direct.mjs`.*
    - *Note: Made paths relative in `sync-categories-direct.js`.*
- [ ] **Verification**: Run `npm run lint` (if applicable) or manually check a couple of moved scripts to ensure they can find `.env`.

## Verification
- Root directory should only contain config files and documentation.
- `scripts/` should contain the moved utilities.
