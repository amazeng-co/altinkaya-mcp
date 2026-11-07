import { beforeAll, describe, expect, it } from "vitest";
import {
  CatalogIndex,
  fitsInside,
  ipAtLeast,
  matches,
  normalize,
} from "../../src/catalog/query.js";
import { testCatalog } from "../helpers.js";

describe("helpers", () => {
  it("compares IP ratings digit by digit", () => {
    expect(ipAtLeast("IP67", "IP65")).toBe(true);
    expect(ipAtLeast("IP65", "IP65")).toBe(true);
    expect(ipAtLeast("IP54", "IP65")).toBe(false);
    expect(ipAtLeast("IP66", "IP67")).toBe(false);
    expect(ipAtLeast(null, "IP40")).toBe(false);
    expect(ipAtLeast("IP67", "IPX4")).toBe(true);
  });

  it("checks box fit in any orientation", () => {
    expect(fitsInside([20, 80, 50], [100, 150, 85])).toBe(true);
    expect(fitsInside([90, 90, 90], [100, 150, 85])).toBe(false);
    expect(fitsInside([100, 150, 85], [85, 100, 150])).toBe(true);
  });

  it("normalizes Turkish text", () => {
    expect(normalize("Çantalar IŞIK İnce")).toBe("cantalar isik ince");
  });
});

describe("CatalogIndex", () => {
  let idx: CatalogIndex;
  beforeAll(async () => {
    idx = new CatalogIndex(await testCatalog());
  });

  it("finds by family code, variant code and slug", () => {
    expect(idx.find("ec-1015")?.code).toBe("EC-1015");
    const variant = idx.find("EC-1015")!.variants[0]!.code;
    expect(idx.find(variant)?.code).toBe("EC-1015");
    expect(idx.find("rt-014-ray-tipi-kutu-6966")?.code).toBe("RT-014");
    expect(idx.find("nope")).toBeUndefined();
  });

  it("returns candidates when a model code is shared by several products", async () => {
    const catalog = await testCatalog();
    const clone = { ...catalog.enclosures[0]!, id: 1, slug: "ec-1015-yan-kapak-1", variants: [] };
    const shared = new CatalogIndex({ ...catalog, enclosures: [...catalog.enclosures, clone] });
    const r = shared.resolve("EC-1015");
    expect(r.match).toBeUndefined();
    expect(r.candidates?.map((e) => e.slug).sort()).toEqual([
      "ec-1015-ip67-plastik-pano-16355",
      "ec-1015-yan-kapak-1",
    ]);
    expect(shared.resolve("ec-1015-yan-kapak-1").match?.id).toBe(1);
  });

  it("summarizes variants and caps the list", () => {
    const d = idx.detail(idx.find("EC-1015")!, {}, 1);
    expect(d.variants).toHaveLength(1);
    expect(d.variantsTruncated).toBe(d.variantCount > 1);
    expect(Object.keys(d.optionValues).length).toBeGreaterThan(0);
  });

  it("searches codes, Turkish and English names and categories", () => {
    expect(idx.search("EC-1015", 5)[0]?.code).toBe("EC-1015");
    expect(idx.search("hinged", 5).map((e) => e.code)).toEqual(["EC-1015"]);
    expect(idx.search("ray tipi", 5).map((e) => e.code)).toEqual(["RT-014"]);
    expect(idx.search("ip67", 5).map((e) => e.code)).toContain("EC-1015");
  });

  it("builds category paths and subtrees", () => {
    expect(idx.categoryPath(20)).toEqual(["DIN Kutular", "DIN Ray Tipi Kutular"]);
    expect(idx.subtree(132).has(20)).toBe(true);
    expect(idx.findCategory("din kutular")?.id).toBe(132);
  });

  it("filters by outer size, IP, material and category", () => {
    const ec = idx.find("EC-1015")!;
    const rt = idx.find("RT-014")!;
    expect(matches(ec, { minOuter: { x: 80, y: 50, z: 20 } }, idx)).toBe(true);
    expect(matches(rt, { minOuter: { x: 80, y: 50, z: 30 } }, idx)).toBe(false);
    expect(matches(rt, { maxOuter: { x: 100, y: 100, z: 100 } }, idx)).toBe(true);
    expect(matches(ec, { minIp: "IP65" }, idx)).toBe(true);
    expect(matches(rt, { minIp: "IP65" }, idx)).toBe(false);
    expect(matches(ec, { materials: ["pc"] }, idx)).toBe(true);
    expect(matches(rt, { materials: ["alüminyum"] }, idx)).toBe(false);
    expect(matches(rt, { categoryIds: idx.subtree(132) }, idx)).toBe(true);
    expect(matches(ec, { categoryIds: idx.subtree(132) }, idx)).toBe(false);
  });
});
