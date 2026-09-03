import { NextResponse } from "next/server";
import { WALI_COOKIE } from "@/lib/wali";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(WALI_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
