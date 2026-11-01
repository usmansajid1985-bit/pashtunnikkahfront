/** Client-safe Stripe pricing constants (no server imports). */

/** @deprecated kept only as a fallback default; real values come from getPlanSettings("gold") */
export const GOLD_MONTHLY_CREDITS = 10;
export const TOPUP_CREDITS = 5;
export const TOPUP_AMOUNT_PENCE = 699;

/** Shared "out of Match Tokens" copy, used in the Request Match popup, the Membership page and the
 * out-of-tokens upgrade popup so the wording is identical everywhere. */
export const OUT_OF_TOKENS_TITLE = "You've run out of Match Tokens";
export const OUT_OF_TOKENS_BODY =
  "You've used all your Match Tokens for this month. Buy more or wait until your next monthly allowance.";

/** "Buy 5 Match Tokens · £6.99" — the Gold top-up purchase button. */
export function topupButtonLabel(tokens: number = TOPUP_CREDITS, pricePence: number = TOPUP_AMOUNT_PENCE) {
  return `Buy ${tokens} Match Tokens · £${(pricePence / 100).toFixed(2)}`;
}
