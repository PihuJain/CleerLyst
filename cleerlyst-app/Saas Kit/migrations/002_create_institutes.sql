-- ============================================================================
-- CLEERLYST MIGRATION 002: institutes
-- ============================================================================
-- Each institute represents a college / university onboarded onto Cleerlyst.
-- primary_domain is the canonical email domain (e.g. vitbhopal.ac.in).
-- allowed_domains lists every domain accepted for that institute.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS institutes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    primary_domain  TEXT NOT NULL,
    allowed_domains TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  institutes IS 'Onboarded institutes (colleges / universities)';
COMMENT ON COLUMN institutes.primary_domain  IS 'Canonical email domain for this institute';
COMMENT ON COLUMN institutes.allowed_domains IS 'All email domains accepted for this institute';

COMMIT;
