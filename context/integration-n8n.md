# External automation (n8n and similar)

## Role

The HTTP API is designed to be called from **workflow tools** (e.g. **n8n**): fetch content → LLM formats JSON → POST **`/api/render`**.

## Example assets in repo

- **`n8n-workflow.json`**, **`n8n-workflow-fixed.json`**, **`test-new-features.json`** — exported workflows; URLs, API keys, and hostnames are **placeholders** and must be replaced for a real deployment.

## Typical pattern

1. **Schedule** or webhook trigger.
2. **HTTP Request** to a news or content API.
3. **LLM node** (e.g. Gemini) produces JSON matching the render payload: `format`, `globalBranding`, `carousel[]`.
4. **HTTP Request** POST to `http(s)://<host>:3000/api/render` with JSON body.
5. Optional: use **`webhookUrl`** so the render server returns **202** immediately and POSTs results back when done (avoids n8n timeout on long jobs).

## Headers and tunnels

Example workflow used **localtunnel** (`loca.lt`) with a **`Bypass-Tunnel-Reminder`** header — specific to that tunnel product; adjust for ngrok, Cloudflare Tunnel, or a public URL.

## Payload alignment

Ensure LLM output field names match **template** contracts in [templates.md](./templates.md). Mismatches (e.g. `footer` vs `footnote` for listicles) silently produce missing UI unless validated upstream.

## Security note

Workflow JSON files may contain **prompt text** or **API key placeholders**. Treat them as **secrets-adjacent**; do not commit real keys.
