/**
 * Chat message rules. Pure functions (no server imports) so the composer can share them.
 *
 * The rules judge what a message is *doing*, not which words it contains: talking about Instagram
 * is fine, asking for someone's Instagram is not. Every 2026-10 QA prompt lives in
 * `scripts/test-chat-moderation.mjs` — run `npm run test:moderation` after changing anything here.
 */

export type BlockCategory = "contact" | "abuse" | "threat" | "sexual";

export type LeakVerdict = {
  hit: boolean;
  /** Worth a second look (AI screen / split-message watch) even though no rule fired. */
  suspect: boolean;
  /** Fine-grained rule names, e.g. "phone", "contact_request", "threat". */
  reasons: string[];
  /** The most serious category that fired, for the rejection message. */
  category: BlockCategory | null;
};

const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const APP_NAMES =
  "instagram|insta|ig|snapchat|snap|tiktok|facebook|fb|whats?app|telegram|linkedin|discord|twitter|threads|reddit|pinterest|tumblr|youtube|wechat|viber|signal|kik|imo|botim|skype|messenger";

/** Social networks + messengers people use to share handles. */
const SOCIAL_APPS = new RegExp(`\\b(${APP_NAMES}|t\\.me)\\b`, "i");

/** Dating / matrimony apps — mentioning them is usually an off-platform move. */
const DATING_APPS =
  /\b(tinder|bumble|hinge|badoo|okcupid|okc|plenty\s*of\s*fish|pof|match\.com|matchcom|grindr|coffee\s*meets\s*bagel|happn|feeld|raya|inner\s*circle|muzmatch|muzz|salams|pure\s*matrimony|shaadi|shaadi\.com|tantan|skout|meetme|zoosk)\b/i;

const SOCIAL_DOMAINS =
  /(?:instagram|instagr\.am|tiktok|facebook|fb|snapchat|t\.me|telegram|linkedin|discord|twitter|x\.com|threads\.net|reddit|pinterest|tumblr|youtube|youtu\.be|wa\.me|whatsapp|wechat|signal|line\.me|tinder|bumble|hinge|badoo|okcupid|pof|match|grindr|muzmatch|muzz|salams|shaadi)\.(?:com|net|me|app|co|org|ly|be|am)\b/i;

/** "add me on snap", "my insta is", "dm me on" — sharing your own account. */
const SHARE_OWN = new RegExp(
  `\\b(add|follow|find|search|message|msg|dm|text|ping|hit)\\s+me\\b|\\bmy\\s+(${APP_NAMES}|handle|user\\s*name|username|account|socials?|number|phone|mobile|cell|email|e-mail)\\b|\\b(user\\s*name|username|handle)\\s*(is|:)`,
  "i"
);

/** What someone can ask for off the platform. "number" excludes "number of …" / "number one". */
const CONTACT_TARGET = `(?:${APP_NAMES}|socials?|handle|user\\s*name|username|account|contact(?:\\s+(?:details|info|number))?|e-?mail(?:\\s+address)?|(?:phone|mobile|cell|whatsapp)?\\s*(?:number|no\\.?)(?!\\s+(?:of|one)\\b)|digits)`;

/** "give me your insta", "can I have your number", "what's your snap?". */
const CONTACT_REQUEST = new RegExp(
  `\\b(?:your|ur|yr|you(?:r)?\\s+own)\\s+${CONTACT_TARGET}\\b|\\b(?:give|send|share|drop|tell|pass)\\s+(?:me\\s+)?(?:your|ur)\\b`,
  "i"
);
const REQUEST_VERB =
  /\b(give|send|share|drop|tell|pass|what'?s|whats|can i (?:have|get)|could i (?:have|get)|may i (?:have|get)|need|want)\b|\?/i;

/** Moving the conversation somewhere else. */
const OFF_PLATFORM =
  /\b(contact|talk|chat|speak|message|text|reach|meet|call)\s+(?:me|you|each other)?\s*(?:outside|off)\s+(?:of\s+)?(?:this|the)\s+(?:app|platform|site|website)\b|\b(?:let'?s|let us|we should|can we)\s+(?:move|switch|go|continue|talk)\s+(?:to|on|over\s+to)\s+(?:\w+\s+){0,1}(?:app|platform|\w*app\b|insta\w*|snap\w*|telegram|tiktok)|\boff[-\s]?app\b/i;

/** Pashto / Urdu / Arabic script: app names, "number", and "give/send me". */
const PASHTO_APPS =
  /(انسټاګرام|انستاګرام|انستاگرام|انسٹاگرام|انستگرام|اینستاګرام|اينستاغرام|انستا|سنیپ\s*چیټ|سنیپ|سناپ|سنپ\s*چټ|واټس\s*اپ|واټساپ|واتساپ|وټساپ|واتس\s*اپ|ټیک\s*ټاک|تیک\s*تاک|ٹک\s*ٹاک|فیس\s*بوک|فېسبوک|ټیلیګرام|تلگرام|ٹیلیگرام)/;
const PASHTO_CONTACT = /(شمېره|شمیره|نمبر|نمبره|ایمیل|اېمېل)/;
const PASHTO_REQUEST = /(راکړه|راکړئ|راکړی|راواستوه|ولېږه|راولېږه|راته|بھیجو|بھیجیں|دے\s*دو|دیں|دو|ستا|خپل|اپنا|اپنی)/;
/** Roman Pashto/Urdu: "sta insta rakra", "apna number do". */
const ROMAN_REQUEST = new RegExp(
  `\\b(sta|staa|apna|apni|apne|tera|tumhara)\\s+(?:${APP_NAMES}|number|nambar|email)\\b|\\b(?:${APP_NAMES}|number|nambar)\\s+(rakra|rakrai|raka|rakawa|raleira|do|de\\s*do|bhejo|bhejain)\\b`,
  "i"
);

const PROFANITY =
  /\b(fuck\w*|fck\w*|fuk\w*|shit\w*|bitch\w*|slut\w*|whore\w*|bastard\w*|cunt\w*|dickhead|asshole|motherf\w*|idiot|kill\s*yourself|kys)\b/i;

const THREAT =
  /\b(?:i|we)(?:'?ll|\s+will|\s+am\s+going\s+to|\s+gonna|\s+would|\s+could|'?d)\s+(?:\w+\s+){0,2}(hurt|kill|harm|beat|hit|slap|stab|shoot|attack|ruin|destroy|expose|shame|find|hunt|leak)\s+(?:you|u|your|ur)\b|\byou(?:'?ll|\s+will)\s+(?:regret|pay|be sorry)\b|\bi\s+know\s+where\s+you\s+live\b|\bor\s+else\b|\bwatch\s+your\s+back\b/i;

/** Explicit sexual words — blocked unless the sentence is clearly rejecting them. */
const SEXUAL_EXPLICIT =
  /\b(nudes?|naked|porn\w*|sext\w*|sexy\s+(?:pics?|pictures?|photos?|videos?)|boobs?|tits|dick\s*pics?|blowjob|horny|onlyfans)\b/i;
/** Indirect requests: "pictures without your clothes", "show me your body". */
const SEXUAL_INDIRECT =
  /\b(?:without|no|take\s+off|remove)\s+(?:your\s+|ur\s+)?(?:clothes|clothing|bra|top|shirt|underwear|hijab\s+and\s+clothes)\b|\b(?:show|send)\s+(?:me\s+)?(?:your|ur)\s+(?:body|underwear|lingerie|bra)\b|\b(?:in\s+(?:your|ur)\s+(?:underwear|lingerie|bra))\b/i;
/** "sex" alone is too broad ("opposite sex"); block it as an invitation. */
const SEX_INVITE =
  /\b(?:have|having|want|wanna|let'?s|let\s+us|do\s+you\s+want)\b[^.?!]{0,30}\bsex\b|\bsex\s+(?:before|with\s+me|tonight|chat)\b/i;
/** A sentence that refuses or condemns the behaviour, e.g. "I do not want anyone asking for nude photos." */
const PROTECTIVE =
  /\b(?:do\s+not|don'?t|dont|never|won'?t|will\s+not|wouldn'?t|refuse|not\s+okay|not\s+ok|not\s+acceptable|against|dislike|hate)\b/i;
/** …unless it still asks the other person for something. */
const DIRECT_ASK = /\b(send|show|give)\s+me\b|\b(can|could|will|would)\s+you\b|\blet'?s\b|\blet\s+us\b/i;

/** Remove characters people use to hide words: zero-width marks, BOM, bidi controls. */
function stripInvisible(s: string) {
  return s.replace(/[​-‏⁠-⁤﻿‪-‮]/g, "");
}

/** "i n s t a g r a m" → "instagram", "f u c k i n g" → "fucking" (4+ single letters in a row). */
function joinSpacedLetters(s: string) {
  return s.replace(/\b(?:[a-z0-9*@$]\s){3,}[a-z0-9*@$]\b/gi, (m) => m.replace(/\s+/g, ""));
}

/** "1nstagr4m" → "instagram", "f*cking" → "fucking". Only used for word matching, never digits. */
function unLeet(s: string) {
  return s.replace(/[a-z0-9@$*!|]+/gi, (word) => {
    if (!/[a-z]/i.test(word)) return word; // pure numbers stay numbers
    return word
      .replace(/0/g, "o")
      .replace(/1|!|\|/g, "i")
      .replace(/3/g, "e")
      .replace(/4|@/g, "a")
      .replace(/5|\$/g, "s")
      .replace(/7/g, "t")
      .replace(/\*/g, "u");
  });
}

export function squashContactText(raw: string) {
  let s = stripInvisible(raw.toLowerCase());
  s = s.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|oh)\b/g, (m) => DIGIT_WORDS[m] || m);
  s = s.replace(/\b(dot|point)\b/g, ".");
  s = s.replace(/\b(at)\b/g, "@");
  s = s.replace(/\b(slash)\b/g, "/");
  s = s.replace(/\b(colon)\b/g, ":");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\s*([@.:/_-])\s*/g, "$1");
  return s;
}

function digitRun(s: string) {
  return s.replace(/\D/g, "");
}

/** Lower-cased text with hiding tricks undone, for word rules (not for digit counting). */
function wordForm(raw: string) {
  return unLeet(joinSpacedLetters(stripInvisible(raw.toLowerCase()))).replace(/\s+/g, " ");
}

/** True when the text has something a person can see — not just spaces or zero-width marks. */
export function hasVisibleText(raw: string) {
  return /[^\s\p{Cf}\p{Mn}᠎ㅤᅟᅠﾠ]/u.test(raw);
}

function contactReasons(joined: string, squashed: string, words: string, partCount: number) {
  const reasons: string[] = [];
  const digits = digitRun(squashed);

  if (/[a-z0-9._%+-]{2,}@[a-z0-9.-]+\.[a-z]{2,}/.test(squashed)) reasons.push("email");
  if (/\b(gmail|yahoo|hotmail|outlook|icloud|proton)\b/.test(squashed) && /@|\.com|\.co\b/.test(squashed)) {
    reasons.push("email");
  }
  // Squashing glues "is @name" into "is@name", so look for handles in the original spacing too.
  if (/(?:^|[^a-z0-9])@[a-z0-9._]{3,}/.test(squashed) || /(?:^|\s)@[a-z0-9._]{3,}/i.test(joined)) {
    reasons.push("handle");
  }
  if (/\b(https?:|www\.)/.test(squashed) || SOCIAL_DOMAINS.test(squashed)) reasons.push("link");
  if (DATING_APPS.test(words)) reasons.push("dating_app");
  if (SOCIAL_APPS.test(words) && SHARE_OWN.test(words)) reasons.push("social");
  if (CONTACT_REQUEST.test(words) && REQUEST_VERB.test(words)) reasons.push("contact_request");
  if (OFF_PLATFORM.test(words)) reasons.push("off_platform");
  if ((PASHTO_APPS.test(joined) || PASHTO_CONTACT.test(joined)) && PASHTO_REQUEST.test(joined)) {
    reasons.push("contact_request");
  }
  if (ROMAN_REQUEST.test(words)) reasons.push("contact_request");
  if (digits.length >= 8 || (partCount > 1 && digits.length >= 7)) reasons.push("phone");
  return reasons;
}

function safetyReasons(words: string) {
  const reasons: string[] = [];
  if (PROFANITY.test(words)) reasons.push("abuse");
  if (THREAT.test(words)) reasons.push("threat");
  const sexual = SEXUAL_EXPLICIT.test(words) || SEXUAL_INDIRECT.test(words) || SEX_INVITE.test(words);
  // F03: "I do not want anyone asking for nude photos." sets a boundary — allow it, unless the same
  // message still asks the other person for something.
  if (sexual && !(PROTECTIVE.test(words) && !DIRECT_ASK.test(words))) reasons.push("sexual");
  return reasons;
}

function categoryOf(reasons: string[]): BlockCategory | null {
  if (reasons.includes("threat")) return "threat";
  if (reasons.includes("sexual")) return "sexual";
  if (reasons.includes("abuse")) return "abuse";
  return reasons.length ? "contact" : null;
}

/**
 * Check one message (or a run of recent messages, oldest first, for split numbers/handles).
 * Pass `contactOnly` when checking a combined run: earlier messages were already judged on their
 * own, so only contact details spread across messages should count.
 */
export function inspectLeak(parts: string[], opts: { contactOnly?: boolean } = {}): LeakVerdict {
  const joined = parts.join(" ");
  const squashed = squashContactText(joined);
  const words = wordForm(joined);
  const reasons = [
    ...contactReasons(joined, squashed, words, parts.length),
    ...(opts.contactOnly ? [] : safetyReasons(words)),
  ];
  const unique = [...new Set(reasons)];
  const hit = unique.length > 0;

  const lastRaw = parts[parts.length - 1] || "";
  const last = squashContactText(lastRaw);
  const lastWords = wordForm(lastRaw);
  const lastDigits = digitRun(last);
  const suspect =
    hit ||
    last.includes("@") ||
    SOCIAL_APPS.test(lastWords) ||
    DATING_APPS.test(lastWords) ||
    PASHTO_APPS.test(lastRaw) ||
    /\b(http|www|dot|gmail|number|digits)\b/.test(lastWords) ||
    (lastDigits.length >= 4 && last.length <= 48) ||
    /^[\d\s+().-]{6,}$/.test(lastRaw);

  return { hit, suspect, reasons: unique, category: categoryOf(unique) };
}
