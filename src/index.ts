#!/usr/bin/env node
import { createServer as createHttpServer } from "node:http";
import { parseArgs } from "node:util";
import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { DEFAULT_CATALOG_URL, defaultCacheDir, loadCatalog } from "./catalog/load.js";
import { CatalogIndex } from "./catalog/query.js";
import { createServer } from "./server.js";
import { SERVER_VERSION } from "./version.js";

const HELP = `altinkaya-mcp ${SERVER_VERSION}: MCP server for the Altınkaya enclosure catalog

Usage:
  altinkaya-mcp                 serve over stdio (default; for desktop MCP clients)
  altinkaya-mcp --http          serve Streamable HTTP at http://<host>:<port>/mcp

Options:
  --http                 use Streamable HTTP instead of stdio
  --port <n>             HTTP port (default 3000, or $PORT)
  --host <addr>          HTTP bind address (default 127.0.0.1)
  -h, --help             show this help
  -v, --version          show the version

Environment:
  ALTINKAYA_MCP_OFFLINE=1          never download; use the cached or bundled catalog
  ALTINKAYA_MCP_CACHE_DIR=<dir>    where the downloaded catalog is cached
  ALTINKAYA_MCP_CATALOG_URL=<url>  catalog to download (default: this repo on GitHub)
  ALTINKAYA_MCP_ALLOWED_HOSTS=a,b  public host names accepted in --http mode
                                   (default: localhost only, as DNS-rebinding protection)
`;

const { values: args } = parseArgs({
  options: {
    http: { type: "boolean", default: false },
    port: { type: "string" },
    host: { type: "string", default: "127.0.0.1" },
    help: { type: "boolean", short: "h", default: false },
    version: { type: "boolean", short: "v", default: false },
  },
});

if (args.help) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (args.version) {
  process.stdout.write(`${SERVER_VERSION}\n`);
  process.exit(0);
}

const env = process.env;
const log = (msg: string) => process.stderr.write(`altinkaya-mcp: ${msg}\n`);

// Start loading immediately; tools await the same promise, so initialize is never blocked.
const index = loadCatalog({
  url: env.ALTINKAYA_MCP_CATALOG_URL ?? DEFAULT_CATALOG_URL,
  cacheDir: defaultCacheDir(env),
  offline: env.ALTINKAYA_MCP_OFFLINE === "1" || env.ALTINKAYA_MCP_OFFLINE === "true",
  bundledPath: new URL("../data/catalog.json", import.meta.url),
}).then(({ catalog, source }) => {
  log(`${catalog.enclosures.length} enclosures (${source}, ${catalog.generatedAt})`);
  return new CatalogIndex(catalog);
});
index.catch((err: Error) => log(err.message));

const factory = () => createServer(() => index);

if (args.http) {
  const port = Number(args.port ?? env.PORT ?? 3000);
  const allowedHosts = env.ALTINKAYA_MCP_ALLOWED_HOSTS?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const checks = allowedHosts?.length
    ? [hostHeaderValidation(allowedHosts)]
    : [localhostHostValidation(), localhostOriginValidation()];
  const handle = toNodeHandler(createMcpHandler(factory));

  createHttpServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }
    if (path !== "/mcp") {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found. MCP endpoint: /mcp");
      return;
    }
    // IncomingMessage satisfies the adapter at runtime; its types clash with exactOptionalPropertyTypes.
    if (checks.every((check) => check(req, res)))
      void handle(req as Parameters<typeof handle>[0], res);
  }).listen(port, args.host, () => log(`listening on http://${args.host}:${port}/mcp`));
} else {
  serveStdio(factory);
}
