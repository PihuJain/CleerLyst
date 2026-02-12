-- ============================================================================
-- CLEERLYST MIGRATION 005: datasets
-- ============================================================================
-- A dataset is a batch of records uploaded by an admin (e.g. placement list).
-- visibility_config controls which fields students can see and how.
-- status lifecycle: draft → published → revoked.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS datasets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id      UUID NOT NULL REFERENCES institutes (id) ON DELETE RESTRICT,
    created_by        UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    type              dataset_type NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT,

    identifier_type   dataset_identifier_type NOT NULL,
    visibility_config JSONB NOT NULL DEFAULT '{}',
    expires_at        TIMESTAMPTZ,

    status            dataset_status NOT NULL DEFAULT 'draft',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at      TIMESTAMPTZ
);

-- Index for institute-scoped queries (admin dataset list, student feed)
CREATE INDEX IF NOT EXISTS idx_datasets_institute_id
    ON datasets (institute_id);

COMMENT ON TABLE  datasets IS 'Admin-uploaded datasets — placement lists, academic results, etc.';
COMMENT ON COLUMN datasets.created_by        IS 'Admin user who created this dataset';
COMMENT ON COLUMN datasets.identifier_type   IS 'Which identifier type is used for record matching';
COMMENT ON COLUMN datasets.visibility_config IS 'JSON: allowed_fields, phased_reveal, no_download, etc.';

COMMIT;
