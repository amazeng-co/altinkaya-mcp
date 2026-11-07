/**
 * Crawls the Altınkaya enclosure catalog through the maintainer's Chrome session and writes
 * data/catalog.json. Run monthly:
 *
 *   1. Enable remote debugging in Chrome: chrome://inspect/#remote-debugging
 *   2. npm run crawl            (add `-- --limit 5` for a quick trial)
 *
 * Options: --limit <n>   only crawl the first n products (writes data/catalog.sample.json)
 *          --out <path>  output file (default data/catalog.json)
 *          --no-en       skip English names (halves the number of requests)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import {
  CatalogSchema,
  type Catalog,
  type Category,
  type Enclosure,
} from "../../src/catalog/schema.js";
import { CdpClient, openPage, resolveEndpoint, type PageFetcher } from "./cdp.js";
import {
  ORIGIN,
  linkedCategorySlugs,
  parseCategoryProducts,
  parseCategoryTree,
  parseProduct,
} from "./parse.js";

const DELAY_MS = Number(process.env.ALTINKAYA_CRAWL_DELAY_MS ?? 1500);
const MAX_ERROR_RATIO = 0.05;

const { values: args } = parseArgs({
  options: {
    limit: { type: "string" },
    out: { type: "string" },
    "no-en": { type: "boolean", default: false },
  },
});

const out = args.out ?? (args.limit ? "data/catalog.sample.json" : "data/catalog.json");
const log = (msg: string) => process.stderr.write(`${msg}\n`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sequential, rate-limited GET with retries; one request at a time keeps load on the site low. */
function politeGetter(page: PageFetcher) {
  let last = 0;
  return async (path: string): Promise<string> => {
    for (let attempt = 1; ; attempt++) {
      const wait = last + DELAY_MS + Math.random() * 500 - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      try {
        const res = await page.get(path);
        if (res.status === 200) return res.text;
        if (res.status === 404) throw Object.assign(new Error(`404 ${path}`), { fatal: true });
        throw new Error(`HTTP ${res.status} for ${path}`);
      } catch (err) {
        if ((err as { fatal?: boolean }).fatal || attempt >= 3) throw err;
        log(`  retry ${attempt} ${path}: ${(err as Error).message}`);
        await sleep(DELAY_MS * 2 ** attempt);
      }
    }
  };
}

/** Enclosure categories: the groups linked from /categories/enclosures and all their descendants. */
function enclosureCategories(tree: Category[], enclosuresHtml: string): Category[] {
  const linked = new Set(linkedCategorySlugs(enclosuresHtml));
  const keep = new Set(
    tree.filter((c) => c.parentId === null && linked.has(c.slug)).map((c) => c.id),
  );
  for (let grew = true; grew;) {
    grew = false;
    for (const c of tree) {
      if (c.parentId !== null && keep.has(c.parentId) && !keep.has(c.id)) {
        keep.add(c.id);
        grew = true;
      }
    }
  }
  return tree.filter((c) => keep.has(c.id));
}

async function previousCodes(path: string): Promise<Map<string, string>> {
  try {
    const old = CatalogSchema.parse(JSON.parse(await readFile(path, "utf8")));
    return new Map(old.enclosures.map((e) => [e.slug, JSON.stringify(e)]));
  } catch {
    return new Map();
  }
}

async function main() {
  const client = await CdpClient.connect(await resolveEndpoint());
  const page = await openPage(client, `${ORIGIN}/tr`);
  const get = politeGetter(page);

  try {
    const enclosuresHtml = await get("/tr/categories/enclosures");
    log(
      /\\?"isLoggedIn\\?":true/.test(enclosuresHtml)
        ? "Using a logged-in session."
        : "Not logged in.",
    );

    const categories = enclosureCategories(parseCategoryTree(enclosuresHtml), enclosuresHtml);
    const parents = new Set(categories.map((c) => c.parentId));
    const leaves = categories.filter((c) => !parents.has(c.id));
    log(`${categories.length} enclosure categories, ${leaves.length} leaves.`);

    const slugs = new Set<string>();
    for (const [i, c] of leaves.entries()) {
      const found = parseCategoryProducts(await get(`/tr/categories/${c.slug}`));
      found.forEach((s) => slugs.add(s));
      log(`[${i + 1}/${leaves.length}] ${c.name}: ${found.length} products`);
    }

    const limit = args.limit ? Number(args.limit) : Infinity;
    const queue = [...slugs].slice(0, limit);
    const categoryIds = new Set(categories.map((c) => c.id));
    const enclosures: Enclosure[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const [i, slug] of queue.entries()) {
      try {
        const tr = await get(`/tr/products/${slug}`);
        const en = args["no-en"] ? undefined : await get(`/en/products/${slug}`);
        const enclosure = parseProduct(tr, en);
        // Category pages also link accessories; keep only products filed under an enclosure category.
        if (categoryIds.has(enclosure.categoryId)) enclosures.push(enclosure);
        else skipped++;
        log(`[${i + 1}/${queue.length}] ${enclosure.code}`);
      } catch (err) {
        errors.push(`${slug}: ${(err as Error).message}`);
        log(`[${i + 1}/${queue.length}] FAILED ${slug}: ${(err as Error).message}`);
      }
    }

    if (errors.length > queue.length * MAX_ERROR_RATIO) {
      throw new Error(`${errors.length}/${queue.length} products failed; not writing the catalog.`);
    }

    const catalog: Catalog = CatalogSchema.parse({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: ORIGIN,
      categories,
      enclosures: enclosures.sort((a, b) => a.code.localeCompare(b.code) || a.id - b.id),
    });

    const before = await previousCodes(out);
    const after = new Map(catalog.enclosures.map((e) => [e.slug, JSON.stringify(e)]));
    const added = [...after.keys()].filter((s) => !before.has(s));
    const removed = [...before.keys()].filter((s) => !after.has(s));
    const changed = [...after.keys()].filter(
      (s) => before.has(s) && before.get(s) !== after.get(s),
    );

    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, `${JSON.stringify(catalog, null, 2)}\n`);

    log(`\nWrote ${catalog.enclosures.length} enclosures to ${out}`);
    log(
      `added ${added.length}, removed ${removed.length}, changed ${changed.length}, skipped ${skipped}`,
    );
    for (const e of errors) log(`  error: ${e}`);
  } finally {
    await page.close().catch(() => {});
    client.close();
  }
}

main().catch((err: Error) => {
  log(`crawl failed: ${err.message}`);
  process.exit(1);
});
