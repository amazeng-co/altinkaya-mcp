import type {
  Category,
  Document,
  Enclosure,
  Range,
  Spec,
  Variant,
} from "../../src/catalog/schema.js";
import { extractFlight, jsonLd, objectContaining, title, valueAfter } from "./rsc.js";

export const ORIGIN = "https://www.altinkaya.com";

// ---- Raw shapes as they appear in the flight payload (only the fields we read) ----

interface RawCategoryNode {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  children: RawCategoryNode[];
}

interface RawTable {
  columns: { id: number; name: string }[];
  rows: { code: string; templateId: number; slug: string }[];
}

interface RawFeature {
  name: string;
  values: string[];
  is_dimension: boolean;
  group_name: string;
}

interface RawProduct {
  productTemplateId: number;
  productName: string;
  images: { url: string }[];
  variantMap: Record<string, { default_code: string | null; barcode: string | null }>;
  attributeLines: { attribute_name: string; values: { id: number; name: string }[] }[];
  features: RawFeature[];
}

interface RawAttachment {
  id: number;
  name: string;
  usage: string;
}

// ---- Category pages ----

/** The full category tree from the site header, flattened. */
export function parseCategoryTree(html: string): Category[] {
  const roots = valueAfter<RawCategoryNode[]>(extractFlight(html), "categories", '[{"id"');
  if (!roots) throw new Error("Category tree not found");
  const out: Category[] = [];
  const walk = (n: RawCategoryNode) => {
    out.push({ id: n.id, slug: n.slug, name: n.name, parentId: n.parent_id });
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

/** Category slugs linked from a page, in document order (used on /categories/enclosures). */
export function linkedCategorySlugs(html: string): string[] {
  return [
    ...new Set([...html.matchAll(/href="\/tr\/categories\/([a-z0-9-]+)"/g)].map((m) => m[1]!)),
  ];
}

/** Product slugs listed on a category page: the dimension table first, then any links. */
export function parseCategoryProducts(html: string): string[] {
  const table = valueAfter<RawTable>(extractFlight(html), "table", '{"columns"');
  const fromTable = table?.rows.map((r) => r.slug) ?? [];
  const fromLinks = [...html.matchAll(/href="\/tr\/products\/([a-z0-9-]+-\d+)"/g)].map(
    (m) => m[1]!,
  );
  return [...new Set([...fromTable, ...fromLinks])];
}

// ---- Product pages ----

/** Parses a Turkish product page. `enHtml` (the /en/ page) only supplies the English name. */
export function parseProduct(html: string, enHtml?: string): Enclosure {
  const flight = extractFlight(html);
  const p = objectContaining<RawProduct>(flight, '"variantMap"');
  if (!p) throw new Error("Product props not found");
  const attachments =
    objectContaining<{ attachments: RawAttachment[] }>(flight, '"attachments"')?.attachments ?? [];
  const slug = canonicalSlug(html);

  const specs: Spec[] = p.features.map((f) => ({
    group: f.group_name,
    name: f.name,
    values: f.values,
  }));
  const feature = (name: string) => p.features.find((f) => f.name === name)?.values ?? [];
  const a = parseRange(feature("A")[0]);
  const b = parseRange(feature("B")[0]);
  const c = parseRange(feature("C")[0]);

  const drawing: Record<string, number> = {};
  for (const f of p.features) {
    if (!f.is_dimension || ["A", "B", "C"].includes(f.name)) continue;
    const value = parseNumber(f.values[0]);
    if (value !== undefined) drawing[f.name] = value;
  }

  return {
    id: p.productTemplateId,
    code: familyCode(p.productName),
    slug,
    name: { tr: p.productName, en: enHtml ? englishName(enHtml, html, p.productName) : null },
    url: { tr: `${ORIGIN}/tr/products/${slug}`, en: `${ORIGIN}/en/products/${slug}` },
    categoryId: breadcrumbCategoryId(html, flight),
    outer: a && b && c ? { a, b, c } : null,
    drawing,
    materials: feature("Malzeme"),
    ipRating: feature("IP Derecesi")[0] ?? null,
    operatingTemperature: parseTemperature(feature("Çalışma Sıcaklığı")[0]),
    specs,
    variants: parseVariants(p),
    documents: attachments.map(toDocument),
    images: p.images.map((i) => absolute(i.url)),
  };
}

function parseVariants(p: RawProduct): Variant[] {
  const valueToAttr = new Map<number, [string, string]>();
  for (const line of p.attributeLines) {
    for (const v of line.values) valueToAttr.set(v.id, [line.attribute_name, v.name]);
  }
  return Object.entries(p.variantMap)
    .filter(([, v]) => v.default_code)
    .map(([key, v]) => ({
      code: v.default_code!,
      barcode: v.barcode || null,
      options: Object.fromEntries(
        key
          .split(":")
          .map((id) => valueToAttr.get(Number(id)))
          .filter((x): x is [string, string] => x !== undefined),
      ),
    }))
    .sort((x, y) => x.code.localeCompare(y.code));
}

const DOCUMENT_TYPES: Record<string, Document["type"]> = {
  pdf: "drawing",
  dxf: "dxf",
  "3d": "step",
  ip_certificate: "ip-certificate",
  machining_template: "machining-template",
  printing_template: "print-template",
};

function toDocument(a: RawAttachment): Document {
  return {
    type: DOCUMENT_TYPES[a.usage] ?? "other",
    name: a.name,
    url: `${ORIGIN}/api/content/${a.id}?download=true`,
  };
}

function canonicalSlug(html: string): string {
  const m = /<link rel="canonical" href="[^"]*\/products\/([a-z0-9-]+)"/.exec(html);
  if (!m) throw new Error("Canonical product URL not found");
  return m[1]!;
}

function breadcrumbCategoryId(html: string, flight: string): number {
  const crumbs = jsonLd(html).find((d) => d["@type"] === "BreadcrumbList") as
    { itemListElement: { item?: string }[] } | undefined;
  const slug = crumbs?.itemListElement
    .map((e) => /\/categories\/([a-z0-9-]+)/.exec(e.item ?? "")?.[1])
    .filter(Boolean)
    .at(-1);
  const id = Number(/-(\d+)$/.exec(slug ?? "")?.[1]);
  if (Number.isInteger(id) && id > 0) return id;
  throw new Error(`Breadcrumb category not found (${flight.length} bytes of flight)`);
}

// ---- Value parsing ----

export function familyCode(productName: string): string {
  return productName.trim().split(/\s+/)[0]!;
}

export function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** "300" → 300–300, "150 - 180" or "85 - 70" → ordered range. */
export function parseRange(raw: string | undefined): Range | null {
  const nums = (raw ?? "").split(/\s+-\s+/).map(parseNumber);
  if (nums.length === 0 || nums.some((n) => n === undefined)) return null;
  const values = nums as number[];
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** "-20° / +60°" → -20–60. */
export function parseTemperature(raw: string | undefined): Range | null {
  const nums = [...(raw ?? "").matchAll(/[-+]?\d+(?:[.,]\d+)?/g)].map((m) => parseNumber(m[0])!);
  return nums.length === 2 ? { min: Math.min(...nums), max: Math.max(...nums) } : null;
}

/** Page title without the " | Altınkaya" suffix, split on " - ". */
function titleParts(html: string): string[] | undefined {
  const t = title(html);
  return t === undefined
    ? undefined
    : decodeEntities(t)
        .replace(/\s*\|\s*Altınkaya\s*$/, "")
        .split(" - ");
}

/**
 * The English page has no product props, only an SEO title shaped like the Turkish one:
 * "<name>[ - <category>]". Drop as many trailing " - " parts as the Turkish title adds to
 * the Turkish product name, which keeps real name parts such as "… - 43 mm".
 * shortcut: assumes both titles carry the same suffix; switch to a real English product
 * field if the /en/ page ever exposes one.
 */
function englishName(enHtml: string, trHtml: string, trName: string): string | null {
  const en = titleParts(enHtml);
  if (!en) return null;
  const extra = Math.max(0, (titleParts(trHtml)?.length ?? 0) - trName.split(" - ").length);
  return (
    en
      .slice(0, Math.max(1, en.length - extra))
      .join(" - ")
      .trim() || null
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function absolute(path: string): string {
  return new URL(path, ORIGIN).toString();
}
