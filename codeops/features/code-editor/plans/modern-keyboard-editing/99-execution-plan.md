# Task T-01: Modern keyboard editing

> **Type**: Task (lightweight) · **Feature**: code-editor · **CodeOps Artifact Schema**: 1
> **Progress**: 1/5 tasks (20%)
> **Last Updated**: 2026-07-24 19:10
> **Phase baseline tree**: 9d42d8ccdecdc28a24395692028f1b697452e419

## Objective

Make the terminal-native Code Editor support the focused set of keyboard editing actions users
expect from a modern editor while preserving terminal safety, deterministic command precedence,
single-selection scope, revision-aware language presentation, and responsive rendering.

## Scope and decisions

- Preserve and verify the current demo geometry, input normalization, syntax-refresh, and optional
  line-number repairs as the prerequisite baseline for keyboard work.
- Tab and Shift+Tab indent or dedent every logical line touched by the selection in one document
  transaction. Without a selection, Tab advances to the next tab stop and Shift+Tab dedents the
  current line.
- Enter preserves the current line's leading whitespace. It does not add language-specific brace
  indentation in this task.
- Add select-all, undo/redo, word and document navigation, and shift-extended selection. Word
  boundaries use deterministic source-code character classes and do not depend on a DOM.
- Handle clipboard actions through JSVision's command events and `DispatchEvent` clipboard seams,
  retaining the application-local fallback and OSC safety owned by the UI event loop.
- Ctrl+/ toggles line comments using the active JavaScript, TypeScript, or PostgreSQL adapter.
  Unsupported adapters consume no edit and leave the document unchanged.
- Keep completion and snippet precedence ahead of editor indentation.
- Multiple carets/selections, column selection, Ctrl+D selection expansion, line move/copy/delete
  shortcuts, chord catalogs, and Bash support remain out of scope.

## Tasks

- [x] T-01.1 Verify and checkpoint the existing interactive-demo, input, revision-aware syntax,
  and optional line-number baseline; refresh plugin artifacts when required.
  ✅ (completed: 2026-07-24 19:10; `yarn verify` passed 34/34 tasks)
- [ ] T-01.2 Add specification tests, confirm the focused red phase, then implement selection-aware
  indent/dedent, smart tab stops, preserved-indent Enter, select-all, undo/redo, word navigation,
  document navigation, and shift-extended selection.
- [ ] T-01.3 Add specification tests, confirm the focused red phase, then implement command-event
  clipboard copy/cut/paste and adapter-aware Ctrl+/ line-comment toggling as atomic edits.
- [ ] T-01.4 Add implementation edge coverage and expand the dedicated Code Editor kitchen-sink
  with discoverable modern-keyboard scenarios and shortcut guidance.
- [ ] T-01.5 Refresh generated plugin/docs surfaces, run focused checks and `yarn plugin:check`,
  then pass the authoritative full verification and independent quality review.

**Verify**: `yarn verify`
