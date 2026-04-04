---
description: Global agent behavior: Grounding, Synchronization, and Token Efficiency.
alwaysApply: true
---

# Agent Behavior: Grounding & Maintenance

To ensure accuracy and maintain project knowledge without wasting context window space (tokens), follow these core behaviors.

## 1. Grounding (Read Before Doing)
- Treat **`context/`** as the source of truth for contracts, routes, and data shapes.
- **Selective Reading**: Use **`context/README.md`** to identify the specific file needed. Do **not** read all context files.
- Ground yourself **before** deep planning or writing code for non-trivial tasks.

## 2. Maintenance (Sync After Doing)
- **Sync Context**: Update relevant **`context/*.md`** files when implementation details change.
- **Sync Rules**: Update relevant **`.agent/rules/*.md`** files when project standards or patterns change.
- **Lessons**: Add dated entries to **`context/lesson-learned.md`** for important corrections or "gotchas".
- Updates must be atomic (part of the same task as the code change).

## 3. Token Efficiency
- Avoid **`list_dir`** or reading entire folders; use targeted tools like **`grep_search`** or **`find_by_name`**.
- Keep rules concise. Link to existing project files for code examples instead of duplicating them in rules.
- Only keep necessary information in the active thought process.
