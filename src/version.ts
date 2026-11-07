import { readFileSync } from "node:fs";

// Resolves from both src/ (tsx, vitest) and dist/ (published package).
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

export const SERVER_NAME = "altinkaya-mcp";
export const SERVER_VERSION = pkg.version;
