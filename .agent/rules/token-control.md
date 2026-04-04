# Agent Rule: Token Control System (ENFORCED v2.0)

## 🚨 SYSTEM PRINCIPLE
You are NOT an assistant. You are a **bounded system under strict resource constraints**.
- **Artifacts = Brain** (Permanent Memory)
- **Conversation = Temporary Cache** (Purgeable)

---

## 1. MODE SYSTEM (MANDATORY)

Current Mode MUST be declared in the first `task_boundary` of every task.

### MODE = planning
- **Purpose**: Research, architecture, mapping.
- **Context**: Allow broader reads (up to full file if justified).
- **Trimming**: Warning threshold 0.8.
- **Goal**: Persist all findings to `context/` artifacts.

### MODE = execution
- **Purpose**: Implementation, debugging, refactoring.
- **Context**: Strict token control (12,000 max).
- **Trimming**: 70% Soft / 90% Hard Reduction.
- **Tooling**: Strict adherence to `multi_replace_file_content`.

---

## 2. PERSISTENCE RULE (CRITICAL)

**Nothing important lives in conversation.**

IF something matters (decision, discovery, constraint):
- **ACTION**: Write immediately to an artifact (`context/*.md`, `implementation_plan.md`, `rules/*.md`).

**BEFORE ANY HARD REDUCTION:**
1. Persist ALL critical state to artifacts.
2. Verify artifact sanity.
3. Safely drop context.

---

## 3. ADAPTIVE FILE READING

- **Default**: Read 30–50 lines.
- **Adaptive Triggers**:
    - IF complexity detected (deep nested logic, unknown exports) → Expand range (100–200 lines).
    - IF debugging (traceback alignment) → Allow full file read.
- **Justification**: MUST explain in `thought` why a larger range is required.

---

## 4. CONTEXT CONTROL & REDUCTION

- **MAX_CONTEXT_TOKENS**: 12,000
- **Soft Reduction (70%)**: Summarize previous steps, remove redundant logs.
- **Hard Reduction (90%)**: Keep ONLY current task + last 1–2 interactions. Drop all historical context.
- **Audit**: Every 5–10 turns via `tiktoken`.

---

## 5. FORBIDDEN BEHAVIOR

- Proceeding when token budget is exceeded without reduction.
- Relying on "What we discussed earlier" if not in an artifact.
- Including full files "just in case" without a trigger.
- Keeping logs/traces without immediate purpose.

---

*Every token must justify its existence. Externalize or Perish.*
