# Ambiguity Register: Tree (RD-15)

> **Status**: ✅ GATE PASSED — all 15 items resolved
> **Last Updated**: 2026-07-03
> **Plan**: `codeops/features/jsvision-ui/plans/tree/`
> **Implements**: `jsvision-ui/RD-15` ([RD-15-tree.md](../../requirements/RD-15-tree.md))

This is the **plan-level** register (PA-NN entries). It inherits every RD-15 scope decision
(feature register AR-141…AR-150) as pre-resolved context and adds the plan-level decisions surfaced
by the TV **GATE-1 decode** (`toutline.cpp` / `outline.h`) and the RD-11 current-state recon. Four
decisions were put to the user (PA-2/PA-3/PA-5/PA-6, 2026-07-03); the rest are decode-facts (the C++
is the oracle per the fidelity directive) or single-dominant transcriptions recorded for traceability.

## Register

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|----------|-----------------|-------------------|----------|--------|
| PA-1 | Naming | Plan slug + feature | `tree` under `jsvision-ui` (matches the RD filename + sibling plans) | **`tree`**, feature `jsvision-ui` | ✅ Resolved (housekeeping) |
| PA-2 | Data & state | Tree source shape — RD says "a `Signal<TreeNode<T>>` (or roots array)". TV `TOutline` has one root (`outline.h`) | (A) **forest** `roots: Signal<TreeNode<T>[]>` (single-root = 1-element case); (B) single `root: Signal<TreeNode<T>>` (faithful, but multi-root data needs a synthetic wrapper) | **(A) forest `roots: Signal<TreeNode<T>[]>`** — more general; a single root is the 1-element case | ✅ Resolved (user 2026-07-03) |
| PA-3 | Data & state | Initial expand state — `TNode` carries its own `expanded` flag (`outline.h`); AR-141 says node data stays **plain** and the view owns expand state | (A) all-**collapsed** default + `expandedByDefault?: boolean` knob (data plain); (B) per-node `expanded?: boolean` hint seeds the Set (closest to `TNode.expanded`); (C) caller-supplied initial Set/predicate | **(A) collapsed default + `expandedByDefault?: boolean`** — the view seeds an empty (or full) expand Set; `TreeNode<T>` stays `{ value, children }` plain per AR-141 | ✅ Resolved (user 2026-07-03) |
| PA-4 | Data & state | Expand-Set key — the view-owned expand state (AR-141) needs a node key; the eager in-memory tree (AR-143) has stable node objects | (A) **object-reference** `Set<TreeNode<T>>` held in a `Signal` (bump on toggle); (B) caller-supplied `getKey(node)` | **(A) object-reference Set in a Signal** — safe under the eager model (stable node identities, AR-143); toggling adds/removes the node object + bumps the signal to re-flatten. `getKey` deferred (see Deferred) | ✅ Resolved (single-dominant) |
| PA-5 | Consistency / scope | Scroll axis — TV `TOutlineViewer` is a `TScroller` with **both** bars (`delta.x`, `updateMaxX`, `toutline.cpp:563-594`); AR-145 says "own **a** ScrollBar (like `ListView`)" (vertical) | (A) **vertical-only** now, wide rows clip; H-scroll deferred; (B) faithful **V+H** (owned HScrollBar + `delta.x` row offset) | **(A) vertical-only, H-scroll deferred** — matches AR-145 + the `ListView` `[rows fr | bar 1]` pattern; keeps `tree-rows.ts` within the 500-line budget; wide rows clip at the right edge (`DrawContext` clips). H-scroll tracked (see Deferred) | ✅ Resolved (user 2026-07-03) |
| PA-6 | Scope | Should-Have inclusion — RD lists `guides?` toggle + `expandAll()`/`collapseAll()` as Should-Haves | (A) both in MVP; (B) defer one/both | **(A) both in MVP** — `guides?: boolean` (default on; hides `│├└─` connectors for a flat-indent look, expand markers unchanged) + `expandAll()`/`collapseAll()` instance methods (TV `expandAll`, `toutline.cpp:106`) alongside the `*` key | ✅ Resolved (user 2026-07-03) |
| PA-7 | Architecture | `src/tree/` file split (AR-148) — RD says `tree.ts` + `graph.ts` + `index.ts`, but the row renderer alone ≈ 400–500 lines (RD-11 `ListRows` is 336, `list-rows.ts`) | (A) 3 files (RD sketch); (B) **4 files** — split the renderer out | **(B) 4 files**: `graph.ts` (glyphs + `createGraph` + flatten-visible), `tree-rows.ts` (the `TreeRows<T>` renderer `View`), `tree.ts` (`Tree<T>` Group `[rows fr | bar 1]` + `TreeNode<T>` + expand-state model), `index.ts` (barrel); each ≤ 500 lines; explicit named re-exports from `src/index.ts` | ✅ Resolved (single-dominant) |
| PA-8 | Naming / fidelity | Core `cpOutlineViewer` theme role names (AR-149) — palette layout 1=Normal/2=Focus/3=Select/4=NotExpanded (`outline.h:66-70`) | Role decomposition | **4 additive roles**: `outlineNormal`, `outlineFocused`, `outlineSelected`, `outlineNotExpanded` — mirrors the `list*`/`history*` naming; the two-tone collapsed text uses `outlineNotExpanded` (§ decode) | ✅ Resolved (single-dominant/decode) |
| PA-9 | Fidelity | Exact resolved `{fg,bg}` bytes for the 4 outline roles — the outline resolves through its **owner** palette then `cpAppColor` (`mapcolor.cpp:20-38`); the final byte depends on the host (gray dialog vs blue window) | (A) resolve against the project-default **gray-dialog** owner (per the 03-01 history decode convention); (B) blue window | **(A) gray-dialog owner (project default)** — the concrete attribute bytes are pinned at the exec **GATE-1 BEFORE** task by walking the real `getColor(0x0202/0x0303/0x0401)` → `mapColor` chain, and re-verified cell-by-cell at **GATE-2 AFTER** (same rigor as RD-14 PA-12). The plan's [03-03](03-03-theme-packaging.md) records the best-effort decode + confidence | ✅ Resolved (decode; bytes pinned at exec GATE-1) |
| PA-10 | Fidelity | Graph glyphs + widths | Decoded facts | **Faithful** `graphChars = "\x20\xB3\xC3\xC0\xC4\xC4+\xC4"` (`toutline.cpp:367`) = space · `│` · `├` · `└` · `─` · `─` · **`+`** (collapsed-with-children) · **`─`** (expanded); **no `[+]`/`[-]` brackets**; `levelWidth = 3`, `endWidth = 3` (`toutline.cpp:364-370`); mapped to unambiguous-narrow Unicode (§ decode) | ✅ Resolved (source-determined) |
| PA-11 | Fidelity | Two-tone collapsed text | Decoded fact | A **collapsed** node's text draws in the *not-expanded* colour (`c = (flags & ovExpanded) ? color : (color >> 8)`, `toutline.cpp:82`) — i.e. `outlineNotExpanded`; an expanded node's text uses the row-state colour (focus/select/normal). Row-state colours: focus `getColor(0x0202)`, select `getColor(0x0303)`, normal `getColor(0x0401)` (`toutline.cpp:66-71`) | ✅ Resolved (source-determined) |
| PA-12 | Behavioral | Arrow-key semantics (inherited AR-142) — TV maps ←→ to up/down (`toutline.cpp:484-540`); RD overrides | Inherited | **← collapses** the focused node (or moves to its parent when already collapsed) / **→ expands** (or descends to the first child when already expanded); ↑↓ move focus ±1; faithful `+`/`-`/`*` retained. A permitted behavioural extension (glyphs unchanged), cf. RD-14 Alt+Down | ✅ Resolved (RD AR-142) |
| PA-13 | Behavioral | Focus/selection binding (inherited AR-147) | Inherited | Mirror `ListView`: `focused: Signal<number>` (flattened-visible index) + `selected: Signal<number>` + `onSelect?`/`command?` seam; TV `cmOutlineItemSelected = 301` (`outline.h:32`) maps to the caller-supplied `command?` string (no built-in default), as `ListView` does | ✅ Resolved (RD AR-147) |
| PA-14 | Behavioral (input-model) | Mouse select — AC-6 says "double-click emits select", but the jsvision input model has **no double-click** (as RD-14 PA-16 found for the popup) | (A) mirror RD-14 PA-16 — a click in the **graph-prefix** zone toggles expand (no select); a click on the **text** sets focused+selected+emits; **Enter** selects+emits; (B) Enter-only select | **(A) mirror RD-14 PA-16** — graph-zone click = toggle (TV `mouse.x < strwidth(graph)`, `toutline.cpp:437-478`); text click = focus+select+emit (mirrors `ListRows` single-click-picks); Enter = select+emit. **Corrects AC-6's "double-click"** — a permitted input-model adaptation (the directive governs drawing, not this gap); it is a superset of the Enter path | ✅ Resolved (runtime/input-model 2026-07-03) |
| PA-15 | Behavioral | Flatten-visible + focus clamp on expand/collapse | Decoded/derived | Toggling expand re-flattens the visible list (root + recursively-expanded descendants, depth-guarded, AR-143 security). The `focused` index is re-clamped via RD-11 `clampIndex(focused, range)` and `keepVisible` re-runs so the focused row stays in view (`virtual.ts:12-37`); the owned `ScrollBar` range = flattened count (TV `setLimit(updateMaxX, updateCount)`, `toutline.cpp:592`) | ✅ Resolved (decode/dominant) |
| PA-17 | Fidelity (runtime) | **Expand-marker decode — plan 03-02 corrected at exec GATE-1.** Plan [03-02](03-02-graph-and-model.md) specified the marker as `expanded ? '─' : (children ? '+' : '─')`, but TV `traverseTree` sets `ovChildren` **only for an expanded** node (`toutline.cpp:282`), so a **collapsed**-with-children node carries neither `ovExpanded` nor `ovChildren` — the plan formula renders it `─` (wrong; it must show `+`). Caught by the Phase-1 `tree.impl` roots-swap oracle | (A) TV literal `expanded ? '─' : '+'` (`:200`, purely `ovExpanded`); (B) plan-03-02 `children`-based form (buggy) | **(A) TV literal `expanded ? '─' : '+'`** — `ovChildren` never affects the marker (it only selects col B `chars[5]`/`chars[4]`, both `─`, no visible effect). Fixed `graph.ts` + the ST-4 spec oracle (a mis-decoded oracle is the defect, per the fidelity directive) | ✅ Resolved (decode; C++ oracle 2026-07-03) |
| PA-16 | Fidelity (runtime) | **Outline theme host — PA-9 revisited at exec GATE-1.** PA-9 pinned the **gray-dialog** host, but walking the real `getColor` chain there yields `Normal == Focus == 0x70` (both `cpGrayDialog[6/7]`=0x25/0x26 → `cpAppColor[37/38]`=0x70) — the focused row is **invisible** (TV's outline has no hardware caret, so colour is the sole focus indicator). `cpOutlineViewer "\x6\x7\x3\x8"` deliberately picks distinct owner slots (6≠7), which hold apart in a **window** palette but collide incidentally in `cpGrayDialog`. The plan's own `03-03` provisional note expected "blue-family" bytes | (A) **blue-window** host `cpBlueWindow` — Normal `0x1E` yellow-on-blue, Focus `0x71` blue-on-lightGray (distinct bar), Select `0x1A` brightGreen-on-blue, NotExpanded `0x1F` white-on-blue; (B) gray-dialog per PA-9 literal (Focus==Normal, degenerate) | **(A) blue-window host** — faithful to how TV's outline actually renders; focus visible; matches the `03-03` blue-family provisional. **Supersedes PA-9.** Chain: slot→`cpBlueWindow[6/7/3/8]`=`0x0D/0x0E/0x0A/0x0F`→`cpAppColor[13/14/10/15]`=`0x1E/0x71/0x1A/0x1F` (`views.h:955`, `app.h:143`) | ✅ Resolved (user 2026-07-03, runtime) |

## Resolution Notes

**PA-4 (expand-Set key).** AR-141 keeps user data plain and gives the view the expand state. Under
the eager in-memory model (AR-143) the `TreeNode<T>` objects are stable references for the tree's
lifetime, so an object-identity `Set<TreeNode<T>>` is a sound key with no `getKey` ceremony. The Set
is wrapped so a toggle is observable: either a `Signal<Set<TreeNode<T>>>` replaced on mutate, or a
plain `Set` + a `version` `Signal<number>` bumped on toggle (the renderer reads the version to
re-flatten). If a caller replaces the whole `roots` signal with a freshly-built tree, expand state
resets to `expandedByDefault` — acceptable and documented for the eager model. A `getKey(node)`
escape hatch (for trees rebuilt from a non-materialized store) is **deferred**.

**PA-9 (color resolution — deferred to exec GATE-1).** The four outline slots resolve
`local → owner → cpAppColor` (`mapColor`, `mapcolor.cpp:20-38`; the `getColor` pair split at
`tview.cpp:484-494`). The final attribute byte depends on the host window palette, so — exactly as
the 03-01 history decode noted ("`0xHL` values assume a gray `TDialog` owner … a blue/cyan owner
re-resolves the same chain") — the plan fixes the **canonical host = gray dialog** and pins the
concrete bytes at the exec **GATE-1 BEFORE** task, verified cell-by-cell at **GATE-2 AFTER**. The
palette **structure** is fully decoded now (4 slots, the `getColor(0x0202/0x0303/0x0401)` calls, the
two-tone split); only the last-hop byte values carry an exec-time confirmation. `cpOutlineViewer`
uses `sizeof(cpOutlineViewer)` (not `-1`, `toutline.cpp:353`), so the palette has a benign trailing
null at index 5 — only slots 1–4 are ever referenced, so the off-by-one never matters.

**PA-14 (mouse select — input-model correction).** TV: a single click with `mouse.x <
strwidth(graph)` toggles expand; a double-click fires `cmOutlineItemSelected` (`toutline.cpp:433-481`).
The jsvision input model has no double-click (RD-14 PA-16 established this for the popup). So the
Tree mirrors `ListRows`: a graph-prefix click toggles expand (no select); a click on the node text
sets focused+selected and emits the select command; Enter also selects+emits. This **corrects AC-6**
("double-click selects") the same narrow, directive-permitted way RD-14 PA-16 did — drawing stays
100% faithful; only the pointer gesture is adapted to the model.

### Deferred (tracked) — plan-level

| Deferred item | From | Target | Rationale |
|---------------|------|--------|-----------|
| Horizontal scroll (owned HScrollBar + `delta.x` row offset) | PA-5 | later | AR-145 scopes to a single vertical bar; wide rows clip. TV's H-scroll is a separable enhancement. |
| `getKey(node)` expand-Set escape hatch | PA-4 | later | Object identity covers the eager model; a key fn matters only for non-materialized/rebuilt trees. |
| Lazy-load-on-expand · checkbox/multi-select · abstract `TreeModel` | RD-15 AR-143/144/141 | later (post-set) | Already deferred at the RD level; recorded here for one register. |

### Inherited RD-15 decisions (pre-resolved — see the feature register)

AR-141 (concrete reactive `TreeNode<T>`, view-owned expand state), AR-142 (←/→ collapse-expand +
faithful `+`/`-`/`*`), AR-143 (eager now; lazy deferred), AR-144 (single-select; checkbox/multi
deferred), AR-145 (reuse RD-11 virtual-scroll helpers + own `ScrollBar`, Tree-specific renderer),
AR-146 (faithful `│├└─`+`+`/`─` glyphs + two-tone collapsed text), AR-147 (mirror `ListView`
focused/selected/command), AR-148 (new `src/tree/`, explicit re-exports), AR-149 (additive faithful
`cpOutlineViewer` roles), AR-150 (kitchen-sink `Tree` story + headless `demo:tree`). These are
`✅ Resolved` in `../../requirements/00-ambiguity-register.md`; the PA entries above only add
plan-level detail.
