# Decisions Log — Long-Term Memory

**Purpose:** Dated entries recording key decisions and their rationale. Append new entries at the top.

---

## 2026-04-26 — Agent context modularization + pipeline selection

- **Context:** Primary agent handover; `.agent/` should mirror full architecture and open work (incl. BUG-001), without replacing `context/` for API/template contracts.
- **Decision:** Add `.agent/README.md`, `memory/current-state.md`, expand `memory/architecture.md` to cover RSS → Gemini → Remotion → Instagram, Redis, Postgres telemetry, and file-based post history.
- **Decision:** `selectBestArticle` second argument is `'top' | 'diverse'`; pipeline must pass `'diverse'` for “random among top 3” — not an ad-hoc string (was `'random-top-3'`, which only worked by falling through the `else` branch at runtime and broke typing).

## 2026-03-28 — Context pack initial creation

- **Context:** New modular `context/` docs created for agent use.
- **Decision:** `templates.md` is the single source of truth for `data` field names.
- **Key insight:** n8n workflow prompts may use `footer` while `ContentListicle` reads `footnote` — align prompts or map fields in workflow.

## 2026-03-28 — Package.json Remotion Studio entry fix

- **Context:** `preview` script pointed at `src/remotion/index.ts`.
- **Issue:** Remotion root file is `.tsx` not `.ts` — wrong extension breaks Studio.
- **Fix:** Updated `package.json` `preview` script to `src/remotion/index.tsx`.

## 2026-03-30 — Agent brain restructure

- **Context:** Monolithic `token-control-system.md` (24K chars) was self-consuming tokens.
- **Decision:** Split into 5 modular files. Only `core.md` is always-on. Others loaded on-demand.
- **Decision:** Migrated `context/` folder into `.agent/memory/` (LTM) and `.agent/working/` (STM).

---

*(Add new entries above this line.)*
