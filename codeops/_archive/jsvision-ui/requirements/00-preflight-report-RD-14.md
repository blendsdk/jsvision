# Preflight Report — RD-14 (Input Dropdowns: History · ComboBox)

> **Artifact**: `requirements/RD-14-input-dropdowns.md`
> **Reviewed**: 2026-07-02 · **Iteration**: 1
> **Reviewer**: preflight (CodeOps 3.1.0), codebase-grounded
> **Independence**: ✅ Fresh-session review — RD-14 was authored in a prior session (commit `1e3e348`); not same-session.
> **Grounding**: 2 independent recon agents — (1) UI code claims vs. `packages/{ui,core}/src`; (2) TV fidelity claims vs. `magiblot/tvision` C++.

## Verdict

**✅ PASSED — all 8 findings resolved** (3 MAJOR + 3 MINOR + 2 OBSERVATION), all Option A (user, 2026-07-02). RD-14 + the ambiguity register (AR-162…AR-166) + the ACs were updated; the two OBSERVATIONs are carried as an explicit GATE-1 note. Iteration-1 close.

_Initial scan (before resolution): ❌ BLOCKED — 3 MAJOR. 3 MINOR + 2 OBSERVATION also raised._

The **TV-fidelity substance is excellent** — every decoded fact (icon `"\xDE~\x19~\xDD"` `tvtext1.cpp:86`, `getColor(0x0102)` `thistory.cpp:60`, `cpHistory "\x16\x17"` `:37`, open chord `:77-81`, rect `r.a.x--/r.b.x++/r.b.y+=7/intersect` `:90-97`, pick→`selectAll(True)`+`maxLen` clamp `:106-107`, cancel paths `thistwin.cpp:54-57`/`thstview.cpp:76-81`, framing `wfClose`/`wnNoNumber` `:32-34`, and all five `histlist.cpp` store semantics) was **verified true against source**. The blockers are **integration-reality gaps**, not fidelity errors.

## Codebase Context Summary

- **Overlay** — one `Group` per app with a single `state.visible` boolean (`app/application.ts:140-142`), toggled by the menu controller (`menu/controller.ts:229` open→`true`, `:247` close→`false`). Popups mount via `overlay.add()` (`controller.ts:182`); attach-seam is `menuBar.attach(overlay, seam)` (`application.ts:177`). **Confirmed accurate** in the RD's citations.
- **Menu controller** is menu-specific (takes `MenuItem[]`, mounts `MenuPopup`, catcher hard-codes bar-row title switch HR-40 `controller.ts:209-218`). The RD's "generalize" is a genuine **extraction**, not literal reuse.
- **`ListView<T>`** (`list/list-view.ts:39`) is generic; exposes `items`/`getText`/`focused`/`selected`/`onSelect`/`command`/`sorted`/`typeAhead` (`:18-36`). Reuse claims **confirmed** (bar is `protected` but ComboBox composes, doesn't touch it).
- **`Input`** (`controls/input.ts`) — `value` (`:56/:67`), `maxLength` (`:57/:111`), and `selectAll` (`:433`) are all **`protected`/option-only**, NOT a public linkage surface. `Label`'s precedent links via a `View` + the PF-009 focus signal (`label.ts:38-45`) — it never reads the link's *value*.
- **Capture seam** `ev.setCapture`/`releaseCapture` exists (`view/types.ts:123-125`). **Confirmed.**
- **Theme** has `input*`/`list*`/`scrollBar*`/`window*`/`status*` roles; **no** `cpHistory*` roles and **no** reserved History slots (`color/theme.ts`, `palette.ts`). Additive add is correct.

---

## Findings

### 🟠 PF-001 (MAJOR) — History↔Input linkage needs a public Input seam; "no Input changes" is false
**Dimension**: 13 Codebase Alignment (Phantom API + Impact Blindness), 2 Assumptions.
The RD states History/ComboBox use Input's `value`/`maxLength`/`selectAll` "surface … no Input changes beyond linking" (`RD-14` lines 158-159) and AC-4 requires a pick to **replace the field text (clamp `maxLength`) + `selectAll`** — faithfully mirroring TV `thistory.cpp:106-107` (`strnzcpy(link->data, rslt, link->maxLen+1); link->selectAll(True);`). But in our port `Input.value` (`input.ts:56/67`), `maxLength` (`:111`), and `selectAll` (`:433`) are all **`protected`** — in TV they are *public* members (`data`/`maxLen`/`selectAll`). A `History` that *links an app-created `Input`* cannot reach them. So AC-4 is **not implementable** without an additive public Input linkage seam, and the "no Input changes" / additive-surface inventory is wrong.
- **(A) Recommended** — add a minimal **additive public** Input linkage seam: `selectAll()` public (or a `link(history)` method) + expose the bound value signal via a public accessor; History replaces text through the signal + calls `selectAll()`, clamping to a `maxLength` also read publicly. Faithful to AC-4; additive/non-breaking. Correct the RD's "no Input changes" line and add this to the additive-surface inventory (it's an intra-ui edit, distinct from the core theme roles).
- **(B)** — History receives the `value: Signal<string>` + `maxLength` **directly from the caller** (not via the Input object) and **drops faithful `selectAll`** (leaves the cursor). No Input change, but AC-4's `selectAll` is lost — a fidelity regression.
- **Dropped**: reach into `protected` via casts — violates the type-safety standard.
- **Confidence**: High. **Hardening**: grounded in verified `protected` modifiers + the TV public-member decode.

### 🟠 PF-002 (MAJOR) — Shared overlay has one `visible` flag; multi-client coordination undefined
**Dimension**: 4 Completeness, 6 Feasibility, 13 Architecture Mismatch.
There is exactly **one** overlay `Group` with **one** `state.visible` boolean, currently owned by the menu controller which sets it `false` on `close()` (`controller.ts:247`). The RD says the popup "mounts top-z in the app overlay via the same attach-seam" (lines 96-98) but never defines **who owns visibility when two clients share the overlay**: a menu `close()` would hide an open dropdown popup (and vice versa), and both toggling one boolean stomp each other. This likely needs a ref-counted / per-child visibility model or a distinct dropdown overlay layer — a change that may **exceed the RD's "additive = theme roles only" cross-package claim**.
- **(A) Recommended** — resolve the overlay-sharing model in the RD (then decode at plan GATE): make overlay visibility **derived** (visible while it has any mounted popup child) via a small additive app-shell seam, so menu + dropdown coexist without stomping. Explicitly list this seam in the additive surface.
- **(B)** — give the dropdown its **own** overlay layer sibling to the menu overlay (fully independent visibility); more isolation, one extra layer in the app root.
- **(C)** — document a **mutual-exclusion** constraint (a dropdown and a menu are never open together; each fully resets `visible` on close) and keep one overlay; cheapest, but a real behavioral limitation to state in the RD.
- **Confidence**: Med-High. **Hardening**: single-flag ownership verified in source; simultaneity is plausible (F10 while a combobox is open). User may pick (C) if they accept the constraint.

### 🟠 PF-003 (MAJOR) — ComboBox `value` type is incoherent in editable mode
**Dimension**: 1 Ambiguity, 3 Contradiction, 7 Testability.
AR-136 / AC-5 define `value` as "the selected `T`, **or the text** in editable mode" (`RD-14` lines 76, 190, 240). For `T ≠ string`, editable free text that matches **no** item cannot be a `T` — the API conflates a `Signal<T>` (selection) with the `Input`'s `Signal<string>` (text). AC-5 ("picking a row sets the two-way `value` **and** the field text") and AC-7 (`value` reflects the current selection) can't both hold for arbitrary `T` when free text is non-matching.
- **(A) Recommended** — **two signals**: `value: Signal<T | null>` (the selected item; `null` while free text matches nothing) **plus** the composed `Input`'s own `text: Signal<string>`. Clear, type-safe, testable; AC-5/AC-6/AC-7 reworded accordingly.
- **(B)** — restrict **editable** mode to `ComboBox<string>` (editable ⇒ `value: Signal<string>`); select-only stays generic `T`. Simpler types, narrower feature.
- **Dropped**: `value: Signal<T | string>` union — pushes ambiguity onto every consumer.
- **Confidence**: High. **Hardening**: pure API-contract logic; independent of code specifics.

### 🟡 PF-004 (MINOR) — Phantom reference: "History 22–25 palette slots RD-11 reserved (AR-112)"
**Dimension**: 13 Phantom References, 12 Consistency.
`RD-14` line 104 claims the History roles occupy "the `History 22–25` palette slots RD-11 reserved (AR-112)." No such reservation exists in `color/theme.ts` or `palette.ts`, and AR-112 actually reserved **ListViewer 26-29 + scrollBar 4-5** — nothing about History 22-25. The additive roles are fine; only the provenance claim is unfounded.
- **Recommended** — delete the "slots RD-11 reserved (AR-112)" clause; decode the real `cpHistory`/`cpHistoryWindow`/`cpHistoryViewer` attribute bytes at plan GATE-1 (per AR-139, which already says this).

### 🟡 PF-005 (MINOR) — "non-modal / rest of UI not blocked" vs. the full-viewport catcher it reuses
**Dimension**: 1 Ambiguity.
AC-9 asserts the popup is "non-modal (the rest of the UI is not blocked)" (line 252), but the mechanism it generalizes uses a **full-viewport catcher that swallows every outside mouse-down** to dismiss (`controller.ts:88-94`) — an outside click is *consumed* (dismiss-only), it does **not** reach the control behind it. So "not blocked" is ambiguous about **outside-click pass-through**.
- **Recommended** — specify **dismiss-only** (an outside click closes the popup and is consumed, matching the reused catcher; the *next* click interacts) as the low-risk default; note pass-through as a possible later enhancement. Clarifies AC-9's oracle.

### 🟡 PF-006 (MINOR) — "focus-loss" dismissal has no defined mechanism
**Dimension**: 4 Completeness, 7 Testability.
"focus-loss" is listed as a dismiss trigger 4× (lines 33, 61, 85, AC-4, AC-9) but the generalized menu code has **no focus-loss path** (dismiss = outside-click / Esc only), and the RD never says whether the popup `ListView` **takes real focus** (menus *save* focus and don't focus the popup). As written, "focus-loss cancels" isn't implementable.
- **Recommended** — either (a) drop "focus-loss" and rely on outside-click + Esc (menu-faithful), or (b) define it concretely: the popup list receives focus on open, and the PF-009 per-view focus-change signal drives dismissal when it loses focus (e.g. Tab-away). Pick one and align AC-4/AC-9.

### 🔵 PF-007 (OBSERVATION) — "7 rows" = popup height (net), ~5 visible list rows
`r.b.y += 7` nets a **+7-row popup window** (verified `thistory.cpp:93-97`), but the frame + `THistoryWindow::initViewer`'s `r.grow(-1,-1)` (`thistwin.cpp:63`) leave **~5 visible interior list rows**. AC-2/AR-138 "default 7 rows" is accurate for the **popup rect**; carry a GATE-1 note so `maxRows` semantics (popup height vs. visible list rows) aren't conflated during implementation.

### 🔵 PF-008 (OBSERVATION) — History store is byte-bounded, not count-bounded
TV's store is a fixed **1024-byte** block with evict-oldest-by-bytes (`histlist.cpp:95,126-136`), not an entry-count cap. The RD's "bounded block / evict oldest" (AC-3) is faithful, but AC-3 could read as count-bounded. At GATE-1 decide byte-block fidelity vs. a simpler entry-count cap (a reasonable non-visual modernization per the directive) and state it.

---

## Resolution log
_(Populated as the user decides each finding.)_

| Finding | Severity | Decision | New AR |
|---------|----------|----------|--------|
| PF-001 | 🟠 | (A) additive public Input linkage seam (`selectAll()` + `value` accessor + `maxLength`) | AR-162 |
| PF-002 | 🟠 | (A) derived (any-child) overlay-visibility seam | AR-163 |
| PF-003 | 🟠 | (A) two signals — `value: Signal<T\|null>` + `text: Signal<string>` | AR-164 |
| PF-004 | 🟡 | (A) drop phantom "slots 22–25" claim; decode bytes at GATE-1 | AR-165 |
| PF-005 | 🟡 | (A) dismiss-only outside-click (consumed, no pass-through) | AR-166 |
| PF-006 | 🟡 | (A) concrete focus-loss via the PF-009 signal; list focusable on open | AR-166 |
| PF-007 | 🔵 | Carried to plan GATE-1 (popup height vs. visible rows) | — |
| PF-008 | 🔵 | Carried to plan GATE-1 (byte-block vs. count cap) | — |
