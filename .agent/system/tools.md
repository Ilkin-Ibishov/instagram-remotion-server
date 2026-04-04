# TOOL CONSTRAINTS
# Loaded on-demand before tool calls

## File Reading (view_file)

```
RULE:
    IF file IN memory/file-index.md AND NOT modified since:
        SKIP read → use cached summary
    ELSE:
        ALLOW read with line range

    ALWAYS: specify StartLine and EndLine
    NEVER:  read entire file without range (unless < 100 lines)

LIMITS BY MODE:
    PLANNING:     200 lines max
    EXECUTION:    100 lines max
    VERIFICATION:  50 lines max
    DEBUG:        400 lines max

If pressure is MEDIUM+, prefer the lower end of these limits.
```

## Searching (grep_search)

```
RULE:
    ALWAYS: set MatchPerLine = true
    ALWAYS: set Includes filter for file types

    IF mode == EXECUTION:
        REQUIRE: Includes filter mandatory
        REQUIRE: specific query (no single-char or common-word)

    IF pressure >= MEDIUM:
        REQUIRE: SearchPath is specific file or narrow directory
        DENY:    root-level searches
```

## File Discovery (find_by_name)

```
RULE:
    ALWAYS: MaxDepth <= 3
    IF pressure >= MEDIUM:
        REQUIRE: Extensions filter or specific Pattern
```

## Writing (write_to_file / replace_file_content)

```
RULE:
    IF mode != EXECUTION AND mode != DEBUG:
        DENY (except writes to .agent/ LTM artifacts)

    IF mode == DEBUG:
        MAX changed lines = 50 (bugfix only)

    BEFORE write:
        verify target content exists at specified lines
        (one view_file call, max 30 lines around edit site)

    PREFER: multi_replace_file_content for multiple edits in same file
    NEVER:  rewrite entire file when only few lines changed
```

## Commands (run_command)

```
RULE:
    PLANNING:     read-only (ls, cat, git log, git diff, npm list)
    EXECUTION:    build, install, compile
    VERIFICATION: test runners, linters, type checkers
    DEBUG:        all diagnostic (stack traces, logs, REPL)

    ALWAYS: set WaitMsBeforeAsync appropriately
        expected < 5s:  WaitMsBeforeAsync = 5000
        expected < 30s: WaitMsBeforeAsync = 500 (async)
```

## Anti-Patterns (HARD VIOLATIONS)

| # | Violation | Action |
|---|-----------|--------|
| V1 | Reading >200 lines without range (unless DEBUG) | REJECT |
| V2 | Re-reading file already indexed in file-index.md | SKIP |
| V3 | 3+ consecutive reads without write/action | HALT → persist findings |
| V4 | Writing code in PLANNING mode | REJECT |
| V5 | Exploratory search in EXECUTION mode | REJECT |
| V6 | Creating files without checking existence | REJECT |
