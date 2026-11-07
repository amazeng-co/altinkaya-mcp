// Copies the package.json version into server.json and mcpb/manifest.json.
// Runs after `changeset version` (npm run version) so every release artifact agrees.
import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const update = (path, fn) => {
  const json = JSON.parse(readFileSync(path, "utf8"));
  fn(json);
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
};

update("server.json", (s) => {
  s.version = version;
  for (const p of s.packages) {
    if (p.registryType === "oci") p.identifier = p.identifier.replace(/:[^:]+$/, `:${version}`);
    else p.version = version;
  }
});
update("mcpb/manifest.json", (m) => {
  m.version = version;
});
