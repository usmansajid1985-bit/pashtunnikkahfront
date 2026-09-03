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