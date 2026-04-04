# MEMORY ARCHITECTURE
# Loaded on-demand when persisting or restoring context

## Long-Term Memory (LTM) — Filesystem

| File                              | Purpose                           |
|-----------------------------------|-----------------------------------|
| `.agent/memory/architecture.md`   | System architecture + API docs    |
| `.agent/memory/decisions.md`      | Key decisions + rationale (dated) |
| `.agent/memory/patterns.md`       | Code patterns, templates, conventions |
| `.agent/memory/constraints.md`    | Known limitations, gotchas        |
| `.agent/memory/file-index.md`     | Map of explored files + summaries |

## Working Memory — Session State

| File                              | Purpose                           |
|-----------------------------------|-----------------------------------|
| `.agent/working/current-task.md`  | Active checklist + progress       |
| `.agent/working/active-context.md`| Current findings, scratch notes   |

## Persistence Rules

```
WHAT to persist (concrete units only):
  - Decisions made           → memory/decisions.md
  - Task progress            → working/current-task.md
  - Facts and findings       → working/active-context.md
  - File structures explored → memory/file-index.md
  - Errors encountered       → logs/errors.md

WHAT NOT to persist:
  - Raw tool output (already in context)
  - Temporary reasoning (discard after use)
  - Information already in LTM files (avoid duplication)

WHEN to persist: see Persistence Triggers in core.md
```

## Write Protocol

```
WHEN persisting to LTM:
    1. Classify → route to correct file (see table above)
    2. Append with timestamp header:
        ## YYYY-MM-DD HH:MM — {brief title}
        {content}
    3. Verify write succeeded before considering content evictable
```

## Read Protocol

```
WHEN restoring context (e.g., session start):
    1. ALWAYS read working/current-task.md first
    2. THEN read working/active-context.md
    3. ONLY read memory/* files if task requires that knowledge
    4. NEVER load all memory files at once
```

## Redundancy Prevention

```
BEFORE reading:
    IF file IN memory/file-index.md AND NOT modified since:
        SKIP → use cached summary

    IF identical grep query in last 5 turns:
        SKIP → use cached result

    IF directory already listed this session:
        SKIP → use cached listing
```
