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

-- CreateTable
CREATE TABLE "moderation_log" (
    "id" BIGINT NOT NULL,
    "legacy_post_id" BIGINT,
    "user_id" BIGINT,
    "action" VARCHAR(100) NOT NULL DEFAULT '',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "admin_id" BIGINT,

    CONSTRAINT "moderation_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "stripe_session_id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "plan_or_pack" VARCHAR(50) NOT NULL,
    "amount_pence" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_guardians" (
    "id" BIGSERIAL NOT NULL,
    "profile_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "name" VARCHAR(255),
    "contact" VARCHAR(128),
    "contact_code" VARCHAR(16),
    "email" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_views" (
    "id" BIGINT NOT NULL,
    "viewer_id" BIGINT NOT NULL,
    "viewed_id" BIGINT NOT NULL,
    "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "legacy_post_id" BIGINT,
    "profile_code" VARCHAR(32),
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "is_partial" BOOLEAN NOT NULL DEFAULT false,
    "warn_count" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(6),
    "full_name" VARCHAR(255),
    "gender" VARCHAR(32),
    "email" VARCHAR(255),
    "dob" DATE,
    "age" INTEGER,
    "height" VARCHAR(64),
    "weight" VARCHAR(64),
    "build" VARCHAR(64),
    "complexion" VARCHAR(64),
    "appearance" VARCHAR(128),
    "marital_status" VARCHAR(64),
    "has_children" VARCHAR(64),
    "children" VARCHAR(128),
    "wants_children" VARCHAR(64),
    "living_arrangements" VARCHAR(255),
    "disabilities" TEXT,
    "phone" VARCHAR(64),
    "phone_country_code" VARCHAR(16),
    "country" VARCHAR(128),
    "city" VARCHAR(128),
    "current_location" VARCHAR(255),
    "ancestral_village" VARCHAR(255),
    "family_origin" VARCHAR(255),
    "ethnicity" VARCHAR(128),
    "tribe" VARCHAR(128),
    "sub_tribe" VARCHAR(128),
    "khiel" VARCHAR(128),
    "legal_status" VARCHAR(64),
    "willing_to_relocate" VARCHAR(64),
    "relocate" VARCHAR(64),
    "pashto_speaker" VARCHAR(64),
    "pashto_level" VARCHAR(64),
    "home_language" VARCHAR(128),
    "dialect" VARCHAR(128),
    "father_name" VARCHAR(255),
    "father_occupation" VARCHAR(255),
    "brothers" INTEGER,
    "sisters" INTEGER,
    "education" VARCHAR(128),
    "field_of_study" VARCHAR(255),
    "occupation" VARCHAR(255),
    "religious_practice" VARCHAR(128),
    "religious_methodology" VARCHAR(128),
    "islamic_practice" TEXT,
    "practicing_since" TEXT,
    "salah_pattern" TEXT,
    "born_muslim" VARCHAR(64),
    "about_me" TEXT,
    "partner_preferences" TEXT,
    "open_to" TEXT,
    "age_pref_from" INTEGER,
    "age_pref_to" INTEGER,
    "height_preference" VARCHAR(128),
    "education_pref" VARCHAR(255),
    "appearance_pref" VARCHAR(255),
    "accept_widow" VARCHAR(16),
    "consider_divorcee" VARCHAR(16),
    "consider_disabilities" VARCHAR(16),
    "photo_status" VARCHAR(32),
    "photo_version" INTEGER,
    "interests" TEXT,
    "traits" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photo_url" VARCHAR(500),
    "photo_verification_url" VARCHAR(500),
    "location_lat" DOUBLE PRECISION,
    "location_lng" DOUBLE PRECISION,
    "location_city" VARCHAR(128),
    "location_region" VARCHAR(128),
    "location_country" VARCHAR(128),
    "location_country_code" VARCHAR(8),
    "location_radius_miles" INTEGER NOT NULL DEFAULT 50,
    "location_country_only" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wali_links" (
    "id" BIGSERIAL NOT NULL,
    "profile_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "relation" VARCHAR(64),
    "token" VARCHAR(64) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_accessed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wali_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "endpoint" TEXT NOT NULL,
    "p256dh_key" TEXT NOT NULL DEFAULT '',
    "auth_key" TEXT NOT NULL DEFAULT '',
    "user_agent" VARCHAR(255),
    "platform" VARCHAR(32),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "recipient_user_id" BIGINT NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "url" VARCHAR(500),
    "tag" VARCHAR(128),
    "related_request_id" BIGINT,
    "metadata" JSONB,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" BIGINT NOT NULL,
    "referrer_id" BIGINT NOT NULL,
    "referee_id" BIGINT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" BIGINT NOT NULL,
    "reporter_id" BIGINT NOT NULL,
    "reported_id" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "stripe_subscription_id" VARCHAR(255) NOT NULL DEFAULT '',
    "stripe_payment_intent_id" VARCHAR(255) NOT NULL DEFAULT '',
    "plan" VARCHAR(50) NOT NULL DEFAULT 'gold',
    "amount_pence" INTEGER NOT NULL DEFAULT 0,
    "subscription_started_at" TIMESTAMPTZ(6) NOT NULL,
    "refund_eligible" BOOLEAN NOT NULL DEFAULT true,
    "refund_eligibility_lost_at" TIMESTAMPTZ(6),
    "refund_ineligible_reason" VARCHAR(255),
    "refund_requested_at" TIMESTAMPTZ(6),
    "refund_status" VARCHAR(30),
    "refund_processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_events" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGINT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL DEFAULT '',
    "display_name" VARCHAR(255) NOT NULL DEFAULT '',
    "role" VARCHAR(32) NOT NULL DEFAULT 'user',
    "account_status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "sms_verified" BOOLEAN NOT NULL DEFAULT false,
    "cultural_verified" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "founding_member" BOOLEAN NOT NULL DEFAULT false,
    "legacy_member" BOOLEAN NOT NULL DEFAULT false,
    "trust_level" INTEGER NOT NULL DEFAULT 0,
    "referral_code" VARCHAR(64),
    "stripe_customer_id" VARCHAR(255),
    "plan" VARCHAR(50),
    "subscription_status" VARCHAR(50),
    "stripe_subscription_id" VARCHAR(255),
    "requests_remaining" INTEGER NOT NULL DEFAULT 0,
    "nudges_remaining" INTEGER NOT NULL DEFAULT 0,
    "free_starter_credits" INTEGER NOT NULL DEFAULT 0,
    "free_starter_awarded" BOOLEAN NOT NULL DEFAULT false,
    "female_mode" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "deletion_requested_at" TIMESTAMPTZ(6),
    "deletion_reason" TEXT,
    "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_security" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "totp_secret" VARCHAR(64),
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_type" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(64) NOT NULL,
    "related_request_id" BIGINT,
    "related_payment_id" BIGINT,
    "admin_id" BIGINT,
    "previous_balance" INTEGER NOT NULL,
    "new_balance" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_settings" (
    "id" BIGSERIAL NOT NULL,
    "plan" VARCHAR(32) NOT NULL,
    "monthly_credits" INTEGER NOT NULL,
    "rollover_cap" INTEGER NOT NULL DEFAULT 0,
    "max_balance" INTEGER NOT NULL,
    "pending_request_limit" INTEGER NOT NULL,
    "request_expiry_days" INTEGER NOT NULL DEFAULT 7,
    "saved_profile_limit" INTEGER,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_id_blocked_id_key" ON "blocks"("blocker_id", "blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_email_key" ON "email_verifications"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "idx_password_resets_user" ON "password_resets"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "favourites_user_id_profile_user_id_key" ON "favourites"("user_id", "profile_user_id");

-- CreateIndex
CREATE INDEX "idx_match_requests_receiver" ON "match_requests"("receiver_id", "status");

-- CreateIndex
CREATE INDEX "idx_match_requests_sender" ON "match_requests"("sender_id", "status");

-- CreateIndex
CREATE INDEX "idx_browse_impressions_viewer_shown" ON "browse_impressions"("viewer_id", "last_shown_at" DESC);

-- CreateIndex
CREATE INDEX "idx_compatibility_cache_viewer" ON "compatibility_cache"("viewer_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_messages_receiver_unread" ON "messages"("receiver_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_messages_request" ON "messages"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_message_reactions_message" ON "message_reactions"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_message_id_user_id_key" ON "message_reactions"("message_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_session_id_key" ON "payments"("stripe_session_id");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE INDEX "idx_payments_user" ON "payments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_guardians_profile_id_key" ON "profile_guardians"("profile_id");

-- CreateIndex
CREATE INDEX "idx_profile_views_viewed" ON "profile_views"("viewed_id", "viewed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_profiles_age" ON "profiles"("age");

-- CreateIndex
CREATE INDEX "idx_profiles_code" ON "profiles"("profile_code");

-- CreateIndex
CREATE INDEX "idx_profiles_country_city" ON "profiles"("country", "city");

-- CreateIndex
CREATE INDEX "idx_profiles_gender" ON "profiles"("gender");

-- CreateIndex
CREATE INDEX "idx_profiles_marital" ON "profiles"("marital_status");

-- CreateIndex
CREATE INDEX "idx_profiles_status" ON "profiles"("status");

-- CreateIndex
CREATE INDEX "idx_profiles_tribe" ON "profiles"("tribe");

-- CreateIndex
CREATE INDEX "idx_profiles_location" ON "profiles"("location_lat", "location_lng");

-- CreateIndex
CREATE UNIQUE INDEX "wali_links_token_key" ON "wali_links"("token");

-- CreateIndex
CREATE INDEX "idx_wali_links_user" ON "wali_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "idx_notifications_recipient" ON "notifications"("recipient_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrer_id_referee_id_key" ON "referrals"("referrer_id", "referee_id");

-- CreateIndex
CREATE INDEX "idx_subscriptions_user" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_events_user" ON "user_events"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_last_seen" ON "users"("last_seen_at" DESC);

-- CreateIndex
CREATE INDEX "idx_users_plan" ON "users"("plan");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "admin_security_user_id_key" ON "admin_security"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_idempotency_key_key" ON "credit_ledger"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_credit_ledger_user" ON "credit_ledger"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "plan_settings_plan_key" ON "plan_settings"("plan");

