import { NextResponse } from "next/server";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  const confirm = String(body.confirm ?? "");

  if (!currentPassword) {
    return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }
  if (newPassword !== confirm) {
    return NextResponse.json({ error: "New passwords do not match." }, { status: 400 });
  }

  const userId = BigInt(session.userId);
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { password_hash: true } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "New password must be different from your current password." },
      { status: 400 }
    );
  }

  const password_hash = await hashPassword(newPassword);
  await prisma.users.update({ where: { id: userId }, data: { password_hash, updated_at: new Date() } });

  return NextResponse.json({ ok: true });
}
