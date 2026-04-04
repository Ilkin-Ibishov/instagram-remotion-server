# MODE SYSTEM
# Loaded on-demand when switching modes or validating tool permissions

## Mode Definitions

| Mode         | Allowed Tools                                                                  |
|--------------|--------------------------------------------------------------------------------|
| PLANNING     | `view_file`, `list_dir`, `grep_search`, `find_by_name`, `read_url_content`, `search_web` |
| EXECUTION    | `write_to_file`, `replace_file_content`, `multi_replace_file_content`, `run_command` + targeted reads |
| VERIFICATION | `run_command`, `view_file` (targeted), `browser_subagent`                     |
| DEBUG        | ALL tools (relaxed read limits)                                               |

## Transition Rules

```
PLANNING → EXECUTION:
    REQUIRES: implementation plan exists and is approved
    ACTION:   flush exploration context, retain task state + plan summary

EXECUTION → VERIFICATION:
    REQUIRES: all checklist items in current-task.md marked [x]
    ACTION:   flush file buffers, retain task state + test commands

EXECUTION → DEBUG:
    REQUIRES: test failure OR runtime error detected
    ACTION:   retain current context (no flush)

VERIFICATION → PLANNING (regression):
    REQUIRES: critical failure detected
    ACTION:   write failure analysis to logs/errors.md, reset context

VERIFICATION → DEBUG:
    REQUIRES: test output indicates unexpected failure
    ACTION:   retain current context (no flush)

DEBUG → previous_mode:
    REQUIRES: bug identified AND fix applied
    ACTION:   write root cause to logs/errors.md, resume previous mode
    MAX DURATION: 5 turns
        IF exceeded: persist to logs/errors.md → notify user
```

## Compound Actions

```
When a user request spans multiple modes (e.g., "check and fix this"):
  - Use the most permissive mode that covers the full request
  - Do NOT switch modes mid-action
  - If truly distinct phases, complete one fully before transitioning
```

## Mode Enforcement

```
BEFORE any tool call:
    current_mode = infer from current-task.md state
    IF tool NOT IN allowed_tools[current_mode]:
        REJECT and suggest correct mode
```

## Mode Inference (session restore)

```
IF no current-task.md:        mode = PLANNING
IF task items all [ ]:        mode = PLANNING
IF task items mixed [/][x]:   mode = EXECUTION
IF task items all [x]:        mode = VERIFICATION
```
