import type { SourceKind } from "@lessonforge/db";

export function classifyUrl(raw: string): SourceKind {
  const url = raw.trim();
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return path.endsWith(".pdf") ? "PDF" : "FILE";
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") return "YOUTUBE";
  if (host === "twitter.com" || host === "x.com" || host === "nitter.net") return "THREAD";
  if (path.endsWith(".pdf")) return "PDF";
  if (/^https?:/.test(url)) return "WEB";
  return "FILE";
}

export function youtubeId(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}
