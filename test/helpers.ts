import { readFileSync } from "node:fs";
import { CatalogSchema, type Catalog } from "../src/catalog/schema.js";
import { gunzipSync } from "node:zlib";

/** Reads a gzipped HTML fixture recorded from altinkaya.com (logged out). */
export function fixture(name: string): string {
  return gunzipSync(readFileSync(new URL(`fixtures/${name}.html.gz`, import.meta.url))).toString(
    "utf8",
  );
}

/** A small catalog built from the recorded fixtures (EC-1015 IP67 panel, RT-014 DIN rail box). */
export async function testCatalog(): Promise<Catalog> {
  const { parseCategoryTree, parseProduct } = await import("../scripts/crawl/parse.js");
  return CatalogSchema.parse({
    schemaVersion: 1,
    generatedAt: "2026-11-01T00:00:00.000Z",
    source: "https://www.altinkaya.com",
    categories: parseCategoryTree(fixture("enclosures")),
    enclosures: [
      parseProduct(fixture("product-ec-1015"), fixture("product-ec-1015-en")),
      parseProduct(fixture("product-rt-014")),
    ],
  });
}
