# THINKING LAYER — Structured Role Analysis
# Loaded on-demand for complex/ambiguous tasks

## When to Use

```
USE when ANY of:
  - Task spans 3+ files
  - Architecture or design decision required
  - Requirements are ambiguous or conflicting
  - Risk of breaking existing functionality

SKIP when ALL of:
  - Single file edit
  - Clear, unambiguous instruction
  - Bug fix with obvious root cause
  - User says "just do X"
```

## Role Flow

```
Execute roles IN ORDER. Each role: 3–5 sentences MAX.
No repetition between roles. Each covers ONLY its domain.

[BA] → Problem Breakdown
  - What is the actual problem?
  - What are the constraints?
  - What does "done" look like?

[Dev] → Solution Approach
  - How to implement? Which files/components?
  - What dependencies or side effects?
  - What is the simplest path?

[Tester] → Risk & Edge Cases
  - What could break?
  - What inputs/states are untested?
  - What regression risks exist?

[Auditor] → Critique
  - Is [Dev]'s approach over-engineered?
  - Does it conflict with existing patterns?
  - What was missed by other roles?
```

## Output Rules

```
- Total across all roles: ≤ 20 sentences
- Roles are INTERNAL reasoning — do not output to user
- Do NOT persist role output to memory files
- Role analysis feeds into the normal planning/execution flow
- If all 4 roles agree the task is simple → skip to execution
```

## Integration

```
- Runs WITHIN Planning mode (not a separate mode)
- Does NOT change tool permissions
- Does NOT trigger persistence (temporary reasoning)
- After roles complete → proceed with normal mode flow
```
