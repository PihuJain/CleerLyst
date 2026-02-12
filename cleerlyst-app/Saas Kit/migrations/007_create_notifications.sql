-- ============================================================================
-- CLEERLYST MIGRATION 007: notifications
-- ============================================================================
-- User-facing notifications tied to datasets.
-- read_at is NULL until the user opens / acknowledges the notification.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    dataset_id  UUID NOT NULL REFERENCES datasets (id) ON DELETE CASCADE,
    type        notification_type NOT NULL,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Required for ON CONFLICT (user_id, dataset_id, type) DO NOTHING
    UNIQUE (user_id, dataset_id, type)
);

-- Index for user-scoped queries (notification center)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications (user_id, created_at DESC);

COMMENT ON TABLE notifications IS 'Per-user notifications for dataset events';

COMMIT;
