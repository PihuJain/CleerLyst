# Cleerlyst — Vercel Deployment Checklist

## Step 1: Database Setup (Do This First)

### Recommended: Neon (neon.tech)

1. Create account at [neon.tech](https://neon.tech)
2. Create a new project (pick region closest to your users)
3. Copy the **pooled** connection string — it looks like:
   ```
   postgresql://user:password@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   The pooled URL contains `-pooler` in the hostname. **Use this one for Vercel.**
   Neon's connection pooler (PgBouncer) prevents serverless connection exhaustion.
4. Run migrations against the **direct** (non-pooled) connection:
   ```bash
   # Connect with psql or any SQL client and run:
   # Option A: All-in-one
   psql "your_direct_connection_string" -f sql-queries/00-complete-setup.sql

   # Option B: Individual migrations
   psql "your_direct_connection_string" -f migrations/001_extensions_and_enums.sql
   psql "your_direct_connection_string" -f migrations/002_create_institutes.sql
   psql "your_direct_connection_string" -f migrations/003_create_users.sql
   psql "your_direct_connection_string" -f migrations/004_create_user_identifiers.sql
   psql "your_direct_connection_string" -f migrations/005_create_datasets.sql
   psql "your_direct_connection_string" -f migrations/006_create_dataset_records.sql
   psql "your_direct_connection_string" -f migrations/007_create_notifications.sql
   psql "your_direct_connection_string" -f migrations/008_create_audit_logs.sql
   ```

### Verify Database

```sql
-- Extensions
SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';

-- Enum types
SELECT typname FROM pg_type WHERE typname IN (
  'user_role', 'identifier_type', 'dataset_type',
  'dataset_identifier_type', 'dataset_status', 'notification_type'
);

-- Tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Expected: institutes, users, user_identifiers, datasets,
--           dataset_records, notifications, audit_logs
```

---

## Step 2: Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project or select existing
3. APIs & Services → OAuth consent screen → Configure
4. APIs & Services → Credentials → Create OAuth 2.0 Client ID
5. Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://your-vercel-domain.vercel.app/api/auth/callback/google` (prod)
   - `https://your-custom-domain.com/api/auth/callback/google` (if using custom domain)
6. Copy **Client ID** and **Client Secret**

---

## Step 3: Generate Secrets

```bash
# NextAuth secret
openssl rand -base64 32

# Dataset encryption key (64 hex chars = 256 bits)
openssl rand -hex 32
```

**Write these down securely. You'll enter them in Vercel.**

---

## Step 4: Deploy to Vercel

### Import Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Set **Root Directory** to: `cleerlyst-app/Saas Kit`
4. Framework: **Next.js** (auto-detected)
5. Build Command: `npm run build` (default)
6. Output Directory: `.next` (default)
7. Node.js Version: **20.x** (Settings → General → Node.js Version)

### Environment Variables

In Vercel → Project Settings → Environment Variables, add **all of these**:

| Variable | Value | Environments |
|---|---|---|
| `DATABASE_URL` | `postgresql://...pooler...?sslmode=require` | Production, Preview |
| `DATASET_ENCRYPTION_KEY` | *(64 hex chars from Step 3)* | Production |
| `NEXT_PUBLIC_BASE_URL` | `https://your-domain.com` | Production |
| `NEXTAUTH_URL` | `https://your-domain.com` | Production |
| `NEXTAUTH_SECRET` | *(from Step 3)* | Production |
| `GOOGLE_CLIENT_ID` | *(from Step 2)* | Production, Preview |
| `GOOGLE_CLIENT_SECRET` | *(from Step 2)* | Production, Preview |

**Important:**
- `NEXT_PUBLIC_BASE_URL` and `NEXTAUTH_URL` must match your final domain (no trailing slash)
- Use the **pooled** DATABASE_URL (with `-pooler` in hostname)
- **Never** reuse the dev encryption key for production
- For Preview deployments, use a separate staging DB if possible

### Deploy

Click **Deploy**. Vercel will:
1. Install dependencies
2. Run `next build`
3. Deploy to `https://your-project.vercel.app`

---

## Step 5: Bootstrap (After First Deploy)

The admin user needs to log in once first (to create their user row), then get promoted.

### First: Log in as the admin

1. Visit `https://your-domain.com/auth/signin`
2. Sign in with the Google account you want as admin
3. This creates the user row in the database

### Then: Run bootstrap

```bash
DATABASE_URL="your_direct_connection_string" npx tsx scripts/bootstrap.ts \
  --name "Your Institute Name" \
  --domain "institute.edu" \
  --allowed-domains "institute.edu,mail.institute.edu" \
  --admin-email "admin@institute.edu"
```

You'll see:
```
=== Cleerlyst Bootstrap ===

[OK] Created institute: "Your Institute Name" (uuid-here)
[OK] Promoted user uuid-here to admin.
[OK] Audit log written.

=== Bootstrap complete ===
```

### Verify

1. Refresh the browser — admin should now see the Admin Panel link
2. Navigate to `/admin` — should load the admin dashboard
3. Navigate to `/admin/datasets` — should load the dataset list

---

## Step 6: Post-Deploy Verification

### Security Headers

```bash
curl -sI https://your-domain.com | grep -iE "(strict-transport|x-content-type|x-frame|referrer-policy|content-security|permissions-policy)"
```

Expected output:
```
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
permissions-policy: camera=(), microphone=(), geolocation=()
```

### Structured Logs

1. Go to Vercel → Project → Logs (Runtime Logs tab)
2. Trigger any API call (e.g. visit the dashboard)
3. Confirm log entries contain:
   - `requestId` — unique UUID
   - `actorUserId` — user ID or null
   - `event` — descriptive name
   - `route` — API path
   - **No plaintext emails, identifiers, or payload data**

### Full Test Flow

#### Admin

- [ ] Login with institute email
- [ ] `/admin` loads
- [ ] `/admin/datasets` loads
- [ ] Create dataset → success
- [ ] Upload CSV → shows inserted/skipped counts
- [ ] Publish → status changes to "published"
- [ ] Feed shows dataset (check as student or via `/api/me/feed`)
- [ ] Revoke → status changes to "revoked"
- [ ] Feed no longer shows it

#### Student

- [ ] Login with different institute email
- [ ] Dashboard loads
- [ ] `/dashboard/notifications` loads
- [ ] Open dataset link → see "Verification Result"
- [ ] Matched user sees data fields
- [ ] Unmatched user sees "No record available"
- [ ] Notification appears after viewing
- [ ] Mark notification as read → works

#### Security

- [ ] Non-admin cannot access `/admin/*` (redirected)
- [ ] Cross-institute dataset access returns `{ matched: false }`
- [ ] No student names/emails visible in admin panel
- [ ] No dataset_records data in any admin page
- [ ] Rate limiting works (spam `/api/datasets/{id}/me` → 429)
- [ ] `/api/me/feed` returns `[]` not 404 for empty results

---

## Vercel-Specific Gotchas

### Serverless Function Timeout
- Default: 10 seconds (Hobby), 60 seconds (Pro)
- Large CSV uploads may timeout on Hobby plan — consider Pro for production

### Connection Pooling
- The app is configured with `max: 1` connection per serverless instance
- **Always use the pooled connection string** from Neon/Supabase
- If you see "too many connections" errors, your DB plan may need upgrading

### Cold Starts
- First request after idle will be slower (serverless cold start)
- The `config.ts` validation runs on cold start — if env vars are wrong, the function crashes immediately with a clear error

### Environment Variable Changes
- After changing env vars in Vercel, you must **redeploy** for server-side changes to take effect
- `NEXT_PUBLIC_*` variables are baked into the client bundle at build time

### Custom Domain
- Vercel → Project Settings → Domains → Add your domain
- Update `NEXT_PUBLIC_BASE_URL` and `NEXTAUTH_URL` to match
- Update Google OAuth redirect URI to include the new domain
- Redeploy after domain change

---

## Rollback Plan

If something goes wrong after deploy:

1. **Vercel instant rollback**: Deployments tab → click any previous deployment → Promote to Production
2. **Database**: Neon supports branching — create a branch before risky migrations
3. **Encryption key**: If you lose the key, encrypted records are **unrecoverable** — back it up securely
