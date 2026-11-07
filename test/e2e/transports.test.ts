import { spawn, type ChildProcess } from "node:child_process";
import { request } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testCatalog } from "../helpers.js";

// Runs the real entry point as a child process, offline, against a cached test catalog.
const ENTRY = ["--import", "tsx", "src/index.ts"];
let env: Record<string, string>;

beforeAll(async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "altinkaya-mcp-e2e-"));
  await writeFile(join(cacheDir, "catalog.json"), JSON.stringify(await testCatalog()));
  env = {
    ...(process.env as Record<string, string>),
    ALTINKAYA_MCP_OFFLINE: "1",
    ALTINKAYA_MCP_CACHE_DIR: cacheDir,
  };
});

async function roundTrip(client: Client) {
  const { tools } = await client.listTools();
  expect(tools).toHaveLength(6);
  const res = (await client.callTool({
    name: "get_enclosure",
    arguments: { code: "EC-1015" },
  })) as {
    structuredContent: { enclosure: { code: string } };
  };
  expect(res.structuredContent.enclosure.code).toBe("EC-1015");
}

describe("stdio transport", () => {
  it("serves tools from a child process", async () => {
    const client = new Client({ name: "e2e", version: "0.0.0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ENTRY, env }));
    try {
      await roundTrip(client);
    } finally {
      await client.close();
    }
  });
});

describe("Streamable HTTP transport", () => {
  let child: ChildProcess;
  const port = 39170 + Math.floor(Math.random() * 500);

  beforeAll(async () => {
    child = spawn(process.execPath, [...ENTRY, "--http", "--port", String(port)], { env });
    await new Promise<void>((resolve, reject) => {
      child.stderr!.on("data", (d: Buffer) => d.toString().includes("listening") && resolve());
      child.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
    });
  });

  afterAll(() => {
    child.kill();
  });

  it("serves tools over HTTP", async () => {
    const client = new Client({ name: "e2e", version: "0.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)),
    );
    try {
      await roundTrip(client);
    } finally {
      await client.close();
    }
  });

  it("answers health checks and rejects foreign Host headers", async () => {
    expect(await (await fetch(`http://127.0.0.1:${port}/healthz`)).text()).toBe("ok");
    // fetch() cannot override Host, so use node:http to simulate a DNS-rebinding request.
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(
        {
          host: "127.0.0.1",
          port,
          path: "/mcp",
          method: "POST",
          headers: { host: "evil.example" },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on("error", reject);
      req.end("{}");
    });
    expect(status).toBe(403);
  });
});
