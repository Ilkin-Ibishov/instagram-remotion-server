# `.agent` — agent context (modular)

Load **only the slice** you need. Authoritative product/API contracts for implementation work also live in **`../context/`** (see `../context/README.md`).

| Area | Path | Use when |
|------|------|----------|
| Architecture | [memory/architecture.md](./memory/architecture.md) | Pipelines, services, data stores, deploy |
| Decisions | [memory/decisions.md](./memory/decisions.md) | Why something was chosen; append new ADRs at top |
| Current state | [memory/current-state.md](./memory/current-state.md) | Done vs open (bugs, security, tests) |
| File index / patterns | [memory/file-index.md](./memory/file-index.md), [memory/patterns.md](./memory/patterns.md) | Quick navigation, reusable patterns |
| Working notes | [working/active-context.md](./working/active-context.md) | Session: what the agent is doing now |
| Rules | [rules/README.md](./rules/README.md) | Testing, API stability, Remotion, tokens |
| System prompts | [system/](./system/) | Optional meta (modes, tools) |

**Convention:** Prefer linking to `context/*.md` for template shapes and HTTP contracts instead of duplicating long tables here.
