-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "admin_notes" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "admin_id" BIGINT NOT NULL,
    "note_text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "image_id" BIGINT,
    "cta_label" VARCHAR(100) NOT NULL DEFAULT '',
    "cta_url" VARCHAR(500) NOT NULL DEFAULT '',
    "type" VARCHAR(32) NOT NULL DEFAULT 'announcement',
    "roadmap_status" VARCHAR(32) NOT NULL DEFAULT 'planned',
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "publish_at" TIMESTAMPTZ(6),
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_slides" (
    "id" BIGINT NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "alt" VARCHAR(255) NOT NULL DEFAULT '',
    "slot" VARCHAR(32) NOT NULL DEFAULT 'hero',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" BIGINT NOT NULL,
    "blocker_id" BIGINT NOT NULL,
    "blocked_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" BIGINT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favourites" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "profile_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" VARCHAR(500),

    CONSTRAINT "favourites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flagged_messages" (
    "id" BIGINT NOT NULL,
    "message_id" BIGINT NOT NULL,
    "request_id" BIGINT NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "receiver_id" BIGINT NOT NULL,
    "original_text" TEXT NOT NULL,
    "filtered_text" TEXT NOT NULL,
    "reason" VARCHAR(50) NOT NULL DEFAULT '',
    "flagged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "flagged_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_warnings" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "request_id" BIGINT,
    "words" TEXT NOT NULL,
    "reason" VARCHAR(80) NOT NULL DEFAULT '',
    "warning_number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_leak_watch" (
    "user_id" BIGINT NOT NULL,
    "request_id" BIGINT NOT NULL,
    "buffer" TEXT NOT NULL,
    "remaining" INTEGER NOT NULL DEFAULT 0,
    "use_ai" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_leak_watch_pkey" PRIMARY KEY ("user_id","request_id")
);

-- CreateTable
CREATE TABLE "match_requests" (
    "id" BIGINT NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "receiver_id" BIGINT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "communication_mode" VARCHAR(32),
    "photo_shared" BOOLEAN NOT NULL DEFAULT false,
    "photo_shared_at" TIMESTAMPTZ(6),
    "photo_once_shared_at" TIMESTAMPTZ(6),
    "photo_once_viewed_at" TIMESTAMPTZ(6),
    "wali_handover_status" VARCHAR(32),
    "wali_details_requested_at" TIMESTAMPTZ(6),
    "wali_details_shared_at" TIMESTAMPTZ(6),
    "wali_contact_attempted_at" TIMESTAMPTZ(6),
    "wali_contact_confirmed_at" TIMESTAMPTZ(6),
    "wali_handover_note" TEXT,
    "ended_at" TIMESTAMPTZ(6),
    "ended_by" BIGINT,
    "end_reason" VARCHAR(32),
    "intro_message" VARCHAR(250),
    "wali_last_reminder_at" TIMESTAMPTZ(6),
    "wali_reminder_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "match_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browse_impressions" (
    "viewer_id" BIGINT NOT NULL,
    "shown_user_id" BIGINT NOT NULL,
    "times_shown" INTEGER NOT NULL DEFAULT 1,
    "last_shown_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_at" TIMESTAMPTZ(6),
    "skipped_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "browse_impressions_pkey" PRIMARY KEY ("viewer_id","shown_user_id")
);

-- CreateTable
CREATE TABLE "compatibility_cache" (
    "viewer_id" BIGINT NOT NULL,
    "candidate_user_id" BIGINT NOT NULL,
    "heuristic_score" INTEGER NOT NULL,
    "ai_score" INTEGER,
    "final_score" INTEGER NOT NULL,
    "ai_computed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compatibility_cache_pkey" PRIMARY KEY ("viewer_id","candidate_user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" BIGINT NOT NULL,
    "request_id" BIGINT NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "receiver_id" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagged_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reply_to_id" BIGINT,
    "message_type" VARCHAR(20) NOT NULL DEFAULT 'text',
    "metadata" JSONB,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" BIGSERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "emoji" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);