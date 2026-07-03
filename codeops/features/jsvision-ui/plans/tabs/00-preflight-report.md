# Preflight Report — Plan: Tabs (`TabView`)

> **Artifact**: `plans/tabs/` (jsvision-ui feature-set) — full plan doc set (00-index, 00-ambiguity-register, 01-requirements, 02-current-state, 03-01…03-03, 07-testing-strategy, 99-execution-plan)
> **Scanned**: 2026-07-03
> **Type**: Implementation plan (pre-`exec_plan` gate)
> **Scan**: 13-dimension, codebase-grounded (direct reads of dispatch/decoder/theme/frame/Show/view)
> **Result**: ✅ **PASSED** — all findings resolved Option A; edits applied to the plan set (2026-07-03). Initial scan: 0🔴 / 2🟠 / 1🟡 / 1🔵.
>
> **Resolution:** PF-001 → Option A (page-switch is a reactive `state.visible` binding, **not** `Show`; all pages stay mounted, state preserved; ST-2 holds). PF-002 → Option A (global chord + Alt-hotkey scoped to the focus-owning `TabView` via `isWithin(ev.getFocused(), this)`; **new ST-37/ST-38** two-`TabView` oracles + `isWithin` unit test). PF-003 → Option A (clamp is read/render-time via a self-correcting `effect`, since `active` is caller-owned). PF-004 → folded (AC label corrected). Edits landed in `00-index`, `00-ambiguity-register`, `01-requirements`, `02-current-state`, `03-01`, `03-02`, `07-testing-strategy`, `99-execution-plan`.

⚠️ **SAME-AUTHOR-ADJACENT REVIEW** — the plan was drafted earlier the same day (prior session,
same model). This audit was run with fresh reconnaissance; every code claim is cited to `file:line`
and independently re-verified against the live source. Consider whether the two 🟠 findings warrant
a second opinion before resolving.

---

## Codebase Context Summary

The plan targets `@jsvision/ui`, adding a new `src/tabs/` subsystem (`TabView extends Group` +
`TabStrip extends View` + barrel) plus 3 additive core `tab*` theme roles, a kitchen-sink story, and
a headless `demo:tabs`. Recon **confirmed** the plan's load-bearing reuse claims:

| Claim | Verdict | Evidence |
|-------|---------|----------|
| `*View extends Group` container idiom + renderer-split `View` | ✅ CONFIRMED | `list/list-view.ts:43`; `grid-rows.ts:353` (`GridHeader`) |
| Ctrl+PageUp/Down decode from real bytes | ✅ CONFIRMED | `input/keys.ts:62-63` (`5→pageup,6→pagedown`) + `decodeModifiers` bit 4=ctrl (`:243`); `CSI 5;5~`→`{pageup,ctrl}` |
| `preProcess` catches a chord "from anywhere inside" regardless of content focus | ✅ CONFIRMED (with caveat → PF-002) | `event/dispatch.ts:154-158` — `collectSweep(scopeRoot,'preProcess')` is focus-independent |
| Keymap/command + built-in Tab consume before 3-phase dispatch | ✅ CONFIRMED | `dispatch.ts:113-128` |
| GridHeader hit-test precedent (`local.x`→column) | ✅ CONFIRMED | `grid-rows.ts:424-432` (`local.x + indent`) |
| Additive `tab*` roles follow the `tableHeader` extension pattern; proposed bytes grounded | ✅ CONFIRMED | `color/theme.ts:154,296` (`tableHeader 0x3F`); `0x7F`=labelSelected `:62`, `0x70`=staticText `:58`, `0x78`=buttonDisabled `:68`, `clusterDisabled 0x38` `:86,280` |
| Frame glyph set is module-private + ships no tee (local glyph set justified) | ✅ CONFIRMED | `window/frame.ts:78-85` (`SINGLE_BORDER`, 6 glyphs, no `┬┴├┤`) |
| `visible:false` view omitted from layout | ✅ CONFIRMED | `view/reflow.ts:68-70`; `View.state.visible` `view.ts:47` |
| **"one page visible via `Show`" == "no per-switch mount/dispose"** | 🟠 **CONTRADICTION** | `reactive/show.ts:33-37,43` — `Show` **disposes** the inactive branch each flip (see PF-001) |
| **Ctrl+PageUp/Down + Alt-hotkey scoped to the owning `TabView`** | 🟠 **UNSPECIFIED** | `dispatch.ts:154` fires the sweep on **every** `preProcess` view in scope (see PF-002) |

---

## Findings

### 🟠 PF-001 (MAJOR) — The content model conflates two mutually-exclusive mechanisms: "one page via `Show`" vs. "eager, no per-switch mount/dispose". `Show` disposes the inactive page, which loses page state and breaks ST-2's oracle.

**Dimension 3 (Contradiction) · Dimension 13 (Architecture Mismatch) · Dimension 7 (Testability).**

The plan describes the page-switch two incompatible ways, in the same breath:

- *"each `Tab.content` is a `Group` built up-front; exactly one page visible at a time via RD-01
  `Show` keyed on `active`; switching is a **visibility flip (no per-switch mount/dispose)**"*
  (`03-01:92-93`; also `01-requirements.md:24-26`, and the perf claim `03-03`/`01-req` "O(1) …
  visibility flip, not mount/dispose").
- **ST-2** (immutable oracle, `07-testing-strategy.md:31`): *"Visible page swaps to C; … **no
  mount/dispose**."*

But `Show` (`reactive/show.ts:24`) is **not** a visibility flip — its own contract:
*"each flip **disposes the previous branch's owner scope** exactly once (its `onCleanup`s fire),
then mounts the new branch under a fresh scope"* (`:5-8`), implemented at `:33-37` (dispose) + `:43`
(rebuild). `03-01:91-92` compounds it: *"a `Show(() => i === active())` **per page**"* — one `Show`
per page with only a `then` branch means every **inactive** page evaluates to `undefined` and is
**disposed**. So:

1. **"built up-front / eager" is false after the first switch** — switching away disposes a page;
   switching back rebuilds it fresh.
2. **Page state is lost on switch** — a half-typed `Input`, a `Scroller` position, the focused
   child inside an inactive tab are all torn down. For the plan's stated primary use case — *"a
   parameters dialog with sections, a multi-page form, grouped settings"* (`00-index.md:13`) — losing
   field state when the user flips tabs is a serious UX regression.
3. **ST-2 becomes unimplementable as written** — with `Show`, a switch *is* a mount/dispose, so an
   oracle asserting "no mount/dispose" can only pass under the *other* mechanism.
4. The "O(1) per switch, no hot path" performance claim is also false under `Show` (a switch
   disposes + rebuilds a whole subtree).

**Grounded fix — verified against the reactive core, not invented:** the "eager, state-preserving,
visibility-flip" intent is achievable **without `Show`**: add every page `Group` as a normal child
of the content region and drive each page's `state.visible = (i === active())` from a reactive
`effect`; `reflow` already omits a `visible:false` subtree from layout (`view/reflow.ts:68-70`) and
invalidation repaints. That is a true visibility flip — all pages stay mounted, state is preserved,
switch is O(1). `Show` is the wrong primitive here precisely because it disposes.

**Options:**
- **Option A (recommended)** — Adopt the per-page reactive `visible` binding (no `Show`); update
  `03-01`/`01-requirements`/`02-current-state`/`03-03` to say "each page is an eager child; exactly
  one is `visible` at a time via a reactive `visible` binding keyed on `active` (reflow omits the
  hidden pages) — no mount/dispose, page state preserved." Keep ST-2 as-is (it now holds). Update
  the Related-Files/current-state `Show` references to the `visible`-binding path. *Why:* matches the
  stated eager/state-preserving intent + the immutable ST-2 oracle + the perf claim, and uses a
  primitive that actually has the required semantics. Small, purely-doc change.
- **Option B** — Keep `Show` and **accept dispose-on-switch**: rewrite `03-01`/AR-175 to "lazy-ish —
  the inactive page is disposed and rebuilt on re-activation; page state is not preserved across
  switches," **rewrite ST-2** to drop "no mount/dispose," and delete the O(1)/visibility-flip perf
  claims. *Rejected as primary:* contradicts AR-175's user-confirmed "eager, one visible at a time"
  decision and silently regresses the parameters-dialog use case; also a spec-oracle rewrite.
- **Option C** — Hybrid: `Show` to gate *construction* but cache built pages in a map and re-attach
  (memoize the `then` node). *Rejected:* re-implements the visibility-flip behavior around `Show`
  with more moving parts than Option A's direct `visible` binding; no upside.

**Confidence:** High — `Show`'s dispose semantics are explicit in `show.ts:5-8,33-37`; the
"no mount/dispose" claim and ST-2 are verbatim. **Hardening:** self-challenged whether "eager + Show"
can co-exist — it cannot (one `Show` per page with no `else` disposes each inactive page); the
`visible`-binding alternative was verified against `reflow.ts:68-70` before recommending.

---

### 🟠 PF-002 (MAJOR) — "Global from anywhere inside the `TabView`" is unspecified for multiple/nested `TabView`s: `preProcess` fires on *every* tab view in scope, so a Ctrl+PageUp/Down (or Alt-hotkey) acts on the wrong one — and no ST-case exercises it (false-green).

**Dimension 6 (Feasibility) · Dimension 4 (Completeness) · Dimension 9 (Edge Cases).**

The chosen navigation (AR-179, chosen over strip-focus-only *because* it works "from anywhere inside
the `TabView`") is routed via `TabView` `preProcess`/`onEvent` (`03-01:97-99`, `03-02:100`). Recon
confirms `preProcess` *does* see the key independent of content focus — but `route()` runs the sweep
over **all** `preProcess` views in the scope, in pre-order, first-to-set-`handled` wins
(`dispatch.ts:154-158`). There is **no** built-in "is the focus inside me?" scoping. Consequences:

1. **Two sibling `TabView`s** (e.g. two tabbed panels in one dialog): Ctrl+PageDown with focus in the
   *second* one fires the *first* `TabView`'s handler first — it switches **the wrong panel** (or, if
   it doesn't set `handled`, both switch). Actively wrong, not a no-op.
2. **Nested `TabView`s** (a tab page containing its own `TabView` — explicitly not excluded): the
   outer and inner both catch the chord.
3. **Alt-hotkey collision** (`{alt,letter}` at `preProcess`): a tab's `~D~` in the first `TabView`
   steals Alt+D from a second `TabView`'s (or a `Label`'s/menu's) `~D~`, since `preProcess` fires
   before a `Label`'s `postProcess`.
4. **False-green:** every ST-case (ST-4/5/9…) uses a **single** `TabView`, so the whole spec suite
   passes while the multi-/nested-instance behavior is wrong — the same trap the requirements
   preflight flagged (PF-001 there).

No existing component hit this because the only `preProcess` globals today are **singletons**
(`MenuBar` F10, `StatusLine`). `TabView` is the first *instantiable-many* component wanting a
subtree-scoped global chord.

**Grounded fix — verified feasible:** the routed envelope exposes `getFocused()`
(`dispatch.ts:143`, sourced from the loop) and every `View` has `.parent`, so the `TabView`
`preProcess` handler can gate on "the focused leaf is `this` or a descendant of `this` (or my strip
is focused)" before consuming — cheap parent-walk, no new primitive. This makes the chord act on
exactly the `TabView` that owns the focus.

**Options:**
- **Option A (recommended)** — Specify the scoping rule: in `03-01`/`03-02`, state that the
  `TabView` `preProcess` handler consumes Ctrl+PageUp/Down + Alt-hotkey **only when
  `ev.getFocused()` is `this` or within this `TabView`'s subtree** (else it ignores the chord, letting
  the owning `TabView` handle it). Add **ST-cases** for (i) two sibling `TabView`s — the chord
  switches only the focus-owning one; (ii) an Alt-hotkey collision resolves to the focus-owning
  `TabView`. Add a helper-unit test for the "focus-within-subtree" predicate. *Why:* delivers the
  actual "from anywhere inside **this** view" contract the register chose, closes the false-green, and
  is code-confirmed feasible with `getFocused`/`.parent`.
- **Option B** — Scope the plan to a documented **single-`TabView`-per-scope** limitation: add a
  Won't-Have ("multiple/nested `TabView`s in one dispatch scope — global chord targets the first in
  tree order") and a note in `01-requirements`. Simpler, no new tests, but knowingly ships wrong
  behavior for a plausible layout and leaves a latent bug. *Acceptable only if* multi/nested tab
  panels are truly out of scope for this milestone.
- **Option C** — Route the chord through the strip's **focus phase** instead of `preProcess` (only
  the focused strip switches). *Rejected:* that *is* the strip-focus-only model AR-179 explicitly
  rejected — it loses the "switch without focusing the strip" ergonomic.

**Confidence:** High that the gap exists (`collectSweep` is unconditional, `dispatch.ts:154`).
**Medium** on severity — single-instance (the MVP/story/demo) works; the defect needs two or nested
`TabView`s. **Hardening:** self-challenged for an existing scoping mechanism — none (MenuBar/Status
are singletons); the `getFocused`/`.parent` fix was verified on the live envelope before recommending.

---

### 🟡 PF-003 (MINOR) — Clamp is framed as write-time ("every write routes through `clampActive`"), but the caller owns the `active` signal and can write out-of-range directly; safety must be read/render-time.

**Dimension 2 (Implicit Assumption) · Dimension 12 (Consistency).**

`03-01:95` says *"every write to `active` (key/click/method/`tabs` change) routes through
`clampActive`."* But `active: Signal<number>` is **caller-owned** (AR-177/178) — a caller can do
`active.set(99)` directly, which is none of those paths, so write-time clamping cannot be guaranteed.
The security requirement already asserts the correct thing — *"every tab access (render, close,
cycle, hotkey jump, overflow) … bounds-checked/clamped"* (`01-requirements.md:93-94`) and ST-34
exercises it — so the intent is fine; only `03-01`'s framing is misleading and could lead exec to
clamp only inside `select()`/nav and trust the signal elsewhere.

**Options:**
- **Option A (recommended)** — Reword `03-01` to make clamping **read/render-time**: the `TabView`
  bounds-checks/snaps `active()` at every read (or installs a self-correcting `effect` that re-clamps
  and snaps-if-disabled whenever `active` or `tabs` changes, from any writer), so a raw caller write
  can never index out of range or show a disabled page. Keep ST-34. *Why:* aligns the design doc with
  the (correct) security AC and the caller-owned-signal reality.
- **Option B** — Leave as-is; rely on ST-34 to force read-time checks at impl. *Rejected:* the design
  doc is the exec contract; an implementer following `03-01` literally could under-clamp.

**Confidence:** High. **Hardening:** grounded in AR-177/178 (caller-owned) + `01-req:93-94`.

---

### 🔵 PF-004 (OBSERVATION) — AC list says "15 acceptance criteria" but enumerates 16 items.

`01-requirements.md:119` — "The 15 acceptance criteria …" then lists items 1–16, where #16 ("All
`yarn verify` passing; no regressions") is a gate, not an AC. Trivial: relabel #16 as a completion
gate or say "15 ACs + a verify gate." No blocking impact.

---

## Pass/Fail

✅ **PASSED** — all four findings resolved Option A and the edits applied across the plan set. The
content-model and chord-scoping mechanisms are now internally consistent (no `Show` reference survives
as the switch mechanism; `isWithin` scoping + ST-37/38 added; read-time clamp specified; AC label
fixed). A targeted re-verify of the edited sections confirmed consistency (grep: zero contradicting
`Show`/`no mount-dispose` claims remain). The plan is ready for `exec_plan tabs`.

## Same-agent adversarial checklist

- **External-standard citations:** decoder/dispatch/`Show` behavior grounded in live
  `keys.ts`/`dispatch.ts`/`show.ts`, not memory.
- **Challenger:** PF-001 (can "eager + `Show`" co-exist? — no) and PF-002 (is there an existing
  scoping mechanism? — no, only singletons) each survived an in-context refutation attempt.
- **Recommendation grounding:** the `visible`-binding fix (PF-001) was verified against
  `reflow.ts:68-70`; the `getFocused`/`.parent` scoping fix (PF-002) against `dispatch.ts:143` before
  recommending.
