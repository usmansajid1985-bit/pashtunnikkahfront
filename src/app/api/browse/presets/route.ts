import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { DEFAULT_FILTERS, type BrowseFilters } from "@/lib/browse-filters-shared";
import {
  deleteFilterPreset,
  ensureP2Schema,
  listFilterPresets,
  saveFilterPreset,
} from "@/lib/ensure-p2-schema";
import { prisma } from "@/lib/prisma";

function stripPresetFilters(raw: unknown): Partial<BrowseFilters> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    ageMin: typeof o.ageMin === "number" ? o.ageMin : DEFAULT_FILTERS.ageMin,
    ageMax: typeof o.ageMax === "number" ? o.ageMax : DEFAULT_FILTERS.ageMax,
    country: String(o.country ?? ""),
    city: String(o.city ?? ""),
    marital: String(o.marital ?? ""),
    sect: String(o.sect ?? ""),
    practice: String(o.practice ?? ""),
    tribe: String(o.tribe ?? ""),
    relocate: String(o.relocate ?? ""),
    salah: String(o.salah ?? ""),
    appearance: String(o.appearance ?? ""),
    education: String(o.education ?? ""),
    dialect: String(o.dialect ?? ""),
    ancestral: String(o.ancestral ?? ""),
    height: String(o.height ?? ""),
    occupation: String(o.occupation ?? ""),
    language: String(o.language ?? ""),
    dress: String(o.dress ?? ""),
    interests: String(o.interests ?? ""),
    goldOnly: Boolean(o.goldOnly),
    newMembers: Boolean(o.newMembers),
    recentlyActive: Boolean(o.recentlyActive),
    near: Boolean(o.near),
    sort:
      o.sort === "recently_active" || o.sort === "age_asc" || o.sort === "age_desc"
        ? o.sort
        : "newest",
    page: 1,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { plan: true } });
  if ((user?.plan ?? "").toLowerCase() !== "gold") {
    return NextResponse.json({ error: "Gold membership required." }, { status: 403 });
  }

  await ensureP2Schema();
  const rows = await listFilterPresets(userId);
  return NextResponse.json({
    presets: rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      filters: stripPresetFilters(r.filters),
      updatedAt: r.updated_at.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { plan: true } });
  if ((user?.plan ?? "").toLowerCase() !== "gold") {
    return NextResponse.json({ error: "Gold membership required." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string; filters?: unknown };
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Preset name required." }, { status: 400 });

  const filters = stripPresetFilters(body.filters);
  const { page: _p, ...stored } = filters;
  await saveFilterPreset(userId, name, stored);
  return NextResponse.json({ ok: true, name });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { plan: true } });
  if ((user?.plan ?? "").toLowerCase() !== "gold") {
    return NextResponse.json({ error: "Gold membership required." }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Preset id required." }, { status: 400 });

  await deleteFilterPreset(userId, BigInt(id));
  return NextResponse.json({ ok: true });
}
