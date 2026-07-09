# Ambiguity Register: UI Small Batch

> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED
> **Created**: 2026-07-09
> **CodeOps Skills Version**: 3.3.2

⚠️ **SAME-SESSION REVIEW** — this register was authored in the same session as the plan. Consider a
fresh-session `preflight` for review independence before executing.

Every semantically-weighted decision for the three batched issues (GH #17, #6, #11), with the
option chosen by the user. All items resolved; no deferrals.

## Register

| # | Category | Ambiguity / Question | Options considered | ✅ Resolution | Status |
|---|----------|----------------------|--------------------|--------------|--------|
| AR-1 | Structure | How to home this batch of 3 issues in the nested layout | (a) one batch plan under a new feature · (b) three task mini-plans · (c) fold into `jsvision-ui` as RDs | **(a)** One batch plan `ui-small-batch` under a new `jsvision-ui-enhancements` feature; the three issues are the requirements source (no RD). | ✅ Resolved |
| AR-2 | Scope (#17) | Which marker styles to build | (a) all three `tv`/`brackets`/`triangle` · (b) brackets only · (c) triangle as new default | **(a)** Add `markerStyle: 'tv' \| 'brackets' \| 'triangle'` to `TreeOptions`. | ✅ Resolved |
| AR-3 | Behavior (#17) | Default marker style | keep TV single-char vs. change default | **Default stays `'tv'`** — fidelity preserved unless the app opts in; a recorded deviation. | ✅ Resolved |
| AR-4 | Design (#17) | Bracket geometry | accept the end-graphic widening 3→5 cells vs. reject brackets | **Accept.** `graphWidth()` becomes style-aware (`endWidth` = 3 for `tv`/`triangle`, 5 for `brackets`); the mouse toggle-zone reads `graphWidth`, so it auto-adapts. | ✅ Resolved |
| AR-5 | Edge case (#17) | No-Unicode fallback for `triangle` | (a) fall back to `brackets` (pure ASCII) · (b) fall back to `tv` | **(a)** Under a caps profile without Unicode, `triangle` renders as `brackets`; `brackets` is already pure ASCII; `tv`'s `+`/`─` is ASCII-safe as-is. Chosen at draw-time from `ctx.caps`. | ✅ Resolved |
| AR-6 | Edge case (#17) | Leaf-node marker under the new styles | draw the expanded glyph vs. blank | **Blank** for a leaf (spaces sized to the style's marker width): `brackets`/`triangle` show a marker only on collapsible nodes; `tv` is unchanged (leaf keeps `─`). | ✅ Resolved |
| AR-7 | Scope (#6) | Which accelerator scopes v1 covers | (a) menus only · (b) all tilde scopes · (c) all incl. StatusLine | **(b)** All `~X~` tilde-accelerator scopes: menu bar, each submenu, each Dialog/cluster focus scope, each TabView strip. **StatusLine** (explicit chords via `matchesChord`, a different mechanism) is a documented fast-follow, not v1. | ✅ Resolved |
| AR-8 | Behavior (#6) | Severity of a duplicate | dev-only `warn` vs. throw | **Dev-only `warn`** (matches the `For`/owner-warning precedent in `reactive/warnings.ts`; a throw would crash an app over a cosmetic conflict). Silent under `NODE_ENV=production`. | ✅ Resolved |
| AR-9 | Delivery (#6) | Auto vs. opt-in checking | auto-only · opt-in-only · both | **Both** — export the pure `findDuplicateAccelerators()` for explicit use, and call it automatically (dev-gated) at the scope root. | ✅ Resolved |
| AR-10 | Architecture (#6) | How each scope enumerates its accelerators | (a) additive `View.accelerators()` seam + scope-root mount walk · (b) per-type ad-hoc walks | **(a)** Add an optional `accelerators(): readonly string[]` seam on `View` (default `[]`), overridden by `Button`/`Label`/`Cluster`/`TabStrip`. Menus are plain data (checked at build time in `menu/builders.ts`); the view-tree scopes are checked on scope-root mount. One shared pure validator. | ⚠️ Refined by AR-21/AR-22 |
| AR-11 | Consistency (#6) | The dev-warn sink for non-reactive callers | reuse `reactive/warnings.ts` verbatim vs. promote a shared, scope-prefixed `devWarn` | **Promote** `devWarn` to a shared `ui` util taking a scope tag → prefix `[jsvision/ui <scope>]` (e.g. `menu`, `dialog`, `tabs`). The reactive callers keep their `[jsvision/ui reactive]` prefix. No `console.*` added outside this sanctioned sink. | ✅ Resolved |
| AR-12 | Edge case (#6) | Disabled items / separators | count vs. skip | Menu **separators** carry no hotkey → skipped. Menu **items have no `disabled` flag** in the data model, so no menu-tier disabled distinction. A **disabled `Cluster` item still registers** its `Alt`+hotkey → counted (it still shadows a later item). | ✅ Resolved |
| AR-13 | Semantics (#6) | Cross-scope reuse | is the same char in two *different* menus a conflict? | **No.** A duplicate is only a conflict *within* one scope (one menu level, one dialog, one strip). `x` in `File` and `x` in `Edit` is fine. | ✅ Resolved |
| AR-14 | Architecture (#11) | Switch base class | (a) extend `View` (Slider idiom) · (b) extend `Cluster` | **(a)** `Switch extends View`. `Cluster`'s ↑↓ nav is meaningless for a single toggle and its hardcoded `cluster*` roles + 5-cell box can't paint a green/dim track without a `draw()` override, so most of `Cluster` would be bypassed. Mirrors `Slider`. | ✅ Resolved |
| AR-15 | API (#11) | Construction shape | `createSwitch({…})` factory vs. `new Switch({…})` class | **Class** `new Switch({ value, label?, onLabel?, offLabel?, disabled? })`, matching `CheckGroup`/`RadioGroup`/`Slider`. Bound to a two-way `Signal<boolean>`. | ✅ Resolved |
| AR-16 | Design (#11) | Theme roles | new core role vs. reuse | **Reuse, no new core role**: `buttonFocused`/`button` for the on (green) track, `clusterDisabled`/`staticText` for the off (dim) track, focus accent on the brackets. Keeps the batch additive-only to `@jsvision/ui` (zero `@jsvision/core` change). | ✅ Resolved |
| AR-17 | Edge case (#11) | Knob glyph + no-Unicode fallback | `●` only vs. ASCII fallback | `●` (U+25CF) knob with an ASCII `o` fallback (`[o   ]`/`[   o]`) chosen at draw-time from `ctx.caps`; track inner width 4 cells. | ✅ Resolved |
| AR-18 | Scope (#11) | Slide animation | animate vs. instant | **Instant flip, no animation in v1** (a later opt-in via the timer seam is possible). | ✅ Resolved |
| AR-19 | Testing | Story + smoke for the new component | required? | **Yes** — `Switch` is a visual component, so it ships a kitchen-sink `controls/switch` story + the headless smoke test (non-negotiable gate). #17/#6 update existing stories/tests where relevant. | ✅ Resolved |
| AR-20 | Verify | The command filling every Verify line | — | **`yarn verify`** (turbo: typecheck + build + test + check:docs); a final-phase reminder to also run `yarn lint` (eslint + prettier, which `verify` does not cover). | ⚠️ Superseded by AR-24 |

## Preflight corrections (fresh-session `preflight`, 2026-07-09)

These refine — never reverse — the decisions above; they fix factual/wiring details found by grounding
the plan in the real source. See `00-preflight-report.md` (PF-003/004/005/006).

| # | Refines | Correction |
|---|---------|------------|
| AR-21 | AR-10 | **`menuBar()` lives in `menu/menubar.ts`, not `builders.ts`.** Submenu-item checks hook `subMenu()` in `builders.ts`; bar-title checks hook `menuBar()`/`MenuBar.items` in `menubar.ts`. |
| AR-22 | AR-7, AR-10 | **Tab scope = strip tabs only.** Checked at the data level over `tabs()` on `TabView` (which owns the tab data + Alt-dispatch); the mount walk does **not** descend into page contents, and tabs need no `View.accelerators()` override. A page-content accelerator sharing a tab's char does not warn in v1. |
| AR-23 | AR-9 | **Dialog scope-root walk sees only static (`add()`) children** present at mount; reactively-inserted (`addDynamic`/`Show`/`For`) accelerator views are not re-checked. Acceptable — dialog chrome is statically composed. |
| AR-24 | AR-20 | **`yarn verify` already runs `yarn lint`** (`package.json`: `yarn lint && turbo run typecheck build test check:docs`). Per-task verify therefore lints and runs `check:docs`; the "also run lint at the gate" reminder is redundant, not required. |

## Runtime decisions (exec_plan, 2026-07-09)

Decisions made during execution where a detail wasn't fully pinned by the plan docs; recorded per the
zero-ambiguity mandate.

| # | Category | Decision |
|---|----------|----------|
| AR-25 (runtime) | Testing (#6) | **The scope-warning oracles ST-14…ST-18 live in the new `accelerators.spec.test.ts`, not the existing menu/dialog/tabs specs.** Grounding the plan's "menu/dialog/tabs spec files" against the real suites showed a hard ST-ID collision (`app-shell.menu.spec` uses ST-16…18, `dialog.spec` ST-09…12, `tabs.spec` ST-14…18). Consolidating all #6 oracles (ST-9…ST-18) in one new file is the exact isolation PF-002 established for the tree markers — no renumber churn, 1:1 ST↔oracle preserved. |
| AR-26 (runtime) | API (#6) | **`devWarn` stays internal (not re-exported from the package barrel).** `reactive/warnings.ts` already defines a `devWarn`; exporting the new shared `devWarn` makes the name public and `check-jsdoc` (which resolves public names across files) then flags the reactive definition for a missing `@example`. `devWarn` is framework-internal plumbing — the public GH #6 surface is `findDuplicateAccelerators` + `reportDuplicateAccelerators`. Keeping it internal avoids the duplicate-public-name collision and needs no change to the reactive file. |
