# Ambiguity Register — code-editor (Lezer code-grade editor)

> The hard gate for the code-grade editor requirements. Every semantically-weighted decision is
> listed, resolved, and attributed. Items resolved in the `grill_me` session (2026-07-18) enter as
> ✅ Resolved with an explicit user decision; structuring surfaced a few NEW items (AR-16…AR-20).
>
> Source records: `../shared-understanding.md` (grill output) and
> `../plans/feasibility-spike/decision-memo.md` (settled engine + packaging). Historical name:
> "RD-08 Editor family" / GH #18 (closed); build tracked by GH #102.

## Scope

The **code-development-grade editor** built on the existing `@jsvision/ui` editor: syntax
highlighting, tree-based folding, and line numbers, powered by **Lezer** (`@lezer/*`) behind a
`Tokenizer`/`FoldProvider` seam. Delivered across `@jsvision/core` (seam types + roles), a new
opt-in `@jsvision/lang` (the Lezer engine), and `@jsvision/editor` (the view features). `core`/`ui`
stay zero-dep. The editor extraction (`@jsvision/editor`, GH #101) is a **prerequisite refactor**,
tracked separately.

## Settled beforehand — engine & packaging (decision-memo)

| AR | Decision | Resolution | Status |
|----|----------|------------|--------|
| AR-00a | Language engine | **Lezer only** (`@lezer/*`) — a pure-JS incremental parse tree; **no TextMate fallback**. Rejected CodeMirror `view`/`language`/`commands` + Monaco (DOM-bound). | ✅ Resolved |
| AR-00b | Packaging / layering | Seam types (`Tokenizer`/`FoldProvider`) in `@jsvision/core`; Lezer engine in a new opt-in `@jsvision/lang` (deps only on `core` + `@lezer/*`); editor extracted to `@jsvision/editor` (#101, lands first). `core`/`ui` keep `{}` runtime deps (mirrors forms→zod). | ✅ Resolved |

## Resolved by the grill (explicit user decisions, 2026-07-18)

| AR | Decision | Resolution | Status |
|----|----------|------------|--------|
| AR-01 | v1 feature scope | IN = line numbers + syntax highlighting + folding (definitional) **+ bracket matching + comment-toggle**. OUT/deferred = multiple cursors, word-wrap, autocomplete/IntelliSense, diagnostics/linting/LSP. | ✅ Resolved |
| AR-02 | Language set + grammar sourcing | v1 grammars = **JSON** (proof + spec oracle) + **TS/JS** (`@lezer/javascript`, flagship). Source **raw `@lezer/*`** + `@lezer/highlight` + `@lezer/common` (DOM-free); NOT `@codemirror/*`. Per-language ~8-node fold allow-lists authored in `@jsvision/lang`. | ✅ Resolved |
| AR-03 | Highlighting model | ~8 syntax **buckets** = ~8 new **core** roles (`syntaxKeyword/Comment/String/Number/Type/Function/Variable/Punctuation`; variable = default fg). The `Tokenizer` seam emits a **bucket** (not a colour); `@jsvision/lang` maps Lezer's ~40 tags → buckets; the editor draw resolves bucket → role → `ctx.color` (light/dark + truecolor→256→16→mono downsampling free). Buckets grow additively. | ✅ Resolved |
| AR-04 | Highlight extent & async UX | Whole-doc **incremental + time-budgeted** parse (never blocks a frame); **viewport-scoped** highlight query; unparsed regions render default-fg + **fill in progressively**. Very-large files: **soft cap → degrade to plain editor** (no highlight/fold) + visible indicator. | ✅ Resolved |
| AR-05 | Gutter & line numbers | Gutter is **part of the Editor's own draw** (not a sibling view); fixed left columns, vertical-scroll only (not h-scrolled); **dynamic-fit width** (`digits(maxLine) + fold-col + pad`); layout `[num \| fold-col \| pad \| text]`; text area = `viewW − gutterW`; `editorMousePtr`/hBar range adjust; window scrollbar/indicator rects untouched. **Current-line number highlighted** (`gutterActive`). Line numbers on-by-default + toggle option. | ✅ Resolved |
| AR-06 | Folding & keymap | Primary fold affordance = **gutter fold-marker click + menu** (Fold/Unfold/Fold-all/Unfold-all); keyboard secondary = **extend the Ctrl-K block table**. Fold rendering: collapsed → header line + `⋯` badge, hidden rows removed from flow, `▾`/`▸` in the gutter fold-col. **Tab/Shift+Tab** selection-aware indent/dedent (additive; Tab was unbound); indent unit configurable, default = tab. **Comment-toggle** = menu command primary + best-effort `Ctrl-/`. | ✅ Resolved |
| AR-07 | Perf NFR & validation | **Informational, off-CI, non-gating** (house RD-10 pattern): 16 ms keystroke-frame (edit + viewport reparse + redraw) below the cap; whole-doc parse off-frame. Validated by **one scoped, committed build-phase probe** (buffer→Lezer `Input` + parse/highlight timing across sizes → sets the soft-cap threshold). No re-spike. | ✅ Resolved |
| AR-08 | Core-invariant assumption | v1 **keeps the single-caret model and horizontal-scroll** (1 buffer line = 1 screen row). No multi-caret/wrap rewrites. | ✅ Resolved |
| AR-09 | New core theme roles | ~11: 8 syntax buckets + `gutter` + `gutterActive` + `bracketMatch`. Each touches the theme-role wiring (~6 spots) + the role-count test oracle; mind the DOS-16 palette naming trap. | ✅ Resolved |
| AR-10 | Degrade-to-plain keeps zero-dep features | Above the soft cap, drop only **Lezer** features (syntax highlight + tree-based fold); **keep** line numbers, the gutter, and the indent-based default folder (all zero-dep, in `@jsvision/editor`). | ✅ Resolved |
| AR-11 | Comment-toggle is language-gated | JSON has no comment syntax → comment-toggle disabled/no-op for JSON; active for TS/JS. | ✅ Resolved |
| AR-12 | Ctrl-K extension is a new-feature extension | Adding fold entries to the WordStar Ctrl-K block table is a deliberate extension (free follow-up letters), not a TV-fidelity mis-decode — allowed. | ✅ Resolved |

## Deferrals (out of scope — each tracked by its own issue)

One scope-deferral decision (AR-13), four items — each with its own tracking issue:

| AR | Deferred item | Owner / tracker | Revisit |
|----|---------------|-----------------|---------|
| AR-13a | Multiple cursors | GH #104 | post-v1 |
| AR-13b | Word-wrap | GH #105 | post-v1 |
| AR-13c | Autocomplete / IntelliSense | GH #106 | post-v1 |
| AR-13d | Diagnostics / linting / LSP | GH #107 | post-v1 |

## New — surfaced during structuring (confirmed by the user 2026-07-18)

| AR | Decision | Resolution | Weight |
|----|----------|------------|--------|
| AR-16 | RD file numbering | **`code-editor/RD-01…`** — the per-feature reset convention (like `jsvision-forms`). "RD-08"/#18 stays the historical name in the issue + decision-memo; the file ids reset. | Low (structural) |
| AR-17 | Decomposition | **4 RDs by architectural seam:** RD-01 core seam + roles · RD-02 `@jsvision/lang` engine · RD-03 editor view features · RD-04 non-functional. `#101` (editor extraction) is a **standalone prerequisite refactor**, referenced in each RD's *Depends On*, not an RD here. | Medium (shapes the set) |
| AR-18 | Security posture (mandatory non-functional) | Hostile file/paste content is the headline vector; **every drawn cell routes through core's write-time `sanitize` boundary** (the existing editor rule, applied to highlighted/folded content too). Lezer parses buffer *strings* only — no `eval`, no code execution, no fs/network in `@jsvision/lang`. Grammar packages are pinned pure-JS deps (supply-chain: lockfile + `check:deps`). Documented in RD-04. | Statement (RD-04) |
| AR-19 | Soft-cap threshold **value** | Intentionally **not fixed now** — it is an NFR value the early build-phase perf probe sets (AR-07). Recorded as deferred-with-owner: **owner = the perf/integration probe (first build task); revisit = when the probe lands**. Not a requirements blocker. | Deferred (owned) |
| AR-20 | The `Tokenizer` / `FoldProvider` seam TS shape | Grill settled the *concept* (`(from, to, bucket)` highlight spans + a fold-range provider); the **exact interface** is pinned in RD-01: pure zero-dep type declarations in `@jsvision/core`, span-callback shaped so a whole-doc tree can be queried per visible range without allocating the whole span list. | Medium (RD-01) |

## Gate status — PASSED (2026-07-18)

All semantically-weighted decisions resolved; the one open value (AR-19, soft-cap threshold) is
explicitly deferred with an owner (the perf probe) and does not block requirement authoring.
