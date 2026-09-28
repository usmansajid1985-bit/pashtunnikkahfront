import type { ReactNode } from "react";
import { getWaliSession } from "@/lib/wali";
import { waliTopic } from "@/lib/realtime-topics";
import { WaliRevocationGuard } from "@/components/wali/wali-revocation-guard";

export default async function WaliLayout({ children }: { children: ReactNode }) {
  const session = await getWaliSession();
  if (!session) return children;
  return <WaliRevocationGuard topic={waliTopic(session.linkId)}>{children}</WaliRevocationGuard>;
}
