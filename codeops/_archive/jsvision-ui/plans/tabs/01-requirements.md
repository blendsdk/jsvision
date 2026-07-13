# Requirements: Tabs (`TabView`)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-17](../../requirements/RD-17-tabs.md)

## Feature Overview

A self-contained tabbed layout container — `TabView` — presents several titled pages in one framed
region, one visible at a time, with a folder-tab strip across the top that is clickable and
keyboard-navigable. It is grounded piece-by-piece in shipped, TV-decoded facilities (frame glyphs,
tilde hotkeys, disabled greying, `cpAppColor` colour) even though the tab *component* itself has no
Turbo Vision counterpart (GATE-1, AR-172). See [00-index.md](00-index.md) for the full framing.

## Functional Requirements

### Must Have

- [ ] **`TabView extends Group`** owning a focusable strip renderer (`View`) + a bordered content
      region; **self-contained** (draws both the strip and the surrounding frame). *(AR-172/174)*
- [ ] **Folder-tab visual style** — a top strip whose labels join the content frame with `┬` notches
      (`┌ ~G~eneral ┬ ~D~isplay ┐` over a bordered region), single-line box glyphs; active tab brighter,
      inactive dimmed. Top strip only. *(AR-173/184)*
- [ ] **Eager content, one visible** — each `Tab.content` is a `Group` built up-front (all mounted);
      exactly one page is `visible` at a time via a reactive `state.visible` binding keyed on `active`
      (`reflow` omits the hidden pages). Switching is a **visibility flip — no per-switch mount/dispose**,
      so page state (input text, scroll, focus) is preserved. **Not** `Show`, which disposes the inactive
      branch. *(AR-175)*
- [ ] **`tabs: Signal<Tab[]>`** — caller-owned reactive array; `Tab = { title: string; content: Group;
      disabled?: boolean; closeable?: boolean }`; updates re-render the strip + repaint. `title` carries
      optional `~X~` markup parsed with `parseTilde`. *(AR-178)*
- [ ] **`active: Signal<number>`** — index of the visible tab; **clamped** to the tab count on any
      change; on remove clamps to the neighbour (prev if removed was last, else the next at that
      position). *(AR-177)*
- [ ] **Navigation** *(AR-179/183)*:
  - [ ] **Ctrl+PageUp / Ctrl+PageDown** cycle prev/next **enabled** tab (wrap) from anywhere inside the
        `TabView`; disabled skipped. **Reliable global switch** (decoder-produced from `CSI 5;5~`/`CSI 6;5~`).
  - [ ] **`←` / `→`** cycle prev/next enabled tab when the **strip holds focus**.
  - [ ] **Alt+letter** jumps to the `~X~`-matching tab (skipping disabled).
  - [ ] **Ctrl+Tab / Ctrl+Shift+Tab** registered as a **best-effort** accelerator for the same cycle,
        firing only under the keyboard protocol (unshipped, DEF-2); never on today's default terminal.
  - [ ] Plain **Tab / Shift+Tab** keep their normal meaning — focus traversal among the *active page's*
        content widgets; never switch tabs.
  - [ ] **Click** on a label activates; on a `×` closes (closeable only); on `◄`/`►` scrolls the strip.
- [ ] **Disabled tabs** — `disabled: true` drawn in the disabled colour; not activatable by any
      key/click/hotkey; skipped by all cycling; its page never shown while disabled. *(AR-176)*
- [ ] **Hotkey accelerators** — `~X~` renders the marked letter in the hotkey style (`tildeSegments`) and
      registers an Alt+letter accelerator that jumps to that tab. *(AR-176)*
- [ ] **Overflow scrolling** — when total label width exceeds the strip, `◄`/`►` appear (only while
      overflowing) and the strip auto-scrolls to keep the active tab fully visible; off-screen tabs
      clipped; arrow clicks step the scroll. *(AR-176)*
- [ ] **Closeable + dynamic add/remove** — a `closeable: true` tab draws a `×`; clicking it removes the
      entry from the `tabs` signal (built-in handler) and fires `onClose(tab)`; `active` re-clamps. Tabs
      may equally be added/removed by writing the `tabs` signal directly. *(AR-176/178)*
- [ ] **Additive `tab*` theme roles** — `tabActive` / `tabInactive` / `tabDisabled` in core `Theme` +
      `defaultTheme`, decoded through `cpAppColor` and pinned to exact attribute bytes at GATE-1. *(AR-180 / PA-3)*
- [ ] **Kitchen-sink `Tabs` story** (id `containers/tabs`, category `Containers`; ≥3 tabs incl. one
      disabled + one closeable, `~X~` hotkeys, visible active-tab echo) passing the headless smoke test,
      plus a headless **`demo:tabs`** walkthrough (ASCII frame per step). *(AR-182/185)*

### Should Have — **all included in this plan** *(PA-1)*

- [ ] **`TabView.select(i)` / `next()` / `prev()`** — drive the same `active` signal programmatically.
- [ ] **Snap-to-first-enabled active** — when the constructed `active` points at a disabled tab, snap to
      the first enabled tab rather than showing nothing.
- [ ] **`onChange(index)`** callback — fired when the active tab changes (parallel to `onClose`).

### Won't Have (Out of Scope)

- Lazy per-tab content (`content: () => Group` built on first activation) — eager model is the MVP;
  lazy building is deferred. *(AR-175)*
- Bottom / left / right tab strips — top-strip only. *(AR-173)*
- Tab drag-reorder — the strip is a navigation surface, not a drag surface.
- Nested/scrollable content beyond the page `Group` — a page is a `Group`; the caller composes a
  `Scroller` (RD-11) inside it if needed.
- The other RD-12+ siblings: `ProgressBar`/`Spinner` (RD-18), `Surface` (RD-19), `History`/`ComboBox`
  (RD-14), `Tree` (RD-15), `Table` (RD-16). *(AR-126)*

## Technical Requirements

### Performance
- Switching the active tab is a **visibility flip** (reactive `state.visible`), not a mount/dispose — O(1) per switch.
- Strip render + overflow scroll are bounded by the number of tabs; auto-scroll keeps the active tab
  visible in a single pass. Frame compose stays within the RD-10 budget (no new hot path).

### Compatibility
- Pure TS, **ESM/NodeNext** (`.js` specifiers), **zero runtime deps** (`yarn check:deps` holds).
- No new engine primitive: reuses RD-01 `signal`/`computed`/`effect`, RD-02 layout, RD-03 `View`/`Group`/`DrawContext`,
  RD-04 focus/keymap/mouse, RD-05 `parseTilde`/`tildeSegments` + disabled-greying convention.
- Additive-only cross-package edit: 3 new `tab*` core theme roles (no existing role changes).

### Security
- Every tab `title` (incl. `~X~` segments) draws through `DrawContext` → `ScreenBuffer` + core
  `sanitize` — no raw escape sequence from a title reaches the terminal.
- The `active` index and every tab access (render, close, cycle, hotkey jump, overflow) are
  bounds-checked / clamped to the current `tabs` count — no out-of-range indexing under add/remove/
  reorder, empty tabs, or an all-disabled set.
- Tab labels are width-clipped to the strip (with `◄`/`►`), so a pathological long title cannot overflow
  the strip or viewport.
- `onClose`/`onChange` are caller callbacks invoked only on the matching user action; no tab data is
  interpreted as code.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR/PA Ref |
| -------- | ------------------ | ------ | --------- | --------- |
| Component basis | new `Group` container vs. host-framed view | `TabView extends Group`, self-contained | The shipped container idiom; batteries-included like `Dialog`/`Window` | AR-172/174 |
| Content model | eager `visible`-flip vs. lazy factory | Eager pages + reactive `visible` binding (not `Show`, which disposes) | Covers the common case + preserves page state; lazy adds switch-time lifecycle (deferred) | AR-175 |
| Global switch chord | Ctrl+Tab vs. Ctrl+PageUp/Down | **Ctrl+PageUp/PageDown** primary; Ctrl+Tab best-effort | Ctrl+Tab is byte-identical to Tab on real terminals (DEF-2); PageUp/Down decodes today | AR-179/183 |
| Glyph source | export frame consts vs. local set | **Local `src/tabs/` glyph set** | Self-contained; frame consts private + tee-less; identical code points keep fidelity | AR-184 / PA-2 |
| Theme roles | 3 vs. 4 (+strip bg) | **3** (`tabActive`/`tabInactive`/`tabDisabled`) | Folder tabs abut with no gaps; content border uses the frame role | AR-180 / PA-3 |
| Renderer filename | `tab-strip.ts` vs. `tab-rows.ts` | **`tab-strip.ts`** | A horizontal labelled strip, not a column of rows | AR-181 / PA-4 |
| Should-Have scope | include vs. defer | **Include all three** | Thin additions completing the public API in one pass | PA-1 |

> **Traceability:** Every scope decision references the Ambiguity Register entry (AR/PA #) that
> resolved it. See `00-ambiguity-register.md` (plan) and `requirements/00-ambiguity-register.md`
> (imported AR-172…185).

## Acceptance Criteria

The 15 acceptance criteria (AC-1…AC-15) are the immutable oracles the spec tests encode. They are
carried verbatim from RD-17 and enumerated as concrete ST-cases in
[07-testing-strategy.md](07-testing-strategy.md). Item 16 below is the completion/verify gate, not an AC.

1. [ ] AC-1 — tabbed container, one page visible; switching `active` swaps the page.
2. [ ] AC-2 — folder-tab chrome with faithful glyphs (line/corner + added tees `┬┴├┤`).
3. [ ] AC-3 — active vs. inactive tab role; re-theme on `active` change without teardown.
4. [ ] AC-4 — global cycle from **real decoder bytes** (`CSI 6;5~`/`CSI 5;5~`); disabled skipped; Ctrl+Tab behind capability.
5. [ ] AC-5 — `←`/`→` cycle when strip focused; content-focused Tab traverses page, not tabs.
6. [ ] AC-6 — click activates / closes (`×` + `onClose`) / scrolls (`◄`/`►`).
7. [ ] AC-7 — disabled tab drawn greyed, unactivatable, skipped; page never shown.
8. [ ] AC-8 — `~X~` renders hotkey style; Alt+letter jumps (skipping disabled).
9. [ ] AC-9 — overflow `◄`/`►`, auto-scroll to keep active visible, clipping, arrow-click steps.
10. [ ] AC-10 — closeable + dynamic add/remove; `active` clamps to neighbour, stays in range.
11. [ ] AC-11 — `defaultTheme` exposes the additive `tab*` roles; `encode()` of each does not throw; no existing role changes.
12. [ ] AC-12 — lives in `src/tabs/`, explicit re-exports; `check:deps` passes; files ≤500 lines.
13. [ ] AC-13 — kitchen-sink story (id `containers/tabs`) passes smoke; `demo:tabs` runs headless.
14. [ ] AC-14 — titles sanitized; index/access bounds-checked; labels width-clipped.
15. [ ] AC-15 — empty / all-disabled state draws safely; cycling is a no-op (no infinite loop).
16. [ ] All `yarn verify` passing; no regressions.
