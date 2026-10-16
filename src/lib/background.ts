import { after } from "next/server";

/**
 * Run work after the response is sent — and keep the serverless function alive until it's done.
 * A bare `void promise` is NOT enough on Vercel: the function can be frozen as soon as the
 * response goes out, so pushes and emails were silently dropped (match-request push QA fail).
 */
export function inBackground(label: string, task: () => Promise<unknown>): void {
  const run = () => task().catch((err) => console.error(`[background] ${label} failed`, err));
  try {
    after(run);
  } catch {
    // Outside a request (scripts/tests) there is no `after` — just run it.
    void run();
  }
}
