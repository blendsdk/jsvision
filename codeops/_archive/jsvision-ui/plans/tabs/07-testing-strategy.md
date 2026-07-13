# Testing Strategy: Tabs (`TabView`)

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core logic (clamp/cycle/geometry/hit-test helpers) | 90% |
| Renderer + container (draw, nav, close) | 80% |
| Story / demo glue | 60% (smoke + e2e) |

- Test names state behavior: `should [expected] when [condition]`.
- Spec tests derive **only** from RD-17 AC-1…AC-15 + the `03-*` specs + the AR entries — never from
  implementation. Filed as `*.spec.test.ts` (immutable oracles). Impl/edge tests as `*.impl.test.ts`.
- Verify command (PA-5): **`yarn verify`** (= `turbo run typecheck build test`).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from `01-requirements.md` (AC-1…AC-15), the `03-*` specs, and
> `00-ambiguity-register.md`. **IMMUTABLE ORACLE:** if the implementation disagrees, the code is wrong.

### TabView container — data model, visibility, nav, clamp (`tabs.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `TabView` over `tabs=[A,B,C]`, `active=0`; render | Top tab strip + bordered region show **only page A** (B,C `visible:false`, omitted from layout) | AC-1 / AR-172/174/175 |
| ST-2 | Set `active=2` | Visible page swaps to C; strip re-themes active tab; **no mount/dispose** (all pages stay mounted — a widget's state on B survives the round-trip) | AC-1 / AR-175/177 |
| ST-3 | Render with `active=1` | Tab 1 label in `tabActive` role; tabs 0,2 in `tabInactive`; changing `active` re-themes without teardown | AC-3 / AR-173/180 |
| ST-4 | Feed **real decoder bytes** `CSI 6;5~` (Ctrl+PageDown) from anywhere inside the view | `active` advances to the next **enabled** tab (wraps at end); `CSI 5;5~` retreats | AC-4 / AR-179/183 |
| ST-5 | Ctrl+PageDown with tab 1 `disabled` (active=0) | `active` skips 1 → lands on 2 (disabled skipped) | AC-4/AC-7 / AR-176 |
| ST-6 | Ctrl+Tab (`0x09`, no keyboard-protocol capability) | Does **not** switch tabs (byte-identical to plain Tab); only fires when the capability flag is set | AC-4 / AR-183 |
| ST-7 | Strip focused, press `→` then `←` | `active` moves next-enabled then prev-enabled | AC-5 / AR-179 |
| ST-8 | A **content widget** focused, press Tab | Focus traverses the active page's content; `active` unchanged | AC-5 / AR-179 |
| ST-9 | Title `~D~isplay`, press Alt+D | `active` jumps to that tab; if that tab is disabled, no jump | AC-8 / AR-176 |
| ST-10 | Close a `closeable` tab (drive `closeTab`) | Entry removed from `tabs` signal; `onClose(tab,i)` fired; strip + content re-render | AC-6/AC-10 / AR-178 |
| ST-11 | Remove the **last** tab while it is active | `active` clamps to the new last (prev neighbour), stays in range | AC-10 / AR-177 |
| ST-12 | Remove a middle tab while active | `active` clamps to the same position (next tab), stays in range | AC-10 / AR-177 |
| ST-13 | Construct with `active` pointing at a disabled tab | Snaps to the first enabled tab (Should-Have) | AC-15 / PA-1 |
| ST-14 | `active` changes by any means | `onChange(newIndex)` fired once with the new index | Should-Have / PA-1 |
| ST-15 | Empty `tabs` signal; render | Framed region draws empty, no strip labels, no crash / no out-of-range index | AC-15 |
| ST-16 | **All** tabs disabled; Ctrl+PageDown | No page shown; cycle is a no-op (returns -1; **no infinite loop**) | AC-15 / AR-176 |
| ST-17 | `select(5)` on a 3-tab view | Clamped to index 2 (or skips to first enabled if 2 disabled); no throw | AC-10 / PA-1 |
| ST-37 | **Two** sibling `TabView`s A,B; focus a content widget **in B**; feed `CSI 6;5~` (Ctrl+PageDown) | **Only B**'s `active` advances; A unchanged (chord scoped to the focus-owning view via `isWithin`) | AC-4 / PF-002 |
| ST-38 | Two `TabView`s A,B each with a `~D~` tab; focus **in B**; press Alt+D | **B**'s matching tab activates; A unchanged (Alt-hotkey collision resolves to the focus-owning view) | AC-8 / PF-002 |

### Tab-strip renderer — chrome, hit-test, overflow (`tab-strip.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-18 | Render `[~G~eneral, ~D~isplay]`, active=0 | Folder-tab chrome: labels notched into the frame with `┬`, corners/edges `┌┐└┘│─`, tees `┬┴├┤`; asserted against the **pre-`serialize` buffer** | AC-2 / AR-173/184 |
| ST-19 | Render an active + inactive + disabled tab | Active in `tabActive`, inactive in `tabInactive`, disabled in `tabDisabled` (greyed) | AC-3/AC-7 / AR-176/180 |
| ST-20 | Title with `~X~`; render | The marked letter draws in the hotkey/shortcut style (via `tildeSegments`) | AC-8 / AR-176 |
| ST-21 | `closeable` tab; render | A `×` cell drawn in the tab's label | AC-6 / AR-178 |
| ST-22 | Labels wider than the strip; render | `◄` at left + `►` at right appear (only while overflowing); off-screen tabs clipped; active tab fully visible | AC-9 / AR-176 |
| ST-23 | Click a tab label (`hitStrip`) | Returns `{kind:'tab', index}` → `select(index)` | AC-6 / AR-179 |
| ST-24 | Click a closeable tab's `×` | Returns `{kind:'close', index}` → `closeTab(index)` + `onClose` | AC-6 / AR-178 |
| ST-25 | Click `◄`/`►` while overflowing | Returns `{kind:'arrow', dir}` → strip scrolls one step | AC-9 / AR-176 |
| ST-26 | Click in a strip gap / on the frame | `hitStrip` → `undefined`; no-op | AC-6 / AR-179 |
| ST-27 | Overflow, active tab off-screen right | `stripGeometry` auto-scrolls so the active slot is fully on-strip | AC-9 / AR-176 |
| ST-28 | Wide (East-Asian) glyph title | Measured with `stringWidth`; clip never splits a wide cell; label stays within the strip | AC-14 / security |

### Theme roles & packaging (`tabs-theme.spec.test.ts`, `tabs.packaging.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-29 | Read `defaultTheme` | `tabActive`/`tabInactive`/`tabDisabled` exist as `ThemeRole`s; `encode()` of each does not throw | AC-11 / AR-180 |
| ST-30 | Snapshot the full role set | No **existing** role changed (additive only) | AC-11 / AR-180 |
| ST-31 | Import from `@jsvision/ui` | `TabView`, `Tab`, `TabViewOptions` re-exported from `src/index.ts` | AC-12 / AR-181 |
| ST-32 | `yarn check:deps`; line count | Zero runtime deps; every `src/tabs/*.ts` ≤500 lines | AC-12 / AR-181 |

### Security (`tabs.spec.test.ts` security block)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-33 | Tab title containing a raw escape sequence (`"\x1b[31mX"`) | Drawn through `sanitize` — no raw ESC reaches the buffer/terminal | AC-14 / security |
| ST-34 | Rapid add/remove/reorder then access | Every tab access bounds-checked/clamped; never indexes out of range | AC-14 / security |

### Story + demo (smoke + e2e)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-35 | Mount the `containers/tabs` story headlessly | Unique id, required metadata (category `Containers`, `rd`), paints something; ≥3 tabs incl. disabled + closeable | AC-13 / AR-182/185 |
| ST-36 | Run `demo:tabs` headless | Completes; prints an ASCII frame per step (render → Ctrl+PageDown → Alt-jump → close → overflow) | AC-13 / AR-182 |

> **⚠️ AUTHORING RULE:** every expectation above is derived from the spec (AC/AR/03-*), not from imagined
> implementation output. The GATE-1-pinned theme **bytes** are deliberately *not* asserted (ST-29 checks
> existence + non-throw) so a faithful re-pin is never a spec violation.

## Test Categories

### Specification Tests (from ST-cases)
> Written BEFORE implementation. Filed as `*.spec.test.ts`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `tabs.spec.test.ts` | ST-1…ST-17, ST-33, ST-34, ST-37, ST-38 | `TabView` (data model, nav, clamp, multi-instance scoping, security) |
| `tab-strip.spec.test.ts` | ST-18…ST-28 | `TabStrip` (chrome, hit-test, overflow) |
| `tabs-theme.spec.test.ts` | ST-29, ST-30 | Core `tab*` theme roles |
| `tabs.packaging.spec.test.ts` | ST-31, ST-32 | Subsystem packaging |
| `kitchen-sink.smoke.spec.test.ts` (extended) | ST-35 | Story |

### Implementation Tests (edge cases, internals)
> Written AFTER implementation. Filed as `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `tabs.impl.test.ts` | Helper unit tests (`clampActive`/`firstEnabled`/`nextEnabled`/`prevEnabled`/`neighbourAfterRemove` — wrap, all-disabled -1, empty; `isWithin` — self, descendant, foreign, `null` leaf); `onChange` de-dupe; snap edge cases; read-time re-clamp on a raw caller `active.set` | High |
| `tab-strip.impl.test.ts` | `stripGeometry` edges (both-end overflow, single wide tab, active at boundaries); `hitStrip` boundaries; glyph-set code-point identity | High |

### Integration / E2E

| Test | Components | Description |
| ---- | ---------- | ----------- |
| `tabs.spec.test.ts` (integration blocks) | TabView + TabStrip + `visible`-binding + theme | Page switch on `active` (no mount/dispose); close→clamp; strip re-render on `tabs` change |
| `tabs-demo.e2e.test.ts` | examples demo child (`tsx`) | Headless walkthrough completes with per-step frames |

## Test Data

### Fixtures Needed
- A 3-tab fixture (`~G~eneral` / `~D~isplay` closeable / `~A~dvanced` disabled) with distinct page
  `Group`s — shared by container specs, the story, and the demo.
- An overflow fixture (many long-titled tabs) for ST-22/27.
- A wide-glyph title fixture for ST-28.
- A **two-`TabView`** fixture (each with a focusable content widget, one sharing a `~D~` hotkey) for the
  scoping oracles ST-37/ST-38.
- Raw byte sequences `CSI 6;5~` / `CSI 5;5~` fed through the real decoder for ST-4/ST-37 (no hand-built events).

### Mock Requirements
- None beyond the existing headless render harness (real `ScreenBuffer` + `RenderRoot`; real decoder).
  The demo e2e spawns a real `tsx` child.

## Verification Checklist
- [ ] All ST-cases defined with concrete input/output pairs
- [ ] Every ST case traces to an AC / spec doc / AR entry
- [ ] Spec tests written BEFORE implementation
- [ ] Spec tests verified to FAIL before implementation (red phase)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Implementation tests written for edge cases and internals
- [ ] All unit / integration / e2e tests pass (`yarn verify`)
- [ ] No regressions in existing tests
- [ ] Test coverage meets goals
