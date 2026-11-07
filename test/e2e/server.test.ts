import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { beforeAll, describe, expect, it } from "vitest";
import { CatalogIndex } from "../../src/catalog/query.js";
import { createServer } from "../../src/server.js";
import { testCatalog } from "../helpers.js";

let client: Client;

beforeAll(async () => {
  const index = Promise.resolve(new CatalogIndex(await testCatalog()));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer(() => index).connect(serverTransport);
  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
});

type Structured<T> = { structuredContent: T; isError?: boolean };
const call = async <T>(name: string, args: object = {}) =>
  (await client.callTool({
    name,
    arguments: args as Record<string, unknown>,
  })) as unknown as Structured<T>;

describe("MCP server", () => {
  it("exposes only read-only tools with output schemas", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "compare_enclosures",
      "filter_enclosures",
      "get_cad_files",
      "get_enclosure",
      "list_categories",
      "search_enclosures",
    ]);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(t.outputSchema, t.name).toBeDefined();
      expect(t.description, t.name).toBeTruthy();
    }
  });

  it("searches", async () => {
    const r = await call<{ results: { code: string }[] }>("search_enclosures", { query: "ip67" });
    expect(r.structuredContent.results.map((e) => e.code)).toEqual(["EC-1015"]);
  });

  it("filters by contents size and IP rating, smallest first", async () => {
    const r = await call<{ total: number; results: { code: string; outerMm: string }[] }>(
      "filter_enclosures",
      { min_outer_mm: { x: 20, y: 50, z: 80 }, min_ip: "IP65" },
    );
    expect(r.structuredContent.total).toBe(1);
    expect(r.structuredContent.results[0]).toMatchObject({
      code: "EC-1015",
      outerMm: "100 × 150 × 70–85",
    });
  });

  it("rejects unknown categories with a helpful error", async () => {
    const r = await call("filter_enclosures", { category: "spaceships" });
    expect(r.isError).toBe(true);
  });

  it("returns full details, comparisons and CAD files", async () => {
    const d = await call<{ enclosure: { code: string; variantCount: number } }>("get_enclosure", {
      code: "ec-1015",
    });
    expect(d.structuredContent.enclosure.code).toBe("EC-1015");
    expect(d.structuredContent.enclosure.variantCount).toBeGreaterThan(0);

    const black = await call<{
      enclosure: { optionValues: Record<string, string[]>; variants: { options: object }[] };
    }>("get_enclosure", { code: "RT-014", options: { renk: "siyah" } });
    expect(black.structuredContent.enclosure.optionValues.Renk).toEqual(["Açık Gri", "Siyah"]);
    expect(black.structuredContent.enclosure.variants).toEqual([
      expect.objectContaining({ options: { Renk: "Siyah" } }),
    ]);

    const c = await call<{ differences: string[] }>("compare_enclosures", {
      codes: ["EC-1015", "RT-014"],
    });
    expect(c.structuredContent.differences).toContain("outerMm");

    const f = await call<{ documents: { type: string }[] }>("get_cad_files", {
      code: "EC-1015",
      types: ["step"],
    });
    expect(f.structuredContent.documents.every((doc) => doc.type === "step")).toBe(true);

    expect((await call("get_enclosure", { code: "XX-0000" })).isError).toBe(true);
  });

  it("counts enclosures per category including subcategories", async () => {
    const r = await call<{ categories: { id: number; count: number }[] }>("list_categories");
    expect(r.structuredContent.categories.find((c) => c.id === 132)?.count).toBe(1);
  });

  it("serves enclosure resources and the selection prompt", async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain(
      "altinkaya://enclosure/ec-1015-ip67-plastik-pano-16355",
    );
    const res = await client.readResource({
      uri: "altinkaya://enclosure/rt-014-ray-tipi-kutu-6966",
    });
    const body = JSON.parse((res.contents[0] as { text: string }).text);
    expect(body).toMatchObject({ code: "RT-014", variantCount: 2 });

    const prompt = await client.getPrompt({
      name: "select_enclosure",
      arguments: { contents: "PCB 80×50×20 mm", environment: "outdoor" },
    });
    expect(JSON.stringify(prompt.messages)).toContain("filter_enclosures");
  });
});
