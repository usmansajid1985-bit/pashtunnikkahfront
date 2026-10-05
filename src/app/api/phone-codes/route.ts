import { NextResponse } from "next/server";
import { getPhoneCountryCodes } from "@/lib/phone-codes";

export const dynamic = "force-dynamic";

/** Public: the dial codes offered on the signup phone step, pinned countries first. */
export async function GET() {
  return NextResponse.json({ codes: await getPhoneCountryCodes() });
}
