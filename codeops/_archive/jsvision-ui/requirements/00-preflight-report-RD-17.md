# Preflight Report — RD-17 (Tabs)

> **Artifact**: `requirements/RD-17-tabs.md` (jsvision UI feature-set)
> **Scanned**: 2026-07-03
> **Type**: Requirements document (single RD)
> **Scan**: 13-dimension, codebase-grounded (fresh recon; 3 parallel Explore agents + 1 adversarial challenger)
> **Result**: ✅ **PASSED** — all findings resolved Option A, edits applied to RD-17 + register (2026-07-03). Original scan: 0🔴 / 1🟠 / 1🟡 / 1🔵.
>
> **Resolution:** PF-001 → Option A (Ctrl+PageUp/Down primary reliable switch; Ctrl+Tab best-effort; AC-4 tests real bytes) = **AR-183**. PF-002 → Option A (reuse frame line/corner glyphs + add tab-junction tees; AC-2 reworded) = **AR-184**. PF-003 → folded (`containers/tabs` story id) = **AR-185**.

⚠️ **SAME-SESSION-ADJACENT REVIEW** — RD-17 was drafted 2026-07-03 (same day). This audit was
run with fresh reconnaissance and an independent challenger to counter same-author bias; every
code claim below is cited to `file:line` and independently re-verified.

---

## Codebase Context Summary

RD-17 targets `@jsvision/ui` (Turbo Vision-style widget framework on `@jsvision/core`). It proposes
a new `TabView extends Group` under `packages/ui/src/tabs/`. Recon verified its reuse claims:

| Claim | Verdict | Evidence |
|-------|---------|----------|
| Container idiom `*View extends Group` + `*Rows extends View` + owned bars | ✅ CONFIRMED | `list/list-view.ts:43`, `tree/tree.ts:50`, `table/data-grid.ts:62`; renderers `list-rows.ts:78`/`tree-rows.ts:71`/`grid-rows.ts:91` |
| `Show` + `Group.addDynamic(factory)` for one-page-at-a-time | ✅ CONFIRMED | `reactive/show.ts:24`, `view/group.ts:104` (`addDynamic(build: DynamicBuilder)`) |
| `visible:false` omitted from layout (only active page occupies region) | ✅ CONFIRMED | `view/reflow.ts:68-70` (`buildBox` returns `null`) |
| `parseTilde`/`tildeSegments` in `menu/`, reused by `Label` | ✅ CONFIRMED | `menu/builders.ts:61,80`; `controls/label.ts:17,42,60` |
| Additive `tab*` theme roles follow the shipped pattern | ✅ CONFIRMED | `color/theme.ts:16-22` (`ThemeRole {fg,bg,hotkey?}`); precedent `tableHeader` `:154/:296` (`0x3F`), `windowInactive`, `statusSelected` |
| Button/Cluster disabled-colour convention | ✅ CONFIRMED | `controls/button.ts:94-101` (`buttonDisabled`), `controls/cluster.ts:92-100` (`clusterDisabled`) via `ctx.color(role)` |
| Focusable strip `View` coexists with page content in the RD-04 focus chain | ✅ CONFIRMED | `view/view.ts:75` (`focusable`), `event/focus.ts:44-51,146-186` (hidden-subtree candidates excluded) |
| kitchen-sink Story contract + `demo:tabs` pattern | ✅ CONFIRMED | `kitchen-sink/story.ts:37-56`; `package.json:25-26` (`demo:tree`/`demo:table`) |
| Folder-tab chrome reuses the **shipped frame glyph set** incl. `┬` notches | 🟡 **PARTIAL** | `window/frame.ts:77-94` — glyphs are **module-private**, and there is **no `┬`/tee** anywhere (see PF-002) |
| **Ctrl+Tab / Ctrl+Shift+Tab** switch tabs "from anywhere" | 🟠 **INFEASIBLE on real terminals** | `input/keys.ts:32,251-253` (0x09→`{tab, ctrl:false}`), `host/modes.ts:11-15` (CSI-u deferred) (see PF-001) |

The GATE-1 fidelity finding (TV has no tab class → documented new component) is **correct** — an
independent tvision-tree search confirms only `TRefTable`/`TTable`, neither a tab control.

---

## Findings

### 🟠 PF-001 (MAJOR) — Ctrl+Tab / Ctrl+Shift+Tab, the RD's headline "from anywhere" tab switch, silently never fires on real terminals — and its spec test passes green anyway

**Dimension 6 (Feasibility) · Dimension 7 (Testability) · Dimension 13 (Stale Assumption).**

RD-17 makes **Ctrl+Tab / Ctrl+Shift+Tab** the primary, distinguishing navigation mechanism —
chosen (AR-179 option (a)) over the strip-focus-only alternative *precisely because* it switches
"from anywhere inside the `TabView`" without focusing the strip first (`RD-17-tabs.md:88-89`, AC-4
`:276-277`, AR-179 register). The RD asserts these "route through the keymap" (`:189`).

**They cannot fire on a normal terminal**, confirmed by recon **and** an independent challenger that
tried to refute it and could not:

1. The decoder maps byte `0x09` → `{key:'tab', ctrl:false}` with hard-zero modifiers
   (`input/keys.ts:32`, `:251-253`, `NO_MODS` `:85`). Plain Tab and Ctrl+Tab are the **same byte** —
   `{key:'tab', ctrl:true, shift:false}` (what a `'ctrl+tab'` keymap chord requires, `keymap.ts:47`)
   is **unreachable from real bytes**.
2. The only disambiguating mechanism (Kitty keyboard protocol / `modifyOtherKeys` / CSI-u) is
   **unimplemented in the decoder** (`keys.ts:97` — the options param is `_`-prefixed and never read)
   **and disabled at the host** (`host/modes.ts:11-15` — "no keyboard-protocol bytes are emitted
   regardless of `caps.keyboard`", DEF-2). Even on `xterm-kitty` it does nothing today.
3. Ctrl+**Shift**+Tab is worse than dead — on a non-disambiguating terminal it arrives as bare
   backtab `ESC [ Z` → `{key:'tab', shift:true}` (`keys.ts:195-199` force-sets `shift`), which
   dispatch treats as **reverse focus traversal** (`dispatch.ts:124-128` `if (inner.shift) ctx.focusPrev()`),
   the exact opposite of a tab switch — actively wrong behavior, not merely a no-op.
4. **False-green trap:** a `*.spec.test.ts` can synthesize `{key:'tab', ctrl:true}` directly and pass,
   so AC-4 (an immutable oracle) would go green while the feature is dead in every real terminal.

**Impact:** the feature still degrades to the *rejected* option's behavior — you must Tab to the
strip, then `←`/`→` — plus Alt-hotkey and click, all of which recon confirms **work reliably**. So
the component is usable, but its headline "switch from anywhere" capability is non-functional and the
test suite hides it. That is a MAJOR requirements-level defect (borderline CRITICAL: the chosen
option's sole advantage over the one it beat is the infeasible part).

**Grounded fix — verified against the decoder, not invented:** `classifyCsi` already applies xterm
modifiers to `~`-terminated keys (`keys.ts:187-192`) and `TILDE_KEYS` maps `5→pageup`, `6→pagedown`,
`17→f6` (`keys.ts:57-69`). So **`CSI 6;5~` → `{key:'pagedown', ctrl:true}` decodes cleanly today** —
Ctrl+PageUp/PageDown (the browser/editor tab-switch convention) is a real, terminal-reliable,
*disambiguable* global chord. F6/Ctrl+F6 (TV's own window-cycle chord) is likewise available.

**Options:**
- **Option A (recommended)** — Make the reliable switchers primary; demote Ctrl+Tab to best-effort.
  Rewrite AR-179 / AC-4 so the guaranteed "from anywhere" global chord is **Ctrl+PageUp/PageDown**
  (decoder-confirmed), keep **Alt-hotkey / `←→`-on-strip / click** as the confirmed reliable
  switchers, and list **Ctrl+Tab/Ctrl+Shift+Tab as an additional accelerator that lights up only when
  the terminal disambiguates** (i.e. when RD-06 "Phase B" CSI-u lands — `keys.ts:8-10`, `modes.ts` DEF-2).
  Add an AC that the reliable chords fire from real decoder bytes (not just synthesized events), so
  the false-green trap is closed. *Why:* preserves the actual user value (switch without focusing the
  strip) with a chord that works everywhere now, and honors the fidelity/feasibility discipline the
  rest of the set follows.
- **Option B** — Drop the global switch entirely; make `←→`-on-strip + Alt-hotkey + click the only
  switchers (this is AR-179 option (b), previously rejected). Simpler, fully feasible, but loses the
  "from anywhere" ergonomic the user explicitly chose (a).
- **Option C** — Keep Ctrl+Tab as specified and add "requires a CSI-u-capable terminal with keyboard
  protocol enabled" as a documented precondition + a DEF-* to implement RD-06 Phase B first. *Rejected
  as the primary path:* makes the headline feature depend on unshipped decoder work and a mode the
  host deliberately disables; every real terminal today gets nothing.

**Confidence:** High. **Hardening:** independent challenger ran against live source, tried to refute,
returned CONFIRMED on every leg; the Ctrl+PageUp/PageDown alternative was verified decodable
(`keys.ts:57-69,187-192`) before being recommended.

---

### 🟡 PF-002 (MINOR) — "reuse the shipped frame glyph set, no new glyph decode" is inaccurate: the set has no `┬` (or any tee) and is not exported

**Dimension 13 (Phantom Reference / Convention).**

RD-17 states in four places that the folder-tab chrome reuses "the shipped RD-05 **frame glyph set**
(`window/frame.ts`)" and draws `┬` notches — Feature Overview table (`:34`), AR-172 table row,
Technical "Reuse" (`:180-181`, "no new glyph decode"), and **AC-2** (`:272-273`, an immutable oracle:
"joined … with `┬` notches using the **shipped frame glyph set**").

Recon (`window/frame.ts:77-94`): the glyphs live in two **module-private** consts (`SINGLE_BORDER`/
`DOUBLE_BORDER`, not exported) typed by a private `BorderGlyphs` interface with only `tl/tr/bl/br/h/v`.
The set provides 6 of the 7 claimed glyphs but **`┬` (U+252C) is absent — grep finds no tee/junction
glyph in the file**, and folder tabs actually need several (`┬` where a tab meets the strip top, `┴`
where the active tab notches into the content frame, likely `├`/`┤` at strip ends). So the claim
"no new glyph decode … reuse the shipped set" is false: RD-17 must decode/define new junction glyphs,
and `frame.ts`'s consts can't be imported as-is.

Not a feasibility blocker (Unicode box-drawing tees are trivial to add, and plan GATE-1 already lists
"confirm the folder-tab box glyphs against the shipped frame glyph set" — which would surface this).
But per preflight's mandate the RD text and AC-2 should be corrected now.

**Options:**
- **Option A (recommended)** — Correct the wording: the tabs reuse the frame set's **line/corner
  glyphs** for the content border, and RD-17 **adds the junction glyphs** (`┬ ┴ ├ ┤`, U+252C/2534/251C/2524)
  needed for the tab notches, decoded fresh at plan GATE-1; drop "no new glyph decode". Reword AC-2 to
  "faithful single-line box glyphs (corners/edges from the frame set + the tab-junction tees added
  here)". Optionally note that `frame.ts`'s glyph consts, being private, are either exported for reuse
  or a small local glyph set is defined in `tabs/`. *Why:* keeps the claim truthful and pins the real
  (small) additive surface.
- **Option B** — Leave as-is and let plan GATE-1 catch it. *Rejected:* preflight exists to catch stale
  code claims before planning; an immutable AC asserting a false reuse is exactly what should be fixed
  at the requirements gate.

**Confidence:** High (grep-confirmed absence + private consts). **Hardening:** in-context re-read of
`frame.ts:77-94`.

---

### 🔵 PF-003 (OBSERVATION) — kitchen-sink story `id` is unspecified; pin it to the dominant `containers/tabs` convention

**Dimension 12 (Consistency).**

AC-13 / AR-182 require a `Tabs` story but don't pin its `id`. Recon found the registry's `id`
convention is *mostly* `category/name` (e.g. `'containers/tree'`, `stories/tree.story.ts:30`) but the
DataGrid story drifted to a bare `'data-grid'`. To avoid inheriting that drift, RD-17 should state the
story `id` as **`containers/tabs`** (category `Containers`, matching Tree/DataGrid). Trivial; record it
so the plan doesn't re-decide. No blocking impact.

---

## Pass/Fail

❌ **BLOCKED** — one MAJOR (PF-001) unresolved. Resolve PF-001 (recommend Option A) and PF-002
(recommend Option A); fold PF-003 into the story task. Re-scan not required after doc edits unless the
navigation model changes shape; a targeted re-verify of the edited AR-179/AC-4/AC-2 suffices.

## Same-agent adversarial checklist

- **External-standard citations:** decoder/terminal behavior grounded in live `keys.ts`/`modes.ts`, not
  memory; the "Ctrl+Tab is byte-identical to Tab" claim is a real xterm/VT limitation, confirmed in code.
- **Challenger:** PF-001 survived an independent refutation attempt (CONFIRMED on all four legs).
- **Recommendation grounding:** the Ctrl+PageUp/PageDown fix was verified decodable before recommending.
