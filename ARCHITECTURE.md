# Architecture

## System Overview

Cleerlyst is a multi-tenant platform for secure institutional dataset publishing. It enables universities and academic departments to publish identity-bound records (placement results, academic lists) with privacy-first access control.

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
│          Landing / Dashboard / Admin Panel           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   Edge Middleware                     │
│         Auth gating · Route protection               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│               Next.js App Router                     │
│   Server Pages · API Routes · Server Actions         │
└──────────┬───────────┬──────────────────────────────┘
           │           │
┌──────────▼───┐ ┌─────▼──────────────────────────────┐
│   NextAuth   │ │         Core Library (lib/)          │
│  Google SSO  │ │  Database · Encryption · Identifier  │
│  Session     │ │  Errors · Logger · Rate Limiter      │
└──────────────┘ └─────────────┬──────────────────────┘
                               │
                 ┌─────────────▼──────────────────────┐
                 │       PostgreSQL (Neon)              │
                 │  Institute-isolated · Encrypted      │
                 └─────────────────────────────────────┘
```

## Multi-Tenant Design

Each institution is logically isolated via:

- **Institute ID**: all queries are scoped by institute
- **Per-institute salt**: identifier hashing uses unique salts to prevent cross-institute correlation
- **Segregated dataset queries**: users from one institute cannot access another's data

## Dataset Lifecycle

```
Draft → [upload records] → [configure visibility] → Published → Revoked
  │                                                      │
  └── Headers locked after first upload                  └── Revoke prevents all access
      Upload disabled after headers set
      Publish requires visibility config
```

**Key invariants:**
- Schema (headers) are locked after first record upload
- Publishing requires both records and visibility configuration
- Only `draft` datasets can be published
- Only `published` datasets can be revoked
- Students see only `published` datasets in the feed

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Identity | SHA-256 salted hashing, identifiers never stored in plain text |
| Data | AES-256-GCM encryption, records encrypted at rest and decrypted only on matched access |
| Access | No bulk listing, no enumeration, no reverse lookup |
| Isolation | Institute-level data segregation |
| Audit | Structured logging of publish, revoke, and visibility changes |
| Errors | Production error masking, 500s never expose internals |

## API Layering

All API routes use a unified `withApiHandler` wrapper that provides:

- Structured error handling (`AppError` taxonomy)
- Rate limiting
- Request context injection
- Consistent JSON response format

### Route Groups

| Prefix | Purpose |
|--------|---------|
| `/api/admin/` | Institute management, dataset CRUD, audit logs |
| `/api/auth/` | NextAuth authentication endpoints |
| `/api/datasets/` | Public dataset queries |
| `/api/me/` | Current user profile, identifiers, notifications |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Neon-compatible) |
| Auth | NextAuth (Google OAuth) |
| Styling | Tailwind CSS + Framer Motion |
| Deployment | Vercel |
