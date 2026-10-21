/** "f" / "m" / "" from whatever is stored in profiles.gender ("Female", "Sister", "male", …). */
export function genderKey(g: string | null | undefined): "f" | "m" | "" {
  const v = (g || "").trim().toLowerCase();
  if (!v) return "";
  return v.startsWith("f") || v.startsWith("sister") || v.startsWith("w") ? "f" : "m";
}

/** True only when both genders are known and equal — unknowns never exclude anyone. */
export function sameGender(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = genderKey(a);
  const kb = genderKey(b);
  return Boolean(ka && kb && ka === kb);
}

/** Drop same-gender "viewed your profile" rows (old data from before views were filtered). */
export async function withoutSameGenderViews<T extends { type: string; actor_user_id: bigint | null }>(
  rows: T[],
  recipientUserId: bigint
): Promise<T[]> {
  const viewActors = [...new Set(rows.filter((r) => r.type === "profile_view" && r.actor_user_id).map((r) => r.actor_user_id!.toString()))];
  if (viewActors.length === 0) return rows;
  const { prisma } = await import("@/lib/prisma");
  const profiles = await prisma.profiles.findMany({
    where: { user_id: { in: [recipientUserId, ...viewActors.map((id) => BigInt(id))] } },
    select: { user_id: true, gender: true },
  });
  const g = new Map(profiles.map((p) => [p.user_id.toString(), p.gender]));
  const mine = g.get(recipientUserId.toString());
  return rows.filter((r) => !(r.type === "profile_view" && r.actor_user_id && sameGender(mine, g.get(r.actor_user_id.toString()))));
}
