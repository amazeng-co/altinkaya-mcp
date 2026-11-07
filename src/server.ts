import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { CatalogIndex } from "./catalog/query.js";
import { registerTools } from "./tools.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";

const INSTRUCTIONS = `Altınkaya electronic enclosure catalog (Turkish manufacturer).
Workflow for picking an enclosure:
1. filter_enclosures with min_outer_mm = contents size (plus clearance), min_ip, materials or category.
2. get_enclosure for the shortlisted codes; compare_enclosures to weigh options.
3. get_cad_files for the drawing (inner dimensions, PCB bosses) and STEP model.
All dimensions are millimetres. Listed dimensions are OUTER; usable inner space is smaller, so
confirm it on the drawing. Product names are Turkish with English names when available.
Data is crawled monthly from altinkaya.com; prices and stock are not included.`;

export function createServer(index: () => Promise<CatalogIndex>): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  registerTools(server, index);

  server.registerResource(
    "enclosure",
    new ResourceTemplate("altinkaya://enclosure/{slug}", {
      list: async () => {
        const idx = await index();
        return {
          resources: idx.catalog.enclosures.map((e) => ({
            uri: `altinkaya://enclosure/${e.slug}`,
            name: e.code,
            title: e.name.en ?? e.name.tr,
            mimeType: "application/json",
          })),
        };
      },
      complete: {
        slug: async (value) => {
          const idx = await index();
          const prefix = value.toLowerCase();
          return idx.catalog.enclosures
            .map((e) => e.slug)
            .filter((s) => s.startsWith(prefix))
            .slice(0, 50);
        },
      },
    }),
    {
      title: "Altınkaya enclosure",
      description: "Full catalog record for one enclosure",
      mimeType: "application/json",
    },
    async (uri, { slug }) => {
      const idx = await index();
      const e = idx.find(String(slug));
      if (!e) throw new Error(`Unknown enclosure: ${String(slug)}`);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(idx.detail(e), null, 2),
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "select_enclosure",
    {
      title: "Select an enclosure",
      description: "Guided enclosure selection from what goes inside and where it will be used",
      argsSchema: z.object({
        contents: z.string().describe('What goes inside, e.g. "PCB 80×50×20 mm, 2 cable glands"'),
        environment: z
          .string()
          .optional()
          .describe('Where it will be used, e.g. "outdoor, rain", "DIN rail cabinet", "handheld"'),
      }),
    },
    ({ contents, environment }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Help me choose an Altınkaya enclosure.\nContents: ${contents}\n` +
              (environment ? `Environment: ${environment}\n` : "") +
              "Derive the required IP rating, material and mounting style from the environment. " +
              "Use filter_enclosures (contents size plus clearance as min_outer_mm), then " +
              "get_enclosure and compare_enclosures for the best 3 candidates, and check inner " +
              "dimensions on the drawing via get_cad_files. Recommend one with reasons and its " +
              "order code.",
          },
        },
      ],
    }),
  );

  return server;
}
