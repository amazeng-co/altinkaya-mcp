#!/usr/bin/env bash
# Builds altinkaya-mcp.mcpb, the one-click Claude Desktop bundle.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('./package.json').version")
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

npm run build
cp -r dist package.json package-lock.json LICENSE README.md README.en.md "$stage/"
[ -d data ] && cp -r data "$stage/" && rm -f "$stage/data/catalog.sample.json"
node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('mcpb/manifest.json', 'utf8'));
  m.version = process.argv[1];
  fs.writeFileSync(process.argv[2] + '/manifest.json', JSON.stringify(m, null, 2));
" "$version" "$stage"
(cd "$stage" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null)

npx -y @anthropic-ai/mcpb@2.1.2 validate "$stage/manifest.json"
npx -y @anthropic-ai/mcpb@2.1.2 pack "$stage" altinkaya-mcp.mcpb
