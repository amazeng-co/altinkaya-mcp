import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("release metadata", () => {
  const pkg = json("package.json");
  const server = json("server.json");
  const manifest = json("mcpb/manifest.json");

  it("keeps every artifact on the package version", () => {
    expect(server.version).toBe(pkg.version);
    expect(manifest.version).toBe(pkg.version);
    for (const p of server.packages) {
      if (p.registryType === "oci") expect(p.identifier).toMatch(new RegExp(`:${pkg.version}$`));
      else expect(p.version).toBe(pkg.version);
    }
  });

  it("uses the same registry name everywhere", () => {
    expect(server.name).toBe(pkg.mcpName);
    expect(
      server.packages.find((p: { registryType: string }) => p.registryType === "npm").identifier,
    ).toBe(pkg.name);
  });

  it("lists every tool in the Claude Desktop manifest", async () => {
    const { Client, InMemoryTransport } = await import("@modelcontextprotocol/client");
    const { createServer } = await import("../../src/server.js");
    const { CatalogIndex } = await import("../../src/catalog/query.js");
    const { testCatalog } = await import("../helpers.js");
    const index = Promise.resolve(new CatalogIndex(await testCatalog()));
    const [c, s] = InMemoryTransport.createLinkedPair();
    await createServer(() => index).connect(s);
    const client = new Client({ name: "t", version: "0" });
    await client.connect(c);
    const { tools } = await client.listTools();
    expect(manifest.tools.map((t: { name: string }) => t.name).sort()).toEqual(
      tools.map((t) => t.name).sort(),
    );
  });
});
