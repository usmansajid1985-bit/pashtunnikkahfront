/** The optional message sent with a Match Request: up to 30 words (shared by the form and the API). */
export const INTRO_MAX_WORDS = 30;
/** A hard ceiling on length so 30 very long "words" can't become an essay. */
export const INTRO_MAX_CHARS = 300;

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Null when the message is within the limits, otherwise the reason to show. */
export function introMessageProblem(text: string): string | null {
  if (countWords(text) > INTRO_MAX_WORDS) return `Your introduction message can be at most ${INTRO_MAX_WORDS} words.`;
  if (text.length > INTRO_MAX_CHARS) return "Your introduction message is too long — please shorten it.";
  return null;
}
