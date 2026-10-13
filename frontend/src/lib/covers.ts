import { COVER_LIBRARY, type CoverSet, type LibraryCover } from "./cover-library";
import type { RegistroEvent } from "./events";

/** Which set of library covers fits an event's free-text category. */
export function coverSetFor(category: string | null | undefined): CoverSet | null {
  const c = (category ?? "").toLowerCase();
  if (!c) return null;
  const rules: [CoverSet, RegExp][] = [
    ["music", /music|concert|open mic|perform|band|dj|karaoke/],
    ["sports", /sport|intramural|soccer|basketball|football|fitness|game|run|athlet/],
    ["tech", /tech|hack|coding|code|computer|ai\b|robot|engineer/],
    ["career", /career|job|network|internship|resume|recruit|business|talk|panel/],
    ["academic", /academic|study|lecture|class|seminar|research|library|exam|workshop/],
    ["arts", /art|craft|design|paint|draw|film|photo|theat|creative/],
    ["culture", /culture|cultural|food|festival|heritage|international|dance/],
    ["community", /community|volunteer|service|charity|outreach|club fair/],
    ["social", /social|party|mixer|meet|hangout|night/],
  ];
  return rules.find(([, re]) => re.test(c))?.[0] ?? null;
}

/** Small stable hash, so an event keeps the same cover on every page and every visit. */
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function libraryFor(set: CoverSet | null): LibraryCover[] {
  if (!set) return COVER_LIBRARY.filter((c) => c.set === "social" || c.set === "culture" || c.set === "music");
  return COVER_LIBRARY.filter((c) => c.set === set);
}

/** The event's own cover, or a library cover that fits its category. Never empty. */
export function coverFor(event: Pick<RegistroEvent, "event_id" | "image" | "category">): {
  url: string;
  credit: string | null;
} {
  if (event.image) {
    const known = COVER_LIBRARY.find((c) => c.url === event.image);
    return { url: event.image, credit: known?.photographer ?? null };
  }
  const options = libraryFor(coverSetFor(event.category));
  const pick = options[hash(event.event_id) % options.length];
  return { url: pick.url, credit: pick.photographer };
}

export const isUnsplash = (url: string) => url.startsWith("https://images.unsplash.com/");
