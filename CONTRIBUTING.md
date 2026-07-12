# Contributing to Cleerlyst

## Getting Started

1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env` and configure all variables
4. Run migrations: `npx ts-node scripts/migrate.ts`
5. Start dev server: `npm run dev`

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/).

```
type(scope): short clear summary
```

### Types

| Type | Use When |
|------|----------|
| `feat` | Adding new functionality |
| `fix` | Fixing a bug |
| `refactor` | Restructuring without behavior change |
| `chore` | Maintenance, dependency updates |
| `docs` | Documentation only |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `ci` | CI/CD pipeline changes |

### Scopes

Use the affected area: `admin`, `feed`, `api`, `auth`, `ui`, `db`, `security`, `repo`.

### Examples

```
feat(admin): implement dataset bulk publish controls
fix(feed): prevent null identifier_type crash in restricted branch
refactor(api): unify dataset routes under withApiHandler
docs: update architecture diagram for V3
```

### What Not to Do

- Vague messages: `"backend hardening - 6 phases"`
- Internal roadmap language: `"phases A-D, result semantics"`
- Philosophy: `"tightening and structural completeness"`

Commit messages describe **code changes**, not project plans.

## Branch Strategy

- `main`: stable, tagged releases only
- Feature branches: `v3-admin-control`, `feat/audit-log-viewer`, etc.
- Merge to `main` when stable, then tag the release

## Code Guidelines

- All API routes must use `withApiHandler`
- Never store identifiers in plain text
- Never modify existing migration files, add new ones instead
- Keep `lib/` modules focused and single-purpose
