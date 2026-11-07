# Roadmap

`altinkaya-mcp` gives AI assistants the full [Altınkaya](https://www.altinkaya.com) electronic
enclosure catalog: search, parametric filtering ("fits an 80×50×20 mm PCB, IP67, ABS"),
comparison, and CAD files (STEP / PDF / DXF).

## Architecture

```
Maintainer's machine (monthly, reminded by a scheduled issue)
  crawler drives a tab in the maintainer's Chrome over CDP:
  /tr/categories/enclosures → category tree → leaf category pages → product pages
  → Next.js flight payload (structured JSON) + English names from /en/ page titles
  → data/catalog.json  (validated with the shared zod schema, reviewed and merged as a PR)

MCP server (runs locally via npx / .mcpb / Docker, or remotely over HTTP)
  1. fetch latest catalog.json from GitHub (ETag, conditional GET)
  2. cache in the user cache dir; fall back to the snapshot bundled in the package
  3. load into memory; all search/filter runs in memory (~1,300 enclosures)
  CAD files are referenced by URL and downloaded on demand into the cache dir.
```

Why this shape: Altınkaya has no public parametric API (server-rendered Next.js over Odoo,
`/api` disallowed in robots.txt), the catalog is gated behind sign-in for browsing, and new
models appear slowly. A monthly, rate-limited crawl through a maintainer's own session keeps load
off the site, and shipping the result as a file makes every client fast and offline-capable.

## Phase 0: Repository foundations

- [x] Node 22+, TypeScript (strict, ESM), `@modelcontextprotocol/server` v2, zod, vitest
- [x] ESLint + Prettier, `.editorconfig`, `.nvmrc`
- [x] Community files: `LICENSE` (MIT), `README.md`, `README.tr.md`, `CONTRIBUTING.md`,
      `SECURITY.md`, `CODE_OF_CONDUCT.md`, `AGENTS.md` (`CHANGELOG.md` is created by the first release)
- [x] Issue/PR templates, Dependabot
- [ ] CODEOWNERS (needs maintainer GitHub handles)
- [x] Changesets for versioning

## Phase 1: Crawler and catalog schema

- [x] `Enclosure` zod schema shared by crawler and server: code, names (TR/EN), category,
      variants (code, barcode, options), outer dimensions A×B×C, drawing dimensions (E1…P2),
      materials, IP rating, operating temperature, all raw specs, documents, images, URLs
- [x] Parse the flight payload (`variantMap`, `attributeLines`, `features`, `attachments`,
      category tree, dimension tables) instead of scraping visible text
- [x] Documents: drawing PDF, DXF, STEP, IP certificate, CNC machining template, print template
- [x] Polite crawling: one request at a time, ~1.5 s delay with jitter, retries with backoff
- [x] Recorded (logged-out, gzipped) fixtures + parser unit tests; added/removed/changed report
- [x] No prices, stock or account data in the catalog (enforced by a test)
- [ ] Inner dimensions: drawing letters mean different things per family, and inner length/depth
      are often only on the PDF drawing (e.g. EC-1015: inner width = E2, inner length 128.5 mm and
      inner depth 79 mm appear only on the drawing). Needs a reviewed per-family mapping file.

## Phase 2: MCP server

Tools (all `readOnlyHint: true`, `idempotentHint: true`, with `outputSchema` + `structuredContent`):

- [ ] `search_enclosures`: keyword / code search
- [ ] `filter_enclosures`: min inner/outer dimensions (PCB fit with clearance), IP rating,
      material, mounting (DIN rail, wall, rack, handheld, panel), category; sort + pagination
- [ ] `get_enclosure`: full details incl. variants and documents
- [ ] `compare_enclosures`: 2–10 products side by side, differences highlighted
- [ ] `list_categories`: category tree with counts
- [ ] `get_cad_files`: document links; optional download into the cache dir
- [ ] Resources: `altinkaya://enclosure/{code}`, `altinkaya://category/{slug}`
- [ ] Prompts: `select_enclosure` (guided selection from PCB size + environment)
- [ ] Catalog loader: remote → cache → bundled; `ALTINKAYA_MCP_OFFLINE`, `ALTINKAYA_MCP_CACHE_DIR`,
      `ALTINKAYA_MCP_LANG`, `ALTINKAYA_MCP_CATALOG_URL`
- [ ] Transports: stdio (default) and Streamable HTTP (`--http --port`, `createMcpHandler`)

## Phase 3: Quality

- [ ] Unit tests (filters, fit math, schema, loader fallbacks)
- [ ] E2E protocol tests with a real MCP client over stdio and HTTP
- [ ] Tool annotation test (every tool read-only); MCP Inspector smoke check in CI
- [ ] CI matrix: Linux / macOS / Windows × Node 22 / 24

## Phase 4: Distribution and one-click install

- [ ] npm: `altinkaya-mcp` (`npx -y altinkaya-mcp`), provenance enabled
- [ ] MCP Registry: `server.json` (`io.github.amazeng-co/altinkaya-mcp`), `mcpName`, OIDC publish workflow
- [ ] Claude Desktop: `.mcpb` bundle attached to each GitHub release (double-click install)
- [ ] Docker image on GHCR (stdio and HTTP)
- [ ] README one-click buttons: VS Code, VS Code Insiders, Cursor, LM Studio, Goose;
      copy-paste commands for Claude Code, Codex, Gemini CLI, Windsurf, Zed, Cline
- [ ] Hosted remote endpoint (Streamable HTTP) for zero-install clients; host to be decided

## Phase 5: Automation

- [ ] `ci.yml`: lint, typecheck, test, build, pack check
- [ ] `crawl.yml`: daily cron, validate, open/merge data PR when the catalog changes
- [ ] `release.yml`: changesets → npm publish → GitHub release (+ `.mcpb`) → Docker → MCP Registry

## Known risks

- Site structure changes break the crawler: schema validation + CI failure make it loud.
- Drawing-letter dimensions (B1, D1, …) need a per-family mapping to become inner dimensions.
- Prices and stock are login-gated / under `/api`: out of scope unless Altınkaya grants access.
- Unofficial project: we will ask Altınkaya for approval and, ideally, an official data export.
