---
description: Rules for one-by-one ClickUp audit implementation and completion updates
applyTo: "scripts/clickup-audit.ts,context/*.md,.github/instructions/*.md,__tests__/integration/**/*.test.ts"
---

# ClickUp Audit Loop Rules

Use this workflow when implementing tasks from a ClickUp audit list.

## Mandatory Per-Task Sequence

1. Open the task details and copy acceptance criteria into a local checklist.
2. Audit current repository state before changing code:
- Confirm whether issue is already fixed.
- Capture evidence (file path + behavior).
 - Record whether the task proposal is technically correct for the current code.
3. Implement only the requested scope in code and tests.
4. Run targeted verification commands for that task.
5. Update docs in the same pass:
- Add or update `context/*.md` entries for changed behavior.
- Add a short dated entry to `context/lesson-learned.md` for non-obvious pitfalls.
6. Update ClickUp task:
- Set status to the list's completion status (`done`/`complete`, whichever is valid in the list).
- Post a completion comment containing: summary, changed files, verification commands, and any follow-ups.

## Disagreement / Clarification Path (Required)

If audit evidence shows task instructions are incorrect, incomplete, or risky for current architecture:

1. Do not implement blindly.
2. Post a clarification comment with concrete evidence:
- What conflicts with current code/contract.
- Proposed corrected approach.
- Any questions requiring strategist confirmation.
3. Set task status to `in progress`.
4. Wait for strategist response before implementing conflicting changes.

## Human Completion Path (Required)

If implementation is finished but final completion requires a manual action by a human (for example: secret provisioning, external account verification, production UI click-through, or credentialed environment confirmation):

1. Do not mark the task as `complete` yet.
2. Post a completion-blocked comment that clearly states:
- what the agent already implemented,
- the exact remaining human step,
- how to verify once that step is done.
3. Set task status to `Need Human Completion Step`.
4. After the human step is confirmed, move the task to the completion status and add a final confirmation comment.

## Safety Rules

- Never mark a task complete if acceptance criteria are not met.
- If blocked (missing credentials, env, external dependency), comment with exact blocker and keep task non-complete.
- If clarification is pending from strategist, keep status at `in progress` (not complete).
- If a manual post-implementation step is pending, set status to `Need Human Completion Step`.
- Prefer idempotent updates; avoid broad refactors while closing audit tasks.
- Every status change must have a paired completion/blocker comment for traceability.

## Completion Comment Template

```text
Audit + implementation completed.

What was changed:
- <file>: <change>
- <file>: <change>

Verification:
- <command> -> <result>

Notes:
- <risk/follow-up or "None">
```
