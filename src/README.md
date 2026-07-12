# Application Source

## Directory Structure

### `app/`

Next.js App Router: pages and API routes.

| Directory | Purpose |
|-----------|---------|
| `admin/` | Institute admin dashboard |
| `api/` | REST API endpoints (admin, auth, datasets, user) |
| `auth/` | Authentication pages |
| `dashboard/` | Student dashboard |
| `datasets/` | Dataset views |
| `demo/` | Demo environment |
| `docs/` | Documentation pages |
| `privacy/` | Privacy policy |
| `terms/` | Terms of use |

### `components/`

Reusable UI components, organized by feature area.

| Directory | Purpose |
|-----------|---------|
| `admin/` | Admin panel components |
| `auth/` | Login, session UI |
| `dashboard/` | Student dashboard widgets |
| `landing/` | Public landing page sections |
| `profile/` | User profile components |
| `ui/` | Shared design system (buttons, cards, modals, etc.) |

### `lib/`

Core business logic and infrastructure.

| Module | Purpose |
|--------|---------|
| `auth.ts` | NextAuth configuration |
| `database.ts` | Query layer and data access |
| `encryption.ts` | AES-256-GCM record encryption |
| `identifier.ts` | SHA-256 salted identifier hashing |
| `api-handler.ts` | Unified API route wrapper |
| `errors.ts` | AppError taxonomy |
| `logger.ts` | Structured logging |
| `rate-limiter.ts` | Request rate limiting |
| `config.ts` | Environment configuration |

### `hooks/`

Client-side React hooks.

### `types/`

Shared TypeScript type definitions.

### `middleware.ts`

Edge middleware for auth and routing.
