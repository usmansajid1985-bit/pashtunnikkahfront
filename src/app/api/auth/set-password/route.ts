import { NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json();
  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? "");

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (password !== confirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const password_hash = await hashPassword(password);
  await prisma.users.update({
    where: { id: BigInt(session.userId) },
    data: { password_hash, updated_at: new Date() },
  });

  return NextResponse.json({ ok: true, redirectTo: "/browse" });
}
