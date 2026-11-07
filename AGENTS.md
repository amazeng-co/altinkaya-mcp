# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

An MCP server (TypeScript, `@modelcontextprotocol/server` v2) exposing the Altınkaya enclosure
catalog. A crawler run in CI produces `data/catalog.json`; the server loads it (remote → cache →
bundled) and answers tool calls from memory. See `ROADMAP.md` for the architecture.

## Commands

- `npm run lint && npm run typecheck && npm test`: must pass before committing
- `npm run build`: compile to `dist/`

## Conventions

- ESM, strict TypeScript, Node 22.12+. Import local files with the `.js` extension.
- Every tool is read-only: set `annotations.readOnlyHint: true` and return `structuredContent`
  that matches its `outputSchema`.
- Validate all external data (crawled pages, remote catalog) with the zod schemas in `src/`.
- Never write to stdout except through the MCP transport; log to stderr.
- Do not edit `data/` by hand.
- Commit messages: English, imperative mood, no co-author trailers.
