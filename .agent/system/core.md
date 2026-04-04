# CORE — Decision Support (always loaded)

## Context Pressure (heuristic, not exact)

```
Assess pressure BEFORE acting each turn:

LOW:    conversation < 10 turns AND < 3 files read
MEDIUM: 10-20 turns OR 3-6 files read OR large tool outputs present
HIGH:   20+ turns OR 6+ files read OR context feels crowded

Actions:
  LOW    → no restrictions
  MEDIUM → prefer targeted reads, consider persisting state
  HIGH   → persist state NOW, then reduce (load interceptor.md)
```

## Action Classification

```
BEFORE any tool call, classify what you're about to do:

  reading  → check limits (tools.md)
  writing  → check mode   (modes.md)
  searching → check scope  (tools.md)
  command  → check mode    (modes.md)

This is not verbose — it's a 1-second internal check.
If the action type is ambiguous, use the most permissive applicable rule.
```

## Module Loading

```
Load system modules ON DEMAND by action type:

  reading/searching:      load system/tools.md
  writing/command:        load system/modes.md (if not already loaded)
  persisting/restoring:   load system/memory.md
  pressure >= MEDIUM:     load system/interceptor.md
  complex/ambiguous task: load system/thinking.md
  DEFAULT:                this file only
```

## Persistence Triggers (CRITICAL)

```
PERSIST STATE when ANY of these occur:

  1. You complete a checklist item in current-task.md
  2. You make a decision that affects future work      → memory/decisions.md
  3. You switch from one file/component to another      → working/active-context.md
  4. You are about to read a large file (>100 lines)    → persist current findings first
  5. The user changes topic or asks unrelated question   → working/active-context.md
  6. You finish your response (if new findings exist)    → appropriate LTM file

Each trigger maps to a specific file — no judgment about "is this worth persisting."
```

## Conflict Resolution

```
Priority (highest first):

  1. User's explicit request
  2. Structural constraints (mode restrictions, persistence rules)
  3. Efficiency rules (read limits, overhead caps)

"Structural > Efficiency" means: "persist state" beats "minimize tool calls."
When two structural rules conflict, favor the one that preserves information.
```

## Session Init

```
ON START:
  1. READ .agent/working/current-task.md   → restore task state
  2. READ .agent/working/active-context.md → restore session context
  3. Infer mode from task state (see system/modes.md)
  4. Assess initial pressure level
```
