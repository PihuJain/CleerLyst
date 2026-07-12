# Cleerlyst

Cleerlyst is a secure institutional platform for publishing academic datasets with controlled visibility.

It replaces public spreadsheets and PDF lists with a private, identity-aware result system designed for universities and academic departments.

Live demo: https://cleerlystpihu.vercel.app

---

## 1. Executive Overview

Cleerlyst enables institutions to:

- Publish placement results securely
- Share academic lists privately
- Control visibility per dataset
- Avoid public roll-number exposure
- Maintain audit-level accountability

Students only see records that apply to them.

---

## 2. Institutional Integration Model

Cleerlyst can be deployed in three ways:

### A. Standalone Portal

Hosted independently and accessed via institutional login (e.g., Google Workspace with domain restriction).

### B. Subdomain Deployment

Example: `results.university.edu`

Integrated via reverse proxy or DNS mapping. The application runs on its own infrastructure; the institution points a subdomain to it.

### C. Embedded Integration

Cleerlyst can be embedded within an existing university student dashboard using:

- SSO (Single Sign-On) via NextAuth provider adapters (LDAP, Azure AD, Google Workspace, custom auth)
- JWT-based session validation
- API-based data exchange

Custom university ID systems (e.g., registration number, student ID, enrollment number) can be configured as identifier types. The platform supports configurable identifier types per institute.

---

## 3. Multi-Institution Architecture

Each institution is logically isolated via:

- Dedicated institute ID
- Salted identifier hashing (per-institute salt prevents cross-institute correlation)
- Segregated dataset queries
- Domain-based routing (optional)

Universities may operate under:

- Custom domain
- White-labeled deployment
- Branded UI layer

---

## 4. Security Model

- **SHA-256 salted identifier hashing**: identifiers (e.g., registration numbers) are never stored in plain text. Matching is done via one-way hashes with institute-specific salts.
- **AES-256-GCM encrypted payload storage**: all sensitive dataset records are encrypted at rest. Decryption only happens when serving a matched result to the authorised user.
- **No public exposure of identifiers**: no bulk listing, no enumeration, no reverse lookup.
- **Institute-level data isolation**: users from one institute cannot access data from another.
- **Structured audit logging**: publish, revoke and visibility changes are all logged for accountability.
- **Production error masking**: sensitive error details are never exposed to clients.

Cleerlyst does not store raw student identifiers in plain text.

---

## 5. Tech Stack

- Next.js 15 (App Router)
- TypeScript
- PostgreSQL (Neon-compatible)
- Tailwind CSS
- Framer Motion
- NextAuth
- Vercel (deployment-ready)

---

## 6. Installation & Deployment

### Requirements

- PostgreSQL database
- Node.js 18+
- Environment variables configured (see below)

### Steps

1. Clone the repository and navigate to the project directory.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in all required variables.
4. Run migrations: `npm run migrate` (or apply SQL migrations manually from `migrations/`).
5. Run `npm run dev` for local development, or deploy to Vercel.

### Database Migrations

Migrations are in `migrations/` and should be applied in order. Use `npm run migrate` or run the SQL files manually against your database.

---

## 7. Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for session encryption |
| `NEXTAUTH_URL` | Base URL of the application (e.g. `https://cleerlyst.example.com`) |
| `NEXT_PUBLIC_BASE_URL` | Same as NEXTAUTH_URL for production |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for institute-domain login) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `DATASET_ENCRYPTION_KEY` | 64-character hex key for AES-256-GCM (generate with `openssl rand -hex 32`) |

---

## 8. Production Deployment

- Deploy via Vercel: connect the repository, set the root directory to `/`, and configure environment variables.
- Requires production `DATABASE_URL` and `DATASET_ENCRYPTION_KEY`.
- Migrations must be applied to the production database before first use.
- Ensure `NEXTAUTH_URL` and `NEXT_PUBLIC_BASE_URL` match the production domain.

---

## 9. Business Model

Cleerlyst operates on a freemium model:

**Free Tier**

- Limited datasets per month
- Basic public and restricted publishing

**Subscription Tier**

- Unlimited datasets
- Advanced audit logs
- Institutional branding
- Custom domain
- SSO integration

**Enterprise Tier**

- On-premise deployment
- Dedicated infrastructure
- SLA support
- Custom compliance requirements

---

## 10. Scalability & Market Scope

Cleerlyst targets:

- Universities
- Placement cells
- Academic departments
- Professional institutions
- Examination boards

The platform can expand into:

- Transcript publishing
- Certification verification
- Placement tracking
- Internal notices
- Alumni verification portals

---

## 11. Repository Structure

```
cleerlyst/
├── src/               → Application source code
├── migrations/        → SQL schema evolution files
├── scripts/           → Migration runner & bootstrap tools
├── public/            → Static assets
├── ARCHITECTURE.md    → System design & security model
├── CONTRIBUTING.md    → Commit convention & dev guidelines
├── package.json
├── next.config.ts
├── tsconfig.json
├── .env.example
└── README.md
```

Each major folder contains its own `README.md` with detailed documentation.

---

## 12. License

Private. All rights reserved.
