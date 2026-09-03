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