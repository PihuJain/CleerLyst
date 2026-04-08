-- ============================================================================
-- CLEERLYST MIGRATION 008: audit_logs
-- ============================================================================
-- Immutable log of every security-relevant action.
-- Log actions, NEVER payloads.
-- dataset_id is nullable — not all actions relate to a dataset.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    action          TEXT NOT NULL,
    dataset_id      UUID REFERENCES datasets (id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  audit_logs IS 'Immutable audit trail — actions only, never payloads';
COMMENT ON COLUMN audit_logs.action   IS 'Human-readable action key, e.g. dataset.publish, record.view';
COMMENT ON COLUMN audit_logs.metadata IS 'Contextual metadata (IP, user-agent, etc.) — never record content';

COMMIT;
