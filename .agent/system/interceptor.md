# INTERCEPTOR — Context Reduction Guide
# Loaded on-demand when pressure >= MEDIUM

## When to Reduce

```
MEDIUM pressure:
  - Summarize and evict oldest file buffers
  - Persist current findings to working/active-context.md
  - Prefer targeted reads (specific line ranges only)

HIGH pressure:
  - Persist ALL state to LTM files before continuing
  - Evict all file buffers except the one you're actively editing
  - Keep only: system prompt + current-task.md + last 2 turns
  - If still crowded after persisting: tell user "State saved. Context pressure high."
```

## What to Persist (structured, not free-form)

```
Route information to TYPED files — never summarize into a blob:

  decisions made        → memory/decisions.md
  task progress         → working/current-task.md
  facts and findings    → working/active-context.md
  errors encountered    → logs/errors.md
  file structures found → memory/file-index.md
```

## Eviction Priority

| Priority | Content              | When to Evict           |
|----------|----------------------|-------------------------|
| 1 (keep) | System prompt        | NEVER                   |
| 2 (keep) | Active task state    | NEVER during session    |
| 3 (keep) | Current user request | NEVER during turn       |
| 4        | Active file buffer   | Pressure >= MEDIUM      |
| 5        | Old tool outputs     | Pressure >= MEDIUM      |
| 6        | Conversation history | Pressure >= HIGH        |
| 7        | Stale file content   | Immediately when stale  |
| 8        | Duplicate info       | Immediately when found  |

**Eviction rule:** Always persist content to the appropriate LTM file BEFORE evicting it from context.

## Sustained Pressure

```
IF pressure remains HIGH for 3+ consecutive turns:
  1. Write all progress     → working/current-task.md
  2. Write all findings     → working/active-context.md
  3. Write file summaries   → memory/file-index.md
  4. Tell user: "Context pressure sustained. State saved to LTM."
```
