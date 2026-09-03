const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  error?: { message?: string };
};

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function geminiJson<T>(opts: {
  system: string;
  user: string;
  timeoutMs?: number;
}): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  const timeoutMs = opts.timeoutMs ?? 4000;
  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      const data = (await res.json()) as GeminiResponse;
      if (!res.ok) continue;
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      if (!text) continue;
      return JSON.parse(text) as T;
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
