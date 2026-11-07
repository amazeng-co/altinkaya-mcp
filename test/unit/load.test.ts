import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCatalog } from "../../src/catalog/load.js";
import type { Catalog } from "../../src/catalog/schema.js";
import { testCatalog } from "../helpers.js";

let catalog: Catalog;
let server: Server;
let url: string;
let dir: string;
let respond: (req: { etag?: string | undefined }) => {
  status: number;
  body?: string;
  etag?: string;
};

beforeEach(async () => {
  catalog = await testCatalog();
  dir = await mkdtemp(join(tmpdir(), "altinkaya-mcp-"));
  server = createServer((req, res) => {
    const r = respond({ etag: req.headers["if-none-match"] });
    res.writeHead(r.status, r.etag ? { ETag: r.etag } : {});
    res.end(r.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/catalog.json`;
});

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

const opts = () => ({
  url,
  cacheDir: join(dir, "cache"),
  offline: false,
  bundledPath: join(dir, "bundled.json"),
});

describe("loadCatalog", () => {
  it("downloads the remote catalog and caches it with its ETag", async () => {
    respond = () => ({ status: 200, body: JSON.stringify(catalog), etag: '"v1"' });
    const first = await loadCatalog(opts());
    expect(first.source).toBe("remote");
    expect(await readFile(join(dir, "cache", "catalog.etag"), "utf8")).toBe('"v1"');

    respond = ({ etag }) => (etag === '"v1"' ? { status: 304 } : { status: 500 });
    const second = await loadCatalog(opts());
    expect(second.source).toBe("cache");
    expect(second.catalog.enclosures).toHaveLength(2);
  });

  it("falls back to the bundled snapshot when the remote is down or invalid", async () => {
    await writeFile(join(dir, "bundled.json"), JSON.stringify(catalog));
    respond = () => ({ status: 503 });
    expect((await loadCatalog(opts())).source).toBe("bundled");
    respond = () => ({ status: 200, body: '{"not":"a catalog"}' });
    expect((await loadCatalog(opts())).source).toBe("bundled");
  });

  it("does not touch the network when offline", async () => {
    await writeFile(join(dir, "bundled.json"), JSON.stringify(catalog));
    respond = () => {
      throw new Error("network used");
    };
    expect((await loadCatalog({ ...opts(), offline: true })).source).toBe("bundled");
  });

  it("fails clearly when nothing is available", async () => {
    respond = () => ({ status: 404 });
    await expect(loadCatalog(opts())).rejects.toThrow(/No Altınkaya catalog/);
  });
});
