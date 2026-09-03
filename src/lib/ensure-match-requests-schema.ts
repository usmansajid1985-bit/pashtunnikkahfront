import { ensureMatchEndSchema } from "@/lib/ensure-match-end-schema";
import { ensureP1Schema } from "@/lib/ensure-p1-schema";
import { ensureP2Schema } from "@/lib/ensure-p2-schema";

/** Run all lazy DDL for match_requests before any Prisma ORM read/write. */
export async function ensureMatchRequestsSchema() {
  await Promise.all([ensureMatchEndSchema(), ensureP1Schema(), ensureP2Schema()]);
}
