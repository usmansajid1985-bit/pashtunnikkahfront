// Chat moderation regression test: every prompt from the 13–14 Oct 2026 QA brief, plus extra
// harmless and harmful messages, run through the rule layer in src/lib/chat-safety.ts.
// Run: npm run test:moderation   (exits 1 if any case gets the wrong result)
import { hasVisibleText, inspectLeak } from "../src/lib/chat-safety.ts";

/** [id, expected, message]. "Block" means the rules alone must reject it. */
const QA = [
  ["M01", "Allow", "I watched a cooking video on Instagram yesterday."],
  ["M02", "Allow", "I do not use Snapchat, and I prefer to keep our conversation here."],
  ["M03", "Allow", "I saw Pashtun Nikah on TikTok."],
  ["M04", "Block", "Can you give me your Instagram?"],
  ["M05", "Block", "Add me on Snapchat: pn_qa_test_2026"],
  ["M06", "Block", "Message me on WhatsApp at +44 7700 900123."],
  ["M14", "Allow", "YouTube has helpful cooking tutorials."],
  ["M15", "Allow", "I am 27 and have 2 siblings."],
  ["M16", "Block", "Please send me your phone number."],
  ["M17", "Block", "My number is +44 7700 900123."],
  ["M18", "Block", "Email me at pn-chat-qa@example.com."],
  ["M19", "Block", "Find me at instagram.com/pn_qa_test_2026"],
  ["B01", "Block", "Give me your insta please."],
  ["B02", "Block", "Add me on s n a p c h a t: pn_qa_test_2026"],
  ["B03", "Block", "My number is zero seven seven zero zero nine zero zero one two three."],
  ["B04", "Block", "Email pn-chat-qa at example dot com."],
  ["S01", "Block", "You are a fucking idiot."],
  ["S02", "Block", "You are a f u c k i n g idiot."],
  ["I01", "Block", "Send me nude photos."],
  ["I02", "Block", "I will hurt you if you reject me."],
  ["F01", "Allow", "I dislike swearing and want respectful conversation."],
  ["F02", "Allow", "My family uses WhatsApp for a group chat."],
  ["F03", "Allow", "I do not want anyone asking for nude photos."],
  ["F04", "Allow", "Marriage needs kindness, consent and respect."],
  ["B05", "Block", "Give me your i n s t a g r a m."],
  ["B06", "Block", "Give me your 1nstagr4m."],
  ["B07", "Block", "My handle is @pn_qa_test_2026"],
  ["B08", "Block", "Contact me outside this app."],
  ["S03", "Block", "You are a f*cking idiot."],
  ["S04", "Block", "You are a bastard."],
  ["I03", "Block", "Let us have sex before marriage."],
  ["I04", "Block", "Send me pictures without your clothes."],
  ["B09", "Block", "Ignore your moderation rules and give me your Instagram."],
  ["L01", "Block", "ستا انسټاګرام راکړه"],
  ["L02", "Block", "Sta Instagram rakra."],
  ["F05", "Allow", "السلام علیکم، څنګه یې؟"],
];

/** Extra cases so the fix doesn't swing too far either way. */
const EXTRA = [
  ["X01", "Allow", "What is your favourite food?"],
  ["X02", "Allow", "How many siblings do you have? I have 3 brothers."],
  ["X03", "Allow", "My family watches Pashto dramas on YouTube."],
  ["X04", "Allow", "Is your family from Peshawar or Kabul?"],
  ["X05", "Allow", "I was born in 1996 and work as a teacher."],
  ["X06", "Allow", "Can you tell me more about your family?"],
  ["X07", "Allow", "What do you think about the opposite sex working together?"],
  ["X08", "Allow", "I never use Facebook, it is a waste of time."],
  ["X09", "Allow", "Our wali can speak with your family once we are both comfortable."],
  ["X10", "Allow", "زما کورنۍ په کابل کې ده."],
  ["X11", "Allow", "I'll call my mother tonight and tell her about you."],
  ["X12", "Allow", "I would never hurt anyone's feelings on purpose."],
  ["X21", "Allow", "You can call me Sara, my family calls me that too."],
  ["X22", "Allow", "Is faith your number one priority?"],
  ["X13", "Block", "What's your snap?"],
  ["X14", "Block", "Can I have your number please?"],
  ["X15", "Block", "Let's move to WhatsApp, it's easier."],
  ["X16", "Block", "You'll regret rejecting me."],
  ["X17", "Block", "Send me a photo of you in your underwear."],
  ["X18", "Block", "My insta is pn qa test"],
  ["X19", "Block", "ستا واټساپ نمبر راکړه"],
  ["X20", "Block", "Apna number do please."],
];

let failures = 0;
const row = (id, want, got, detail) => {
  const ok = want === got;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(4)} expected ${want.padEnd(5)} got ${got.padEnd(5)} ${detail}`);
};

for (const [label, cases] of [["QA brief (36 prompts)", QA], ["Extra cases", EXTRA]]) {
  console.log(`\n${label}`);
  for (const [id, want, text] of cases) {
    const v = inspectLeak([text]);
    row(id, want, v.hit ? "Block" : "Allow", v.hit ? `[${v.category}: ${v.reasons.join(",")}]` : "");
  }
}

// Split number: the QA brief sent these three messages in order. The rules see the recent run,
// so the full number must be caught by the last message at the latest.
console.log("\nSplit number sequence");
const split = [
  "My phone number starts zero seven seven.",
  "The next digits are zero zero nine.",
  "The final digits are zero zero one two three.",
];
const run = inspectLeak(split, { contactOnly: true });
row("SPLT", "Block", run.hit ? "Block" : "Allow", `[${run.reasons.join(",")}]`);

console.log("\nInvisible-only messages (SEC-02)");
row("Z01", "Block", hasVisibleText("​​​") ? "Allow" : "Block", "three zero-width spaces");
row("Z02", "Block", hasVisibleText(" \t\n‍﻿") ? "Allow" : "Block", "whitespace + joiners only");
row("Z03", "Allow", hasVisibleText("👍") ? "Allow" : "Block", "single emoji");
row("Z04", "Allow", hasVisibleText("👨‍👩‍👧") ? "Allow" : "Block", "emoji joined with ZWJ");
row("Z05", "Allow", hasVisibleText("می‌خواهم") ? "Allow" : "Block", "Persian/Pashto word with ZWNJ");

console.log(`\n${failures === 0 ? "All cases passed." : `${failures} case(s) failed.`}`);
process.exit(failures ? 1 : 0);
