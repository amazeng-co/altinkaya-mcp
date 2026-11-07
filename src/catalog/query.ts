import { z } from "zod";
import type { Catalog, Category, Enclosure, Range } from "./schema.js";

// ---- Views returned by tools ----

export const SummarySchema = z.object({
  code: z.string(),
  name: z.string(),
  nameEn: z.string().nullable(),
  category: z.string(),
  outerMm: z.string().nullable().describe("A × B × C in mm"),
  materials: z.array(z.string()),
  ipRating: z.string().nullable(),
  url: z.string(),
});
export type Summary = z.infer<typeof SummarySchema>;

export class CatalogIndex {
  readonly byCode = new Map<string, Enclosure>();
  readonly categories = new Map<number, Category>();
  private readonly haystack = new Map<Enclosure, string>();

  constructor(readonly catalog: Catalog) {
    for (const c of catalog.categories) this.categories.set(c.id, c);
    for (const e of catalog.enclosures) {
      this.byCode.set(normalize(e.code), e);
      this.haystack.set(
        e,
        normalize(
          [
            e.code,
            e.name.tr,
            e.name.en ?? "",
            this.categoryPath(e.categoryId).join(" "),
            ...e.materials,
            e.ipRating ?? "",
            ...e.variants.map((v) => v.code),
          ].join(" "),
        ),
      );
    }
  }

  /** Category names from the top-level group down to the enclosure's own category. */
  categoryPath(id: number): string[] {
    const path: string[] = [];
    for (
      let c = this.categories.get(id);
      c;
      c = c.parentId ? this.categories.get(c.parentId) : undefined
    ) {
      path.unshift(c.name);
    }
    return path;
  }

  /** Looks up by family code (EC-1015), variant code (EC-1015-7-...) or slug. */
  find(ref: string): Enclosure | undefined {
    const key = normalize(ref);
    return (
      this.byCode.get(key) ??
      this.catalog.enclosures.find(
        (e) => e.slug === ref || e.variants.some((v) => normalize(v.code) === key),
      )
    );
  }

  search(query: string, limit: number): Enclosure[] {
    const q = normalize(query);
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    const scored: [Enclosure, number][] = [];
    for (const e of this.catalog.enclosures) {
      const code = normalize(e.code);
      const hay = this.haystack.get(e)!;
      let score = 0;
      if (code === q) score = 100;
      else if (code.startsWith(q)) score = 80;
      else if (tokens.every((t) => hay.includes(t)))
        score = 50 + (normalize(e.name.tr).includes(q) ? 10 : 0);
      else {
        const hits = tokens.filter((t) => hay.includes(t)).length;
        if (hits > 0) score = (hits / tokens.length) * 40;
      }
      if (score > 0) scored.push([e, score]);
    }
    return scored
      .sort((a, b) => b[1] - a[1] || a[0].code.localeCompare(b[0].code))
      .slice(0, limit)
      .map(([e]) => e);
  }

  /** All category ids in the subtree rooted at `id`. */
  subtree(id: number): Set<number> {
    const ids = new Set([id]);
    for (let grew = true; grew;) {
      grew = false;
      for (const c of this.catalog.categories) {
        if (c.parentId !== null && ids.has(c.parentId) && !ids.has(c.id)) {
          ids.add(c.id);
          grew = true;
        }
      }
    }
    return ids;
  }

  /** Resolves a category by id, slug or (accent/case-insensitive) name. */
  findCategory(ref: string): Category | undefined {
    const key = normalize(ref);
    return this.catalog.categories.find(
      (c) => String(c.id) === ref || c.slug === ref || normalize(c.name) === key,
    );
  }

  summary(e: Enclosure): Summary {
    return {
      code: e.code,
      name: e.name.tr,
      nameEn: e.name.en,
      category: this.categoryPath(e.categoryId).join(" › "),
      outerMm: e.outer ? [e.outer.a, e.outer.b, e.outer.c].map(formatRange).join(" × ") : null,
      materials: e.materials,
      ipRating: e.ipRating,
      url: e.url.en,
    };
  }
}

// ---- Filtering ----

export interface FilterCriteria {
  /**
   * Outer dimensions must be at least this, in any orientation. A necessary (not sufficient)
   * condition for contents of this size to fit: usable inner space is smaller.
   */
  minOuter?: { x: number; y: number; z: number };
  maxOuter?: { x: number; y: number; z: number };
  minIp?: string;
  materials?: string[];
  categoryIds?: Set<number>;
  query?: string;
}

export function matches(e: Enclosure, c: FilterCriteria, index: CatalogIndex): boolean {
  if (c.categoryIds && !c.categoryIds.has(e.categoryId)) return false;
  if (c.minIp && !ipAtLeast(e.ipRating, c.minIp)) return false;
  if (c.materials?.length) {
    const have = e.materials.map(normalize);
    if (!c.materials.some((m) => have.some((h) => h.includes(normalize(m))))) return false;
  }
  if (c.minOuter || c.maxOuter) {
    if (!e.outer) return false;
    const outer = [e.outer.a, e.outer.b, e.outer.c];
    if (
      c.minOuter &&
      !fitsInside(
        xyz(c.minOuter),
        outer.map((r) => r.max),
      )
    )
      return false;
    if (
      c.maxOuter &&
      !fitsInside(
        outer.map((r) => r.min),
        xyz(c.maxOuter),
      )
    )
      return false;
  }
  if (c.query && !index.search(c.query, Infinity).includes(e)) return false;
  return true;
}

const xyz = (d: { x: number; y: number; z: number }) => [d.x, d.y, d.z];

/** True when a box of size `inner` fits in `outer` in some orientation (sorted-dimension test). */
export function fitsInside(inner: number[], outer: number[]): boolean {
  const asc = (v: number[]) => [...v].sort((a, b) => a - b);
  const o = asc(outer);
  return asc(inner).every((d, i) => d <= o[i]!);
}

/** IP ratings compare per digit: IP67 satisfies IP65, IP54 does not satisfy IP65. */
export function ipAtLeast(actual: string | null, required: string): boolean {
  const parse = (ip: string) =>
    /IP\s*(\d|X)(\d|X)/i
      .exec(ip)
      ?.slice(1)
      .map((d) => (d.toUpperCase() === "X" ? 0 : Number(d)));
  const req = parse(required);
  if (!req) return true;
  const act = actual ? parse(actual) : undefined;
  return !!act && act[0]! >= req[0]! && act[1]! >= req[1]!;
}

// ---- Text helpers ----

/** Case-, accent- and Turkish-dotless-i-insensitive form for matching. */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function formatRange(r: Range): string {
  return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}
