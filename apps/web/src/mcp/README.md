# EcoDharma MCP server

Exposes the EcoDharma **reading engine** over the [Model Context Protocol](https://modelcontextprotocol.io)
(stdio transport), so any MCP client — Claude Desktop, Claude Code, an agent — can
compute charts, generate a gift reading, and analyze a constellation/team using the
exact engine the web app uses.

It is built **on our own stack** (the `pyswisseph` ephemeris service +
`framework/framework.json` + the deterministic fixture interpreter + the HD relational
engine). It does **not** reproduce any third-party chart math. The tool *surface* is
inspired by open-human-design's MCP, but every tool returns an EcoDharma gift reading
rather than a generic Human Design dump.

## Tools

| Tool | What it does |
|------|--------------|
| `get_framework` | The 10 gift archetypes (what each is FOR, strengths, chart signatures), the world-work domains, and the Great Turning dimensions. The lens for everything else. |
| `compute_chart` | Four-lens charts (western tropical, vedic sidereal, Human Design, Gene Keys) from birth data + a compact HD signature. Structure only. |
| `gift_reading` | **The reading.** Charts → recognition + chart-grounded portrait + dominant archetypes + chart-thread bridges + gift×domain pairings, weighted by the person's ikigai. Deterministic; no LLM required. |
| `compare_people` | The HD connection chart between two people: electromagnetic / companionship / compromise / dominance channels, centre conditioning, composite type. A map of pulls, never a verdict. |
| `analyze_team` | Penta/group analysis for 2–9 people: group type, held vs. open centre-roles, electromagnetic threads, recommendations. |

Birth input accepts a `place` (geocoded via Open-Meteo) **or** explicit `lat`/`lng`/`tz`,
with an optional `time` (omit if unknown — noon is used and line-level detail held lightly).

## Run

Requires the ephemeris service running (default `http://127.0.0.1:8000`):

```bash
cd apps/web
EPHEMERIS_URL=http://127.0.0.1:8000 npm run mcp        # start the server (stdio)
npm run mcp:smoke                                       # exercise all five tools
```

## Use from Claude Desktop / Claude Code

Add to your MCP client config (adjust the absolute path):

```json
{
  "mcpServers": {
    "ecodharma": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "/absolute/path/to/ecodharma/apps/web",
      "env": { "EPHEMERIS_URL": "http://127.0.0.1:8000" }
    }
  }
}
```

## Boundaries

- **Structure, not proprietary text.** Charts return positions/structure; readings are
  original EcoDharma language. No Gene Keys / Human Design descriptive IP is reproduced.
- **No raw-data exposure.** The server computes from birth data passed by the caller; it
  has no database access and stores nothing. (The web app's owner-only RLS is unchanged.)
- `gift_reading` runs the deterministic interpreter, so it works with no API key. The web
  app additionally has a Claude path for richer prose; that is intentionally not exposed
  here to keep the MCP surface deterministic and side-effect-free.
