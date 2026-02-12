# Cleerlyst Database Setup

> **Replaces** the original SaaS Kit schema. The old schema stored plaintext
> email, google\_id, credits, and Stripe fields — all removed.

## Quick start

Run the all-in-one file against a **fresh** PostgreSQL database:

```
psql $DATABASE_URL -f sql-queries/00-complete-setup.sql
```

Or run the individual migration files in order:

```
psql $DATABASE_URL -f migrations/001_extensions_and_enums.sql
psql $DATABASE_URL -f migrations/002_create_institutes.sql
psql $DATABASE_URL -f migrations/003_create_users.sql
psql $DATABASE_URL -f migrations/004_create_user_identifiers.sql
psql $DATABASE_URL -f migrations/005_create_datasets.sql
psql $DATABASE_URL -f migrations/006_create_dataset_records.sql
psql $DATABASE_URL -f migrations/007_create_notifications.sql
psql $DATABASE_URL -f migrations/008_create_audit_logs.sql
```

Then verify:

```
psql $DATABASE_URL -f sql-queries/05-verify-setup.sql
```

## Schema invariants

| Rule | Enforced by |
|---|---|
| No plaintext email stored | `users` has `email_hash` only, no `email` column |
| No plaintext identifiers | `user_identifiers` / `dataset_records` store hashes only |
| No FK from records to users | `dataset_records` references `datasets`, never `users` |
| No `SELECT *` | All application queries list columns explicitly |
| Only search index: `identifier_hash` | Single index on `dataset_records.identifier_hash` |

## Deprecated files

Files `01` through `04` and `06` raise an exception if executed.
They exist only as documentation of what was removed and why.
