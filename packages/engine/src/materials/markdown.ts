export interface Slide {
  title: string;
  bullets: string[];
}

/** Parses a markdown lesson plan/guide into slides: headings become slide titles, list items become bullets. */
export function markdownToSlides(md: string, deckTitle: string): Slide[] {
  const slides: Slide[] = [{ title: deckTitle, bullets: [] }];
  let current: Slide | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (h) {
      current = { title: stripMd(h[1]), bullets: [] };
      slides.push(current);
      continue;
    }
    const li = line.match(/^[-*]\s+(.*)/);
    if (li && current) {
      current.bullets.push(stripMd(li[1]));
    } else if (current && current.bullets.length < 8) {
      current.bullets.push(stripMd(line).slice(0, 160));
    }
  }
  return slides.filter((s, i) => i === 0 || s.bullets.length || s.title);
}

export function stripMd(s: string): string {
  return s.replace(/\*\*/g, "").replace(/[*_`>#]/g, "").replace(/\s+/g, " ").trim();
}

export function mdLines(md: string): string[] {
  return md.split("\n").map((l) => stripMd(l)).filter(Boolean);
}
