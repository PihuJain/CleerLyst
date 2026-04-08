-- ============================================================================
-- CLEERLYST MIGRATION 006: dataset_records
-- ============================================================================
-- Each row is one encrypted record inside a dataset.
--
-- ABSOLUTE RULES (from spec):
--   • No foreign key to users — records are NEVER joined to users.
--   • Lookup is ONLY via identifier_hash.
--   • Payload is encrypted at rest (bytea). Backend decrypts on match.
--   • No SELECT * from this table anywhere in application code.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS dataset_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id        UUID NOT NULL REFERENCES datasets (id) ON DELETE CASCADE,
    identifier_hash   TEXT NOT NULL,
    encrypted_payload BYTEA NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The ONLY search index on this table.
CREATE INDEX IF NOT EXISTS idx_dataset_records_identifier_hash
    ON dataset_records (identifier_hash);

COMMENT ON TABLE  dataset_records IS 'Encrypted per-identity records — no FK to users, no joins allowed';
COMMENT ON COLUMN dataset_records.identifier_hash   IS 'Hash used for identity-bound lookup — no plaintext';
COMMENT ON COLUMN dataset_records.encrypted_payload IS 'AES-encrypted JSON payload — decrypted only on verified match';

COMMIT;
