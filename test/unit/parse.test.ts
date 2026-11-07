import { describe, expect, it } from "vitest";
import { EnclosureSchema } from "../../src/catalog/schema.js";
import {
  linkedCategorySlugs,
  parseCategoryProducts,
  parseCategoryTree,
  parseProduct,
  parseRange,
  parseTemperature,
} from "../../scripts/crawl/parse.js";
import { fixture } from "../helpers.js";

describe("value parsing", () => {
  it("parses single values and ranges in either order", () => {
    expect(parseRange("300")).toEqual({ min: 300, max: 300 });
    expect(parseRange("150 - 180")).toEqual({ min: 150, max: 180 });
    expect(parseRange("85 - 70")).toEqual({ min: 70, max: 85 });
    expect(parseRange("111,5")).toEqual({ min: 111.5, max: 111.5 });
    expect(parseRange(undefined)).toBeNull();
    expect(parseRange("n/a")).toBeNull();
  });

  it("parses operating temperature", () => {
    expect(parseTemperature("-20° / +60°")).toEqual({ min: -20, max: 60 });
    expect(parseTemperature("-50° / +160°")).toEqual({ min: -50, max: 160 });
    expect(parseTemperature(undefined)).toBeNull();
  });
});

describe("category pages", () => {
  it("flattens the category tree with parents", () => {
    const tree = parseCategoryTree(fixture("enclosures"));
    expect(tree.find((c) => c.slug === "din-kutular-132")).toMatchObject({
      id: 132,
      parentId: null,
    });
    expect(tree.find((c) => c.slug === "din-ray-tipi-kutular-20")).toMatchObject({
      id: 20,
      name: "DIN Ray Tipi Kutular",
      parentId: 132,
    });
  });

  it("lists enclosure groups linked from the enclosures page", () => {
    const slugs = linkedCategorySlugs(fixture("enclosures"));
    expect(slugs).toEqual(
      expect.arrayContaining([
        "din-kutular-132",
        "ip-suya-dayanikli-kutular-124",
        "metal-kutular-126",
      ]),
    );
  });

  it("lists every product of a category, including ones beyond the first page of links", () => {
    const slugs = parseCategoryProducts(fixture("category-din-ray-tipi-kutular"));
    expect(slugs.length).toBeGreaterThanOrEqual(34);
    expect(slugs).toContain("rt-014-ray-tipi-kutu-6966");
    expect(parseCategoryProducts(fixture("category-ip67-plastik-panolar"))).toContain(
      "ec-1015-ip67-plastik-pano-16355",
    );
  });
});

describe("product pages", () => {
  const ec1015 = parseProduct(fixture("product-ec-1015"), fixture("product-ec-1015-en"));

  it("produces a schema-valid enclosure", () => {
    expect(() => EnclosureSchema.parse(ec1015)).not.toThrow();
    expect(() => EnclosureSchema.parse(parseProduct(fixture("product-rt-014")))).not.toThrow();
  });

  it("extracts identity, names and category", () => {
    expect(ec1015).toMatchObject({
      id: 16355,
      code: "EC-1015",
      slug: "ec-1015-ip67-plastik-pano-16355",
      name: { tr: "EC-1015 IP67 Plastik Pano" },
      categoryId: 8,
      url: { tr: "https://www.altinkaya.com/tr/products/ec-1015-ip67-plastik-pano-16355" },
    });
    expect(ec1015.name.en).toBe("EC-1015 IP67 Hinged Plastic Enclosure");
  });

  it("normalizes dimensions and key specs", () => {
    expect(ec1015.outer).toEqual({
      a: { min: 100, max: 100 },
      b: { min: 150, max: 150 },
      c: { min: 70, max: 85 },
    });
    expect(ec1015.drawing).toMatchObject({ E2: 78.5, B2: 111.5, D1: 85, P1: 75, P2: 125 });
    expect(ec1015.materials).toEqual(["ABS", "PC"]);
    expect(ec1015.ipRating).toBe("IP67");
    expect(ec1015.operatingTemperature).toEqual({ min: -20, max: 60 });
  });

  it("maps variants to their attribute options", () => {
    expect(ec1015.variants.length).toBeGreaterThan(0);
    for (const v of ec1015.variants) {
      expect(v.code).toMatch(/^EC-1015/);
      expect(Object.keys(v.options).length).toBeGreaterThan(0);
    }
  });

  it("links drawings, CAD files, certificates and machining templates", () => {
    expect(ec1015.documents.map((d) => d.type).sort()).toEqual([
      "drawing",
      "dxf",
      "ip-certificate",
      "machining-template",
      "step",
      "step",
    ]);
    expect(
      ec1015.documents.every((d) => d.url.startsWith("https://www.altinkaya.com/api/content/")),
    ).toBe(true);
  });

  it("classifies print templates", () => {
    const rt014 = parseProduct(fixture("product-rt-014"));
    expect(rt014.documents.filter((d) => d.type === "print-template")).toHaveLength(2);
    expect(rt014.documents.some((d) => d.type === "other")).toBe(false);
  });

  it("never carries prices or account data", () => {
    const json = JSON.stringify(ec1015);
    expect(json).not.toMatch(/price|partner|email|currency/i);
  });
});
