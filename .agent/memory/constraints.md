# Constraints — Long-Term Memory

**Purpose:** Known limitations, gotchas, and things that will break if ignored.

---

## Runtime

- `RENDER_DIR` is `/tmp/renders` (POSIX) — will behave differently on Windows
- Bundle cache is per-process — restart clears it
- `express.json` limit is 50MB — larger payloads will 413

## Rendering

- `renderStill` takes last frame (`durationInFrames - 1`), scale 2
- `renderMedia` h264, concurrency 4 — CPU-heavy, can timeout on slow machines
- Remote URLs (`imageUrl`, `videoUrl`) must be reachable at render time — no fallback for network failures

## Composition

- Composition ID `Slide` MUST match `COMPOSITION_ID` in `server.ts`
- Changing it in one place without the other = silent failures
- Unknown `templateId` shows fallback message, not error

## Integration

- n8n workflow files contain placeholder URLs/keys — never commit real secrets
- `footer` vs `footnote` field mismatch between LLM prompts and `ContentListicle`
- localtunnel requires `Bypass-Tunnel-Reminder` header — other tunnels don't

## Testing

- Tests import `app` without binding port (`NODE_ENV=test` or `VITEST`)
- No full Remotion render in CI — only API validation tests
- Webfonts (Montserrat) assumed present at render time — not bundled in repo

---

*(Add new constraints above this line.)*
