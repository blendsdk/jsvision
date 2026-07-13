# Requirements: Editor family

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-08](../../requirements/RD-08-editor-family.md) — the OWNING requirements doc
> (preflighted ✅, 15 findings resolved — see `../../requirements/00-preflight-report-RD-08.md`)

## Scope of this plan (delta view)

### In this plan

Every RD-08 **Must-Have** [one-line gloss each]:

- **Gap-buffer text core** (AR-250/AR-251/AR-252) — gap buffer over UTF-16 code units, cluster/CRLF-atomic navigation, per-buffer EOL policy.
- **Editing, selection & modes** — the full TV command set, TV selection/mouse model, overwrite + autoIndent, the faithful 3-table WordStar keymap (PF-001 precedence).
- **Undo/redo** (AR-253) — the bounded multi-level stack extension.
- **Rendering** — `formatLine` decode, GATE-1-pinned colours, caret via `desiredCaret()` (position only, DEF-36), write-time sanitize.
- **Clipboard** (AR-254) — shared clipboard-`Editor` seam + OSC-52 mirror + bracketed paste.
- **Search & replace** (AR-255) — the `editorDialog` seam + literal search + the decoded find/replace dialog builders.
- **`Memo`** (AR-263) — two-way `Signal<string>`, Tab pass-through, gray-chain colours.
- **`Indicator`** — ═/─ drag swap, `☼` modified marker, `line:col` at column 8.
- **`EditWindow`** — TV rects verbatim (PF-006), min 24×6, gadget visibility per the active-state decode (PF-015 → PA-10).
- **`FileEditor`** (AR-249/AR-258, `@jsvision/files`) — load/save/saveAs, `.bak` ON, save prompts.
- **`Terminal`** (AR-257) — code-unit-capped ring, whole-line eviction, auto-scroll.
- **Demos & showcase** (AR-260) — 3 kitchen-sink stories, `demo:editor`, the live `demo:tvedit` clone.

All three RD-08 **Should-Haves** — in v1 per **PA-4**: `getText`/`setText`/`insertText` accessors,
command greying (`updateCommands` decode), `terminalWriter`.

### Deferred / out of this plan

The RD-08 Won't-Haves, unchanged: context menu (DEF-34), regex search (DEF-35), `cmEncoding`
(dropped), syntax highlighting/word wrap/multi-caret (out of fidelity scope), OSC-52 read (DEF-25),
caret shape (DEF-36), C++ stream surface (replaced by `write`/`writeLine`).

## Plan-local decisions

> Only decisions NOT already in RD-08; the register owns the detail.

| Decision | Chosen | AR Ref |
|----------|--------|--------|
| Undo depth default + redo surface | 1000 steps; redo command-only | PA-1 |
| Clipboard-editor default | Injectable, none ⇒ TV null-clipboard semantics | PA-2 |
| Indicator drag seam | Reactive `Window.dragging` signal | PA-3 |
| Should-Haves in v1 | All three | PA-4 |
| Segmenter placement | ui-local `buffer/segment.ts` | PA-5 |
| `FileSystem` additions | `readFile`/`writeFile`/`rename`/`unlink` | PA-6 |
| Seam message boxes | Exported `confirmBox`/`infoBox`/`replacePrompt` | PA-7, PA-11 |
| Theme role set | 7 roles, decoded bytes | PA-8 |
| Repaint granularity | Whole-view invalidate (no `ufLine` port) | PA-9 |
| Gadget visibility | Hidden while window inactive (decode) | PA-10 |
| Verify command | `yarn verify` | PA-12 |
| Names (plan/story/demo/test) | Per house conventions | PA-13 |
| Theme-guard allowlists | Extend prior closed-set guards | PA-14 |
| Command surface | Internal actions + registry app-commands | PA-15 |
| Paste semantics | Clipboard's selection (decode) | PA-16 |
| `editorDialog` TS shape | Async discriminated union, default cancel | PA-17 |
| Multi-click detection | Editor-local, injectable clock | PA-18 |
| Window-active seam | Reactive `Window.active` signal | PA-19 |

## Acceptance Criteria

RD-08 owns AC-1…AC-20 (the spec oracles; mapped to ST-cases in
[07-testing-strategy.md](07-testing-strategy.md)). Plan-local criteria only:

1. [ ] The PA-3/PA-19 `Window` signals and PA-6 `FileSystem` methods land additively — every
       shipped RD-01…RD-21 + files-package suite stays green unchanged (except the sanctioned
       PA-14 guard-allowlist extensions).
2. [ ] The GATE-2 AFTER-diff is recorded for all six TV-derived components before any is marked done.
3. [ ] `yarn verify` green at the end of every phase (PA-12).
