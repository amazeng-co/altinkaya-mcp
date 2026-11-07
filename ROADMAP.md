# Roadmap

`altinkaya-mcp` gives AI assistants the full [Altınkaya](https://www.altinkaya.com) electronic
enclosure catalog: search, parametric filtering ("fits an 80×50×20 mm PCB, IP67, ABS"),
comparison, and CAD files (STEP / PDF / DXF).

## Architecture

```
GitHub Actions (daily cron)
  crawler: sitemap.xml → /en/products/* pages → Next.js RSC payload (structured JSON)
         + category pages → dimension comparison tables
  → data/catalog.json  (validated with the shared zod schema, committed + attached to a release)

MCP server (runs locally via npx / .mcpb / Docker, or remotely over HTTP)
  1. fetch latest catalog.json from GitHub (ETag, conditional GET)
  2. cache in the user cache dir; fall back to the snapshot bundled in the package
  3. load into memory; all search/filter runs in memory (~1,300 enclosures)
  CAD files are referenced by URL and downloaded on demand into the cache dir.
```

Why this shape: Altınkaya has no public parametric API (server-rendered Next.js over Odoo,
`/api` disallowed in robots.txt), the catalog is small, and crawling once in CI keeps load off
the site and makes every client fast and offline-capable.

## Phase 0: Repository foundations

- [x] Node 22+, TypeScript (strict, ESM), `@modelcontextprotocol/server` v2, zod, vitest
- [x] ESLint + Prettier, `.editorconfig`, `.nvmrc`
- [x] Community files: `LICENSE` (MIT), `README.md`, `README.tr.md`, `CONTRIBUTING.md`,
      `SECURITY.md`, `CODE_OF_CONDUCT.md`, `AGENTS.md` (`CHANGELOG.md` is created by the first release)
- [x] Issue/PR templates, Dependabot
- [ ] CODEOWNERS (needs maintainer GitHub handles)
- [x] Changesets for versioning

## Phase 1: Crawler and catalog schema

- [ ] `Enclosure` zod schema shared by crawler and server: code, name, family, category path,
      variants (code, barcode, attributes), outer dimensions A×B×C, raw drawing dimensions
      (B1…E4, P1, P2), material, color, IP rating, operating temperature, flame rating,
      package qty, documents (STEP/PDF/DXF URLs), images, product URL, multilingual names
- [ ] Parse the RSC payload (`variantMap`, `attributeLines`, spec table) instead of scraping text
- [ ] Category dimension tables + technical drawing per family; a reviewed mapping file turns
      drawing letters into semantic inner dimensions (usable width/length/height)
- [ ] Polite crawling: concurrency limit, delay, retries, identifiable User-Agent, robots.txt
- [ ] Recorded fixtures + parser unit tests; crawl diff report (added/removed/changed)

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
