# Task T-01: Modern keyboard editing

> **Type**: Task (lightweight) · **Feature**: code-editor · **CodeOps Artifact Schema**: 1
> **Progress**: 5/5 tasks (100%)
> **Last Updated**: 2026-07-24 20:22
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
- [x] T-01.2 Add specification tests, confirm the focused red phase, then implement selection-aware
  indent/dedent, smart tab stops, preserved-indent Enter, select-all, undo/redo, word navigation,
  document navigation, and shift-extended selection.
  ✅ (completed: 2026-07-24 19:27; focused red 4/4, focused green 4/4; `yarn verify` passed 34/34)
- [x] T-01.3 Add specification tests, confirm the focused red phase, then implement command-event
  clipboard copy/cut/paste and adapter-aware Ctrl+/ line-comment toggling as atomic edits.
  ✅ (completed: 2026-07-24 19:43; focused red 3/3, focused green 7/7; `yarn verify` passed 34/34)
- [x] T-01.4 Add implementation edge coverage and expand the dedicated Code Editor kitchen-sink
  with discoverable modern-keyboard scenarios and shortcut guidance.
  ✅ (completed: 2026-07-24 20:01; focused editor 12/12, showcase 27/27; `yarn verify` passed 34/34)
- [x] T-01.5 Refresh generated plugin/docs surfaces, run focused checks and `yarn plugin:check`,
  then pass the authoritative full verification and independent quality review.
  ✅ (completed: 2026-07-24 20:22; `yarn verify` 34/34; RV-001/RV-002 resolved on scoped re-review)

**Verify**: `yarn verify`

## Quality review

- **RV-001 — Major, accepted and fixed**: Ctrl+word navigation could stall on punctuation.
  Navigation now consumes deterministic Unicode word, whitespace, or punctuation runs in either
  direction and preserves Shift selection extension.
- **RV-002 — Major, accepted and fixed**: Smart Tab and dedent counted UTF-16 code units rather
  than terminal columns. Tab now uses the document visual-column calculator, while dedent removes
  one visual indentation level and preserves residual mixed whitespace.
- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal navigation and indentation algorithms within the approved keyboard
  behavior; no product scope, compatibility, or security-policy decision changed.
- **Rejected alternatives**: Leaving punctuation as a special no-op violated forward progress;
  treating tabs as one column contradicted the existing terminal projection; replacing all
  indentation with spaces would discard useful residual whitespace.
- **Strongest counterargument**: Editor platforms vary in their exact punctuation stops and mixed
  indentation preservation. The selected behavior is deterministic, testable, terminal-native,
  Unicode-aware, and guarantees progress without expanding the shortcut scope.
- **Confidence**: High — grounded in the existing visual-column implementation and regression
  tests around punctuation, Unicode, tabs, wide glyphs, reverse movement, Shift extension, and
  document edges.
- **Hardening**: Independent reviewer identified both defects; the single scoped re-review found
  RV-001 and RV-002 resolved with no remaining or new Critical/Major findings.
- **Policy version**: 1.
- **Root invocation ID**: `modern-keyboard-editing-2026-07-24`.
- **Reopen triggers**: A language-specific word-boundary contract, configurable indentation style,
  or evidence that visual and editing columns diverge.
