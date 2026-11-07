<div align="center">

# Altınkaya MCP

**Give your AI assistant the full [Altınkaya](https://www.altinkaya.com) electronic enclosure catalog.**

Search ~500 enclosure families, filter by size, IP rating and material, compare models and pull
drawings and STEP files, from Claude, Cursor, VS Code and any other MCP client.

[![npm](https://img.shields.io/npm/v/altinkaya-mcp?color=cb3837&label=npm)](https://www.npmjs.com/package/altinkaya-mcp)
[![CI](https://github.com/amazeng-co/altinkaya-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/amazeng-co/altinkaya-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Türkçe](README.md)

</div>

## Install in one click

[<img src="https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522altinkaya%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522altinkaya-mcp%2522%255D%257D)
[<img src="https://img.shields.io/badge/VS_Code_Insiders-Install-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Install in VS Code Insiders">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522altinkaya%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522altinkaya-mcp%2522%255D%257D)
[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor" height="20">](https://cursor.com/en/install-mcp?name=altinkaya&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImFsdGlua2F5YS1tY3AiXX0%3D)
[<img src="https://files.lmstudio.ai/deeplink/mcp-install-light.svg" alt="Add to LM Studio" height="20">](https://lmstudio.ai/install-mcp?name=altinkaya&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImFsdGlua2F5YS1tY3AiXX0%3D)
[<img src="https://block.github.io/goose/img/extension-install-dark.svg" alt="Install in Goose" height="20">](https://block.github.io/goose/extension?cmd=npx&arg=-y&arg=altinkaya-mcp&id=altinkaya&name=Alt%C4%B1nkaya&description=Alt%C4%B1nkaya%20enclosure%20catalog%3A%20search%2C%20filter%2C%20compare%20and%20CAD%20files)

**Claude Desktop:** download `altinkaya-mcp.mcpb` from the
[latest release](https://github.com/amazeng-co/altinkaya-mcp/releases/latest) and double-click it.

All you need is [Node.js](https://nodejs.org) 22.12 or newer. No account, no API key.

## Try it

> _I have an 80 × 50 × 20 mm PCB for an outdoor sensor. Which Altınkaya enclosures fit, and which
> is the smallest IP67 one?_

> _Compare EC-1015 and EC-1515 and give me the STEP file of the better one._

> _Show me DIN rail enclosures that are at most 4 modules wide._

## What it can do

| Tool                 | Purpose                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `search_enclosures`  | Keyword search: codes (`EC-1015`), Turkish or English names, categories, materials                |
| `filter_enclosures`  | Parametric search: min/max outer size in any orientation, minimum IP rating, material, category   |
| `get_enclosure`      | Everything about one enclosure: specs, drawing dimensions, variants with order codes and barcodes |
| `compare_enclosures` | 2–10 enclosures side by side, with the differing fields highlighted                               |
| `list_categories`    | The category tree with enclosure counts                                                           |
| `get_cad_files`      | Links to the PDF drawing, DXF, STEP model, IP certificate, CNC and UV print templates             |

Also included: the resource template `altinkaya://enclosure/{slug}` and the prompt
`select_enclosure` for guided selection.

> [!IMPORTANT]
> Listed dimensions are **outer** dimensions. Usable inner space is smaller; check the drawing
> (`get_cad_files`) before committing to a PCB size.

## Manual setup

The server runs with `npx -y altinkaya-mcp`. The same JSON works for most clients:

```json
{
  "mcpServers": {
    "altinkaya": { "command": "npx", "args": ["-y", "altinkaya-mcp"] }
  }
}
```

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add altinkaya -- npx -y altinkaya-mcp
```

</details>

<details>
<summary><b>Claude Desktop (manual)</b></summary>

Settings → Developer → Edit Config, add the JSON above to `claude_desktop_config.json`, then
restart Claude Desktop.
</details>

<details>
<summary><b>Codex CLI</b></summary>

```bash
codex mcp add altinkaya -- npx -y altinkaya-mcp
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

```bash
gemini mcp add altinkaya npx -y altinkaya-mcp
```

</details>

<details>
<summary><b>VS Code (manual)</b></summary>

```bash
code --add-mcp '{"name":"altinkaya","command":"npx","args":["-y","altinkaya-mcp"]}'
```

</details>

<details>
<summary><b>Cursor, Windsurf, Cline, Zed and others</b></summary>

Add the JSON above to the client's MCP settings (`~/.cursor/mcp.json`,
`~/.codeium/windsurf/mcp_config.json`, Cline's _MCP Servers → Configure_, or Zed's `context_servers` setting).
</details>

<details>
<summary><b>Docker</b></summary>

```bash
docker run -i --rm ghcr.io/amazeng-co/altinkaya-mcp
```

</details>

<details>
<summary><b>Streamable HTTP</b></summary>

```bash
npx -y altinkaya-mcp --http --port 3000      # http://127.0.0.1:3000/mcp
```

For a public deployment, bind to `0.0.0.0` and list the public host names in
`ALTINKAYA_MCP_ALLOWED_HOSTS` (requests for other hosts are rejected to prevent DNS rebinding).
</details>

## Configuration

| Variable                      | Default             | Purpose                                                 |
| ----------------------------- | ------------------- | ------------------------------------------------------- |
| `ALTINKAYA_MCP_OFFLINE`       | unset               | `1` = never download; use the cached or bundled catalog |
| `ALTINKAYA_MCP_CACHE_DIR`     | OS cache dir        | Where the downloaded catalog is cached                  |
| `ALTINKAYA_MCP_CATALOG_URL`   | this repo on GitHub | Catalog file to download                                |
| `ALTINKAYA_MCP_ALLOWED_HOSTS` | localhost           | Accepted host names in `--http` mode                    |

## How it works

Altınkaya has no public API, so the catalog is crawled about once a month from altinkaya.com
(see [CONTRIBUTING](CONTRIBUTING.md#catalog-data)) into [`data/catalog.json`](data/catalog.json).
On start, the server fetches the latest file from GitHub (a conditional request; nothing is
downloaded if it has not changed), caches it, and falls back to the cached or bundled copy when
offline. All searching happens in memory. Prices and stock are not included.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [roadmap](ROADMAP.md).

## Disclaimer

This is an unofficial community project and is not affiliated with or endorsed by Altınkaya
Elektronik Cihaz Kutuları San. Tic. A.Ş. Product data belongs to Altınkaya; always verify
dimensions against the official drawings before manufacturing.

## License

[MIT](LICENSE)
