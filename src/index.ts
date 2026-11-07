#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { DEFAULT_CATALOG_URL, defaultCacheDir, loadCatalog } from "./catalog/load.js";
import { CatalogIndex } from "./catalog/query.js";
import { createServer } from "./server.js";

const env = process.env;

// Start loading immediately; tools await the same promise, so initialize is never blocked.
const index = loadCatalog({
  url: env.ALTINKAYA_MCP_CATALOG_URL ?? DEFAULT_CATALOG_URL,
  cacheDir: defaultCacheDir(env),
  offline: env.ALTINKAYA_MCP_OFFLINE === "1" || env.ALTINKAYA_MCP_OFFLINE === "true",
  bundledPath: new URL("../data/catalog.json", import.meta.url),
}).then(({ catalog, source }) => {
  process.stderr.write(
    `altinkaya-mcp: ${catalog.enclosures.length} enclosures (${source}, ${catalog.generatedAt})\n`,
  );
  return new CatalogIndex(catalog);
});
index.catch((err: Error) => process.stderr.write(`altinkaya-mcp: ${err.message}\n`));

serveStdio(() => createServer(() => index));
