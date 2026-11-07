/**
 * Helpers for the Next.js App Router "flight" payload that Altınkaya pages embed as
 * `self.__next_f.push([1, "<chunk>"])` scripts. The payload carries the same structured
 * props the page renders from, which is far more stable than scraping visible text.
 */

const PUSH = "self.__next_f.push(";

/** Concatenates every string chunk pushed into `self.__next_f`. */
export function extractFlight(html: string): string {
  let out = "";
  let i = 0;
  while ((i = html.indexOf(PUSH, i)) >= 0) {
    i += PUSH.length;
    const end = matchEnd(html, i);
    const chunk = JSON.parse(html.slice(i, end)) as unknown[];
    if (typeof chunk[1] === "string") out += chunk[1];
    i = end;
  }
  return out;
}

/** Index just past the JSON object/array starting at `start`, honouring strings. */
export function matchEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      if (--depth === 0) return i + 1;
    }
  }
  throw new Error(`Unterminated JSON value at ${start}`);
}

/** Parses the JSON object or array that starts at `start`. */
export function parseAt<T>(text: string, start: number): T {
  return JSON.parse(text.slice(start, matchEnd(text, start))) as T;
}

/** The innermost JSON object that contains the first occurrence of `marker`. */
export function objectContaining<T>(flight: string, marker: string): T | undefined {
  const at = flight.indexOf(marker);
  if (at < 0) return undefined;
  for (let j = flight.lastIndexOf("{", at); j >= 0; j = flight.lastIndexOf("{", j - 1)) {
    let end: number;
    try {
      end = matchEnd(flight, j);
    } catch {
      continue;
    }
    if (end > at) {
      try {
        return JSON.parse(flight.slice(j, end)) as T;
      } catch {
        // `{` inside a string; keep walking outwards.
      }
    }
  }
  return undefined;
}

/**
 * The value after the first `"key":` whose value starts with `prefix`, e.g.
 * `valueAfter(flight, "table", '{"columns"')`. The prefix skips same-named i18n strings.
 */
export function valueAfter<T>(flight: string, key: string, prefix: string): T | undefined {
  const marker = `"${key}":${prefix}`;
  const at = flight.indexOf(marker);
  return at < 0 ? undefined : parseAt<T>(flight, at + key.length + 3);
}

/** All `<script type="application/ld+json">` blocks, parsed. */
export function jsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try {
      out.push(JSON.parse(m[1]!) as Record<string, unknown>);
    } catch {
      // Ignore malformed blocks; they are not our data source.
    }
  }
  return out;
}

export function title(html: string): string | undefined {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1];
}
