import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CatalogSchema, type Catalog } from "./schema.js";

export const DEFAULT_CATALOG_URL =
  "https://raw.githubusercontent.com/amazeng-co/altinkaya-mcp/main/data/catalog.json";

export interface LoadOptions {
  /** Remote catalog to try first. */
  url: string;
  /** Directory for the downloaded copy and its ETag. */
  cacheDir: string;
  /** Skip the network entirely. */
  offline: boolean;
  /** Snapshot shipped with the package. */
  bundledPath: URL | string;
  timeoutMs?: number;
}

export type CatalogSource = "remote" | "cache" | "bundled";

export interface LoadedCatalog {
  catalog: Catalog;
  source: CatalogSource;
}

/** Platform cache directory, overridable with ALTINKAYA_MCP_CACHE_DIR. */
export function defaultCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.ALTINKAYA_MCP_CACHE_DIR) return env.ALTINKAYA_MCP_CACHE_DIR;
  const home = homedir();
  const base =
    process.platform === "win32"
      ? (env.LOCALAPPDATA ?? join(home, "AppData", "Local"))
      : process.platform === "darwin"
        ? join(home, "Library", "Caches")
        : (env.XDG_CACHE_HOME ?? join(home, ".cache"));
  return join(base, "altinkaya-mcp");
}

async function readCatalog(path: URL | string): Promise<Catalog | undefined> {
  try {
    return CatalogSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return undefined;
  }
}

/** Newest available catalog: remote (conditional GET) → cache → bundled snapshot. */
export async function loadCatalog(opts: LoadOptions): Promise<LoadedCatalog> {
  const cacheFile = join(opts.cacheDir, "catalog.json");
  const etagFile = join(opts.cacheDir, "catalog.etag");
  const cached = await readCatalog(cacheFile);

  if (!opts.offline) {
    try {
      const etag = cached ? (await readFile(etagFile, "utf8").catch(() => "")).trim() : "";
      const res = await fetch(opts.url, {
        headers: etag ? { "If-None-Match": etag } : {},
        signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
      });
      if (res.status === 304 && cached) return { catalog: cached, source: "cache" };
      if (res.ok) {
        const text = await res.text();
        const catalog = CatalogSchema.parse(JSON.parse(text));
        await mkdir(opts.cacheDir, { recursive: true });
        await writeFile(cacheFile, text);
        await writeFile(etagFile, res.headers.get("etag") ?? "");
        return { catalog, source: "remote" };
      }
    } catch {
      // Offline, timed out, or an invalid remote file: fall back below.
    }
  }

  const bundled = await readCatalog(opts.bundledPath);
  // Prefer whichever local copy is newer; the bundled one may be fresher after an upgrade.
  if (cached && (!bundled || cached.generatedAt >= bundled.generatedAt)) {
    return { catalog: cached, source: "cache" };
  }
  if (bundled) return { catalog: bundled, source: "bundled" };
  throw new Error("No Altınkaya catalog available (remote, cache and bundled copy all failed).");
}
