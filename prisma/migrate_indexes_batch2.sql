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