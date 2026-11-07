import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CatalogIndex, SummarySchema, matches, type FilterCriteria } from "./catalog/query.js";
import { DocumentSchema, EnclosureSchema, type Enclosure } from "./catalog/schema.js";

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

const Box = z
  .object({ x: z.number().positive(), y: z.number().positive(), z: z.number().positive() })
  .describe("Size in mm; orientation does not matter");

const NOTE =
  "Dimensions are outer dimensions in mm. Usable inner space is smaller: check the drawing " +
  "(get_cad_files) before committing to a PCB size.";

function result<T extends object>(data: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function notFound(ref: string) {
  return {
    content: [
      { type: "text" as const, text: `No enclosure found for "${ref}". Try search_enclosures.` },
    ],
    isError: true,
  };
}

/** Registers every tool. `index` resolves once the catalog has loaded. */
export function registerTools(server: McpServer, index: () => Promise<CatalogIndex>): void {
  server.registerTool(
    "search_enclosures",
    {
      title: "Search enclosures",
      description:
        "Keyword search across the Altınkaya enclosure catalog: product codes (EC-1015, RT-014), " +
        "Turkish or English names, categories, materials and IP ratings.",
      inputSchema: z.object({
        query: z.string().min(1).describe('e.g. "EC-1015", "IP67 abs", "din rail", "el tipi"'),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      outputSchema: z.object({ total: z.number(), results: z.array(SummarySchema) }),
      annotations: READ_ONLY,
    },
    async ({ query, limit }) => {
      const idx = await index();
      const results = idx.search(query, limit).map((e) => idx.summary(e));
      return result({ total: results.length, results });
    },
  );

  server.registerTool(
    "filter_enclosures",
    {
      title: "Filter enclosures",
      description:
        "Parametric search: outer size limits, minimum IP rating, material and category. " +
        "Use min_outer_mm with your PCB or contents size as a first pass, then confirm the " +
        "inner space on the drawing. " +
        NOTE,
      inputSchema: z.object({
        min_outer_mm: Box.optional().describe("Outer dimensions must be at least this"),
        max_outer_mm: Box.optional().describe("Outer dimensions must be at most this"),
        min_ip: z
          .string()
          .regex(/^IP\s*[\dX][\dX]$/i)
          .optional()
          .describe('e.g. "IP65"'),
        materials: z.array(z.string()).optional().describe('Any of, e.g. ["ABS", "Alüminyum"]'),
        category: z
          .string()
          .optional()
          .describe("Category id, slug or name (includes subcategories)"),
        query: z.string().optional().describe("Optional keyword filter"),
        sort: z.enum(["volume", "code"]).default("volume").describe("volume = smallest first"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
      outputSchema: z.object({
        total: z.number(),
        offset: z.number(),
        results: z.array(SummarySchema),
        note: z.string(),
      }),
      annotations: READ_ONLY,
    },
    async (args) => {
      const idx = await index();
      const criteria: FilterCriteria = {};
      if (args.min_outer_mm) criteria.minOuter = args.min_outer_mm;
      if (args.max_outer_mm) criteria.maxOuter = args.max_outer_mm;
      if (args.min_ip) criteria.minIp = args.min_ip;
      if (args.materials) criteria.materials = args.materials;
      if (args.query) criteria.query = args.query;
      if (args.category) {
        const cat = idx.findCategory(args.category);
        if (!cat) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown category "${args.category}". Use list_categories.`,
              },
            ],
            isError: true,
          };
        }
        criteria.categoryIds = idx.subtree(cat.id);
      }
      const hits = idx.catalog.enclosures.filter((e) => matches(e, criteria, idx));
      hits.sort(
        args.sort === "code"
          ? (a, b) => a.code.localeCompare(b.code)
          : (a, b) => volume(a) - volume(b),
      );
      return result({
        total: hits.length,
        offset: args.offset,
        results: hits.slice(args.offset, args.offset + args.limit).map((e) => idx.summary(e)),
        note: NOTE,
      });
    },
  );

  server.registerTool(
    "get_enclosure",
    {
      title: "Get enclosure details",
      description:
        "Full details for one enclosure: all specifications, drawing dimensions, variants " +
        "(colors, lids, options with order codes and barcodes), documents and images.",
      inputSchema: z.object({
        code: z
          .string()
          .describe("Family code (EC-1015), variant code (EC-1015-7-0-0-G-0) or slug"),
      }),
      outputSchema: z.object({
        category: z.string(),
        enclosure: EnclosureSchema,
        note: z.string(),
      }),
      annotations: READ_ONLY,
    },
    async ({ code }) => {
      const idx = await index();
      const e = idx.find(code);
      if (!e) return notFound(code);
      return result({
        category: idx.categoryPath(e.categoryId).join(" › "),
        enclosure: e,
        note: NOTE,
      });
    },
  );

  server.registerTool(
    "compare_enclosures",
    {
      title: "Compare enclosures",
      description: "Side-by-side comparison of 2–10 enclosures; lists which fields differ.",
      inputSchema: z.object({ codes: z.array(z.string()).min(2).max(10) }),
      outputSchema: z.object({
        enclosures: z.array(SummarySchema.extend({ drawing: z.record(z.string(), z.number()) })),
        differences: z.array(z.string()),
        notFound: z.array(z.string()),
      }),
      annotations: READ_ONLY,
    },
    async ({ codes }) => {
      const idx = await index();
      const found: Enclosure[] = [];
      const missing: string[] = [];
      for (const c of codes) {
        const e = idx.find(c);
        if (e) found.push(e);
        else missing.push(c);
      }
      const rows = found.map((e) => ({ ...idx.summary(e), drawing: e.drawing }));
      const fields = ["category", "outerMm", "materials", "ipRating", "drawing"] as const;
      const differences = fields.filter(
        (f) => new Set(rows.map((r) => JSON.stringify(r[f]))).size > 1,
      );
      return result({ enclosures: rows, differences, notFound: missing });
    },
  );

  server.registerTool(
    "list_categories",
    {
      title: "List enclosure categories",
      description: "The enclosure category tree with the number of enclosures in each category.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        categories: z.array(
          z.object({
            id: z.number(),
            slug: z.string(),
            name: z.string(),
            parentId: z.number().nullable(),
            count: z.number().describe("Enclosures in this category and its subcategories"),
          }),
        ),
      }),
      annotations: READ_ONLY,
    },
    async () => {
      const idx = await index();
      const categories = idx.catalog.categories.map((c) => {
        const ids = idx.subtree(c.id);
        return { ...c, count: idx.catalog.enclosures.filter((e) => ids.has(e.categoryId)).length };
      });
      return result({ categories });
    },
  );

  server.registerTool(
    "get_cad_files",
    {
      title: "Get CAD files and drawings",
      description:
        "Download links for an enclosure's dimensioned PDF drawing, DXF, STEP 3D model, IP " +
        "certificate, CNC machining template and UV print template.",
      inputSchema: z.object({
        code: z.string(),
        types: z.array(DocumentSchema.shape.type).optional().describe("Only these document types"),
      }),
      outputSchema: z.object({
        code: z.string(),
        productUrl: z.string(),
        documents: z.array(DocumentSchema),
      }),
      annotations: READ_ONLY,
    },
    async ({ code, types }) => {
      const idx = await index();
      const e = idx.find(code);
      if (!e) return notFound(code);
      const documents = types ? e.documents.filter((d) => types.includes(d.type)) : e.documents;
      return result({ code: e.code, productUrl: e.url.en, documents });
    },
  );
}

function volume(e: Enclosure): number {
  return e.outer ? e.outer.a.max * e.outer.b.max * e.outer.c.max : Infinity;
}
