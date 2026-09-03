import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureP2Schema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS hide_gold_badge BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS rematch_tokens_remaining INT NOT NULL DEFAULT 0
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS browse_filter_presets (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name VARCHAR(80) NOT NULL,
        filters JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, name)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_browse_filter_presets_user
        ON browse_filter_presets (user_id, updated_at DESC)
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE match_requests
        ADD COLUMN IF NOT EXISTS prior_match_id BIGINT
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE plan_settings
        ADD COLUMN IF NOT EXISTS rematch_tokens_per_cycle INT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS rematch_max_stack INT NOT NULL DEFAULT 2
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS rematch_token_ledger (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        amount INT NOT NULL,
        reason VARCHAR(64) NOT NULL,
        previous_balance INT NOT NULL,
        new_balance INT NOT NULL,
        related_request_id BIGINT,
        idempotency_key VARCHAR(128),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (idempotency_key)
      )
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureP2Schema", err);
  }
}

export async function readHideGoldBadge(userId: bigint): Promise<boolean> {
  await ensureP2Schema();
  const rows = await prisma.$queryRaw<{ hide_gold_badge: boolean }[]>`
    SELECT COALESCE(hide_gold_badge, false) AS hide_gold_badge
    FROM users WHERE id = ${userId}
  `.catch(() => [] as { hide_gold_badge: boolean }[]);
  return Boolean(rows[0]?.hide_gold_badge);
}

export async function setHideGoldBadge(userId: bigint, hide: boolean) {
  await ensureP2Schema();
  await prisma.$executeRaw`
    UPDATE users SET hide_gold_badge = ${hide}, updated_at = NOW()
    WHERE id = ${userId}
  `;
}

export type FilterPresetRow = {
  id: bigint;
  name: string;
  filters: unknown;
  updated_at: Date;
};

export async function listFilterPresets(userId: bigint): Promise<FilterPresetRow[]> {
  await ensureP2Schema();
  return prisma.$queryRaw<FilterPresetRow[]>`
    SELECT id, name, filters, updated_at
    FROM browse_filter_presets
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `.catch(() => []);
}

export async function saveFilterPreset(userId: bigint, name: string, filters: object) {
  await ensureP2Schema();
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO browse_filter_presets (user_id, name, filters, created_at, updated_at)
    VALUES (${userId}, ${name}, ${JSON.stringify(filters)}::jsonb, ${now}, ${now})
    ON CONFLICT (user_id, name)
    DO UPDATE SET filters = EXCLUDED.filters, updated_at = ${now}
  `;
}

export async function deleteFilterPreset(userId: bigint, presetId: bigint) {
  await ensureP2Schema();
  await prisma.$executeRaw`
    DELETE FROM browse_filter_presets
    WHERE id = ${presetId} AND user_id = ${userId}
  `;
}
