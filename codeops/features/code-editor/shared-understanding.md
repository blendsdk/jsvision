# Shared Understanding — Code-grade Editor (RD-08 / Lezer)

> Output of a `grill_me` design-disambiguation session (2026-07-18) on `feat/codeeditor`. Feeds
> `make_requirements RD-08` as pre-resolved input (its Zero-Ambiguity Gate still fires; most items
> are now answered). Engine + packaging were already settled — see the decision memo:
> `plans/feasibility-spike/decision-memo.md`. Tracked by GH #102.

## Settled beforehand (not re-litigated)

Lezer-only (no TextMate); extract `@jsvision/editor` (#101, lands first); `Tokenizer`/`FoldProvider`
seam types in `@jsvision/core`; Lezer engine in opt-in `@jsvision/lang`; `core`/`ui` stay zero-dep.

## Decisions

| # | Decision | Choice | Key rationale |
|---|----------|--------|---------------|
| A | v1 feature scope | Line numbers + syntax highlighting + folding (definitional) **+ bracket matching + comment-toggle**; defer multi-cursor, word-wrap, autocomplete, diagnostics/LSP | Keep v1 shippable; the two deferred heavies each rewrite a core invariant |
| B | Language set + grammar sourcing | **JSON** (proof + spec oracle) + **TS/JS** (`@lezer/javascript`); source raw `@lezer/*` + `@lezer/highlight` + `@lezer/common` only | JSON de-risks the seam with a tiny surface; TS/JS dogfoods; `@codemirror/*` drags in DOM |
| C | Highlighting model | ~8 syntax **buckets** = ~8 new core roles; the `Tokenizer` seam emits a *bucket* (not a colour); `@jsvision/lang` maps Lezer's ~40 tags → buckets; `drawEditor` resolves bucket → role → `ctx.color` | Light/dark + truecolor→256→16→mono downsampling come free; least core surface; grows additively |
| D | Highlight extent & async UX | Whole-doc **incremental + time-budgeted** parse (never blocks a frame); **viewport-scoped** highlight query; unparsed regions render default-fg + **fill in progressively**; very-large files **soft-cap → degrade to plain** | Folding needs the whole tree; keep frames responsive; bound memory |
| E | Gutter & line numbers | Part of the Editor's **own draw**; fixed left columns (vertical-scroll only, not h-scrolled); **dynamic-fit width** (`digits + fold-col + pad`); **current-line number highlighted** | Editor already owns row→buffer-line mapping + fold state; window scrollbar/indicator rects stay untouched |
| F | Folding & keymap | Primary fold affordance = **gutter fold-marker click + menu**; keyboard secondary **extends the Ctrl-K block table**; **Tab/Shift+Tab** selection-aware indent/dedent (additive); **comment-toggle** = menu + best-effort `Ctrl-/` | Terminal keys are unreliable in jsvision → menu-first; Tab was unbound; Ctrl-K is the live WordStar block prefix |
| G | Perf NFR & validation | **Informational, off-CI, non-gating** (house RD-10 pattern): 16 ms keystroke-frame below the cap; whole-doc parse off-frame. Validated by **one scoped, committed build-phase probe** (buffer→Lezer `Input` + timing across sizes → sets the soft-cap threshold). No re-spike | Consistent with jsvision's "perf never gates"; captures the lost spike number as tracked work |

## Assumptions (confirmed)

- v1 **keeps the single-caret model and horizontal-scroll** (1 buffer line = 1 screen row) — no core-invariant rewrites.
- `@lezer/javascript` covers TS/JSX/TSX; JSON via `@lezer/json`.

## Constraints

- **~11 new core theme roles**: 8 syntax buckets (`syntaxKeyword/Comment/String/Number/Type/Function/Variable/Punctuation`, variable = default fg) + `gutter` + `gutterActive` + `bracketMatch`. Each touches the theme-role wiring (~6 spots) and the role-count test oracle; mind the DOS-16 palette naming trap (no `brightWhite` key).
- **#101 lands first** (extract `@jsvision/editor`; widen `ui` public API for `measure`/`message-box`; re-point `@jsvision/files`; add to lockstep version set).
- **Degrade-to-plain keeps zero-dep features** (line numbers, gutter, indent-based default folder); drops only Lezer features (syntax highlight + tree-based fold).

## Out of scope (deferred — each its own RD/issue)

- ⏸ **Multiple cursors** · owner: future RD · revisit: post-v1
- ⏸ **Word-wrap** · owner: future RD · revisit: post-v1
- ⏸ **Autocomplete / IntelliSense** · owner: own RD · revisit: post-v1
- ⏸ **Diagnostics / linting / LSP** · owner: own RD · revisit: post-v1

## Open risks

- **Comment-toggle is language-gated** — JSON has no comment syntax (no-op there); real only for TS/JS.
- **Soft-cap threshold is unset** until the perf probe runs — the one empirical value still open (by design).
- **`Ctrl-/` delivery is terminal-dependent** — mitigated by the menu being the primary comment path.

## Grounded code facts (for requirement accuracy)

- `edit-window.ts:115-121` — editor interior `{x:1,y:1,w-2,h-2}`; hBar starts x=18, indicator x=2..15, vBar x=w-1. A left gutter consumes editor-interior width.
- `editor-draw.ts:24` — `drawEditor(ed, ctx, normalRole, selectedRole)` takes 2 roles, splits runs only on `selected`. Highlighting adds a per-token bucket and run-splits on colour too.
- `keymap.ts` — Tab unbound (types a tab); Ctrl-K = block prefix (B/C/H/K/Y), Ctrl-Q = quick prefix; Ctrl-O = toggleIndent; `'modern'` default overlays Ctrl+X/C/V/A/Z/Y.
- `roles.ts:103-108` — only `editorNormal/Selected`, `memo*`, `indicator*` roles exist; zero syntax/token roles.
