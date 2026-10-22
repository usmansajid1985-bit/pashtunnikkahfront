export type SignInDevice = {
  name: string;
  kind: "phone" | "tablet" | "laptop" | "desktop";
  browser: string;
  os: string;
};

/** A short device name plus the browser and system behind a login's user agent. */
export function describeSignIn(ua: string | null | undefined): SignInDevice {
  const raw = ua || "";
  const browser = /Edg\//.test(raw)
    ? "Edge"
    : /OPR\/|Opera/.test(raw)
      ? "Opera"
      : /SamsungBrowser/.test(raw)
        ? "Samsung Internet"
        : /Chrome\//.test(raw)
          ? "Chrome"
          : /Firefox\//.test(raw)
            ? "Firefox"
            : /Safari\//.test(raw)
              ? "Safari"
              : "";

  let os = "";
  let kind: SignInDevice["kind"] = "desktop";
  if (/iPhone/.test(raw)) {
    os = "iPhone";
    kind = "phone";
  } else if (/iPad/.test(raw)) {
    os = "iPad";
    kind = "tablet";
  } else if (/Android/.test(raw)) {
    os = "Android";
    kind = /Mobile/.test(raw) ? "phone" : "tablet";
  } else if (/Windows/.test(raw)) {
    os = "Windows";
    kind = "desktop";
  } else if (/Mac OS X|Macintosh/.test(raw)) {
    os = "Mac";
    kind = "laptop";
  } else if (/CrOS/.test(raw)) {
    os = "ChromeOS";
    kind = "laptop";
  } else if (/Linux/.test(raw)) {
    os = "Linux";
    kind = "laptop";
  }

  let name = "Unknown device";
  if (kind === "phone" || kind === "tablet") name = browser && os ? `${browser} on ${os}` : os || browser || name;
  else if (os === "Windows") name = "Windows PC";
  else if (os === "Mac") name = "Mac";
  else if (os === "Linux") name = browser ? `${browser} on Linux` : "Linux";
  else if (os) name = browser ? `${browser} on ${os}` : os;
  else if (browser) name = browser;

  return { name, kind, browser: browser || "Unknown", os: os || "Unknown" };
}
