# Database Migrations

Contains ordered SQL migration files that define the complete schema evolution of Cleerlyst.

## Purpose

- Define schema evolution incrementally
- Enable fresh environment setup from scratch
- Track constraint hardening history
- Support on-premise and multi-region deployments

## Files

| Migration | Description |
|-----------|------------|
| `001` | Extensions and enums |
| `002` | Institutes table |
| `003` | Users table |
| `004` | User identifiers |
| `005` | Datasets table |
| `006` | Dataset records |
| `007` | Notifications |
| `008` | Audit logs |
| `009` | User identifier constraints |
| `010` | Encrypted identifier column |
| `011` | Dataset headers |
| `012` | Unique dataset identifier |
| `013` | Audience type (restricted/public) |
| `014` | Public dataset constraints |
| `015` | Constraint tightening |

## Rules

- **Never modify** an existing migration file.
- Always add new migrations with the next sequential number.
- Run via `npm run migrate` or apply manually in order.
