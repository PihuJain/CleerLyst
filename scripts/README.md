# Database Scripts

Tooling for initializing and migrating the Cleerlyst database.

## Files

### `bootstrap.ts`

Initializes the database from scratch: creates required extensions, enums, and base schema.

Used during first-time setup of a new environment.

### `migrate.ts`

Runs SQL migration files from `migrations/` in sequence.

Tracks which migrations have already been applied and only runs new ones.

## Usage

```bash
# Fresh setup
npx ts-node scripts/bootstrap.ts

# Apply pending migrations
npx ts-node scripts/migrate.ts
```
