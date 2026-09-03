export type LeakVerdict = {
  hit: boolean;
  suspect: boolean;
  reasons: string[];
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

/** Social networks + messengers people use to share handles. */
const SOCIAL_APPS =
  /\b(instagram|insta|ig|snapchat|snap|tiktok|facebook|fb|whats?app|telegram|t\.me|linkedin|discord|twitter|threads|reddit|pinterest|tumblr|youtube|yt|wechat|weixin|viber|signal|line|kik|imo|botim|skype|messenger|paltalk)\b/i;

/** Dating / matrimony apps — mentioning them is usually an off-platform move. */
const DATING_APPS =
  /\b(tinder|bumble|hinge|badoo|okcupid|okc|plenty\s*of\s*fish|pof|match\.com|matchcom|grindr|her\s*app|coffee\s*meets\s*bagel|cmb|happn|the\s*league|feeld|raya|inner\s*circle|muzmatch|muzz|salams|pure\s*matrimony|shaadi|shaadi\.com|ishq|tantan|tango|skout|meetme|tagged|whisper|clover|blendr|zoosk)\b/i;

const SOCIAL_DOMAINS =
  /(?:instagram|instagr\.am|tiktok|facebook|fb|snapchat|t\.me|telegram|linkedin|discord|twitter|x\.com|threads\.net|reddit|pinterest|tumblr|youtube|youtu\.be|wa\.me|whatsapp|wechat|signal|line\.me|tinder|bumble|hinge|badoo|okcupid|pof|match|grindr|muzmatch|muzz|salams|shaadi)\.[\w./?#=-]+/i;

const CONTACT_INTENT =
  /[@./]|http|www|follow|add\s*me|find\s*me|search\s*me|user\s*name|username|handle|my\s+(snap|ig|insta|tiktok|facebook|fb|discord|telegram|whatsapp|tinder|bumble|hinge|muzz)/i;

const MAIL_HOST = /\b(gmail|yahoo|hotmail|outlook|icloud|proton)\b/i;

const ABUSE =
  /\b(fuck|shit|bitch|slut|whore|bastard|idiot|kill yourself|kys|nude|nudes|sex\b|porn)\b/i;

export function squashContactText(raw: string) {
  let s = raw.toLowerCase().replace(/[\u200b-\u200f\ufeff]/g, "");
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

export function inspectLeak(parts: string[]): LeakVerdict {
  const joined = parts.join(" ");
  const squashed = squashContactText(joined);
  const digits = digitRun(squashed);
  const reasons: string[] = [];

  if (/[a-z0-9._%+-]{2,}@[a-z0-9.-]+\.[a-z]{2,}/.test(squashed)) reasons.push("email");
  if (MAIL_HOST.test(squashed) && (squashed.includes("@") || /\.com|\.co\b/.test(squashed))) reasons.push("email");
  if (/(?:^|[^a-z0-9])@[a-z0-9._]{3,}/.test(squashed)) reasons.push("handle");
  if (/\b(https?:|www\.)/.test(squashed) || SOCIAL_DOMAINS.test(squashed)) {
    reasons.push("link");
  }
  if (DATING_APPS.test(squashed) || DATING_APPS.test(joined)) reasons.push("dating_app");
  if (SOCIAL_APPS.test(squashed) && CONTACT_INTENT.test(joined + " " + squashed)) {
    reasons.push("social");
  }
  if (digits.length >= 8 || (parts.length > 1 && digits.length >= 7)) reasons.push("phone");
  if (ABUSE.test(joined)) reasons.push("abuse");

  const unique = [...new Set(reasons)];
  const hit = unique.length > 0;

  const last = squashContactText(parts[parts.length - 1] || "");
  const lastDigits = digitRun(last);
  const suspect =
    hit ||
    last.includes("@") ||
    MAIL_HOST.test(last) ||
    SOCIAL_APPS.test(last) ||
    DATING_APPS.test(last) ||
    SOCIAL_DOMAINS.test(last) ||
    /\b(http|www|dot|gmail|snap|insta|tiktok|facebook|whatsapp|tinder|bumble|hinge|muzz)\b/.test(last) ||
    (lastDigits.length >= 4 && last.length <= 48) ||
    /^[\d\s+().-]{6,}$/.test(parts[parts.length - 1] || "");

  return { hit, suspect, reasons: unique };
}
