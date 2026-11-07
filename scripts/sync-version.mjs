// Copies the package.json version into server.json and mcpb/manifest.json.
// Runs after `changeset version` (npm run version) so every release artifact agrees.
// Edits only the version strings, so the files keep their formatting.
import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const edit = (path, fn) => writeFileSync(path, fn(readFileSync(path, "utf8")));

edit("server.json", (s) =>
  s
    .replace(/"version": "[^"]+"/g, `"version": "${version}"`)
    .replace(/(ghcr\.io\/amazeng-co\/altinkaya-mcp:)[^"]+/, `$1${version}`),
);
edit("mcpb/manifest.json", (s) => s.replace(/("version": )"[^"]+"/, `$1"${version}"`));
