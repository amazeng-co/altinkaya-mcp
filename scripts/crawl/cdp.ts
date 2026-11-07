/**
 * Minimal Chrome DevTools Protocol client. The crawler runs requests inside a tab of the
 * maintainer's own Chrome, so pages are fetched exactly as that browser session sees them.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Locations of Chrome's `DevToolsActivePort` file (written when remote debugging is on). */
function profileDirs(): string[] {
  const home = homedir();
  const local = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  return [
    join(home, ".config", "google-chrome"),
    join(home, ".config", "chromium"),
    join(home, "Library", "Application Support", "Google", "Chrome"),
    join(home, "Library", "Application Support", "Chromium"),
    join(local, "Google", "Chrome", "User Data"),
    join(local, "Chromium", "User Data"),
  ];
}

/** Resolves the browser WebSocket endpoint: env override, DevToolsActivePort, then :9222. */
export async function resolveEndpoint(): Promise<string> {
  const override = process.env.ALTINKAYA_CDP_URL;
  if (override) return override;
  for (const dir of profileDirs()) {
    try {
      const [port, path] = (await readFile(join(dir, "DevToolsActivePort"), "utf8")).split("\n");
      if (port && path) return `ws://127.0.0.1:${port.trim()}${path.trim()}`;
    } catch {
      // Not this browser.
    }
  }
  try {
    const res = await fetch("http://127.0.0.1:9222/json/version");
    const { webSocketDebuggerUrl } = (await res.json()) as { webSocketDebuggerUrl: string };
    return webSocketDebuggerUrl;
  } catch {
    throw new Error(
      "Chrome remote debugging not found. Enable it at chrome://inspect/#remote-debugging " +
        "(or set ALTINKAYA_CDP_URL to the browser WebSocket URL).",
    );
  }
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
      };
      const p = msg.id === undefined ? undefined : this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id!);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    });
    ws.addEventListener("close", () => {
      for (const p of this.pending.values()) p.reject(new Error("CDP connection closed"));
      this.pending.clear();
    });
  }

  static connect(url: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener("open", () => resolve(new CdpClient(ws)), { once: true });
      ws.addEventListener(
        "error",
        () =>
          reject(new Error(`Cannot connect to ${url}. Did you allow remote debugging in Chrome?`)),
        { once: true },
      );
    });
  }

  send<T>(method: string, params: object = {}, sessionId?: string): Promise<T> {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    });
  }

  close(): void {
    this.ws.close();
  }
}

export interface PageFetcher {
  /** GETs a same-origin path from inside the page, with the browser's cookies. */
  get(path: string): Promise<{ status: number; text: string }>;
  close(): Promise<void>;
}

/** Opens a background tab on `origin` and returns a fetcher bound to it. */
export async function openPage(client: CdpClient, origin: string): Promise<PageFetcher> {
  const { targetId } = await client.send<{ targetId: string }>("Target.createTarget", {
    url: origin,
    background: true,
  });
  const { sessionId } = await client.send<{ sessionId: string }>("Target.attachToTarget", {
    targetId,
    flatten: true,
  });

  const evaluate = async <T>(expression: string): Promise<T> => {
    const { result, exceptionDetails } = await client.send<{
      result: { value: T };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    }>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
    return result.value;
  };

  for (let i = 0; i < 100; i++) {
    const href = await evaluate<string>("document.readyState === 'complete' ? location.href : ''");
    if (href.startsWith(origin)) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    get: (path) =>
      evaluate(
        `fetch(${JSON.stringify(path)}, { credentials: "include" })` +
          `.then(async (r) => ({ status: r.status, text: await r.text() }))`,
      ),
    close: async () => {
      await client.send("Target.closeTarget", { targetId });
    },
  };
}
