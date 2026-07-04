# Current State: Date family

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

Every facility RD-20 builds on is shipped and green. The date family is a **new `src/date/`
subsystem** plus one **additive** cross-RD refactor; there is no prior date code.

- **View/Group spine + reactivity (RD-03/RD-01)** — `View`/`Group`, `DrawContext` (clipped view-local
  paint), per-view focus + `focusSignal()`, `bind`/`invalidate`, `Signal`/`computed`/`Show`. The
  `Calendar` is a focusable `View`; the `DatePicker` a `Group`. `DrawContext.caps` (RD-18 seam) is
  available at draw time for any ASCII fallback (not needed by the calendar — its glyphs `▲▼` + digits
  are BMP; the picker's `▼` too).
- **Event loop (RD-04)** — focus chain, keymap/commands, mouse hit-test, `execView`/`endModal`,
  `setCapture`/`releaseCapture`, `ev.emit`/`ev.focusView` on the dispatch envelope, the `PopupHost`
  seam. The calendar's day/month keymap routes here; clicks hit-test through the standard path.
- **Essential controls (RD-06/07)** — `Input` (two-way `Signal<string>` + a `Validator`), and the
  **`picture(mask)`** validator (`controls/validators/picture.ts:397`) the field mask reuses.
- **Input dropdowns (RD-14)** — the internal **`openAnchoredPopup`** (`dropdown/popup.ts:199`) +
  `PopupHost` + `absoluteRect` anchor math + the catcher/frame/Esc/outside-click dismissal, currently
  **list-only**; `ComboBox` (`combo-box.ts`) is the composition the `DatePicker` mirrors.
- **Core color/theme (core)** — `Theme` + `defaultTheme` (`color/theme.ts`) + `PALETTE`
  (`color/palette.ts`); the additive-role pattern is well-worn (RD-06/07/11/16/17/18 all added roles).

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/core/src/engine/color/theme.ts` | `Theme` interface + `defaultTheme` | **Additive**: 6 `calendar*` roles (PA-3) |
| `packages/core/src/engine/color/palette.ts` | DOS-16 `PALETTE` (color names) | None (reuse `yellow`/`cyan`/`blue`/`green`/`white`/`darkGray`/`black`) |
| `packages/ui/src/dropdown/popup.ts` | `openAnchoredPopup` (internal) | **Generalize** to `buildContent`+`contentSize`+`commit`+`focusTarget` (PA-5) |
| `packages/ui/src/dropdown/history.ts` | History control (popup client) | **Refactor** to the generalized call (byte-identical) |
| `packages/ui/src/dropdown/combo-box.ts` | ComboBox (popup client) | **Refactor** to the generalized call (byte-identical) |
| `packages/ui/src/controls/validators/picture.ts` | `picture(mask)` validator | None (reused by the field) |
| `packages/ui/src/index.ts` | ui public entry (explicit re-exports) | **Add** `Calendar`/`DatePicker`/`CalendarDate`/helpers + types |
| `packages/ui/src/date/**` | — | **New** subsystem (6 files) |
| `packages/ui/test/tabs-theme.spec.test.ts` (+ any feedback guard) | Cross-RD additive-role closed-set guard | **Extend** the allowlist for the 6 `calendar*` roles (PA-14) |
| `packages/examples/kitchen-sink/**`, `packages/examples/date-demo/**` | Showcase | **New** stories + `demo:date` |

### Code Analysis — the two load-bearing reuse points

**1. TV `TCalendarView::draw()` (the decode source, `examples/tvdemo/calendar.cpp:124-171`)**

```cpp
color = getColor(6);  boldColor = getColor(7);          // normal / today (bold)
buf.moveChar(0, ' ', color, 22);                         // buffer allocated 22 wide…
os << setw(9) << monthNames[month] << " " << setw(4) << year
   << " " << (char)30 << "  " << (char)31 << " ";        // «month» «year» ▲  ▼   (▲=col15, ▼=col18)
writeLine(0, 0, 22, 1, buf);                             // …clipped to the 20-col VIEW (grow(-1,-1))
buf.moveStr(0, "Su Mo Tu We Th Fr Sa", color);           // weekday row (20 wide)
for (i=1..6) for (j=0..6) {                              // 6 week rows × 7 cols
  if (current<1 || current>days) moveStr(j*3, "   ");    //   leading/trailing = BLANK (no adj-month)
  else moveStr(j*3, setw(2)<<current, today?bold:color); //   2-digit right-justified at col j*3
}
```

The window is `TWindow(TRect(1,1,23,11))` = 22×10, `palette = wpCyanWindow`, inset `r.grow(-1,-1)` →
the **view is 20×8** (PF-001; the `22` in the code is an over-allocated buffer clipped to the view).
Colour chain (GATE-1, PA-3): `getColor(6)` → `cpCyanWindow[6]=0x15` → `cpAppColor[21]=0x3E`
(yellow-on-cyan); `getColor(7)` → `cpCyanWindow[7]=0x16` → `cpAppColor[22]=0x21` (blue-on-green).
Month nav: local `x=15,y=0` ⇒ ++month; `x=18,y=0` ⇒ −−month (`calendar.cpp:185-204`); `+`/kbDown
++month, `-`/kbUp −−month (TV's `↑↓`=month; our extension reassigns arrows to day-nav, AR-199).
`dayOfWeek` is Zeller with Sunday=0 (`calendar.cpp:100-121`); TV's leap check is the simpler
`year%4==0` — RD-20 corrects it to the full Gregorian rule in `daysInMonth` (AR-196).

**2. `openAnchoredPopup` (the primitive to generalize, `dropdown/popup.ts:199`)**

Today it is `<T>`-generic and hard-wired to `ListView<T>`: it calls `opts.buildList()`, focuses
`list.rows`, watches `list.rows.focusSignal()` for focus-loss dismissal, and watches `list.selected()`
for the pick. Placement (`placePopup`, `popup.ts:181-190`) is list-tuned: intermediate height
`maxRows+3`, then `intersect`-clamp to the overlay, then `−1` (the TV `THistory` sequence,
`thistory.cpp:90-98`) ⇒ `maxRows+2` unclamped. The catcher (`PopupCatcher`), frame (`PopupFrame`,
Esc→dismiss + drop shadow), `absoluteRect`, and the single reactive `createRoot` owner (so the hosted
view's computeds dispose on dismiss) are all **content-agnostic already** — only the three ListView
touch-points and the maxRows placement are list-specific (see the gap below).

## Gaps Identified

### Gap 1: `openAnchoredPopup` is list-only (PA-5 / AC-13)
**Current Behavior:** `buildList(): ListView<T>` + `onPick(index)` + `maxRows`; focus + pick + dismiss
read `ListView`-specific members (`list.rows`, `list.selected()`).
**Required Behavior:** host any fixed-size `View` (a `Calendar` is 20×8, wider with a week column) —
`buildContent(commit): View` (the popup **injects** a `commit` trigger; the content wires its own
activation callback to it — no `list.selected()` watch) + `contentSize: { width?: number; height: number }`
+ `focusTarget(content): View` (what receives focus).
**Fix Required:** replace the ListView touch-points with the generic seam; `placePopup` computes the
intermediate height as `contentSize.height + 2` then the identical `intersect`-clamp + `−1`. `History`/
`ComboBox` pass `contentSize = { height: maxRows + 1 }` (so the intermediate is `(maxRows+1)+2 = maxRows+3`,
the current value — reproducing today's rect **exactly**; NOT `maxRows + 2`) + a `focusTarget` returning
`list.rows` + a `ListView.onSelect` that runs their pick body then calls the injected `commit()`. Byte-for-byte
geometry + behavior (guarded by AC-13: their existing tests stay green, unchanged).

### Gap 2: no `calendar*` theme roles (PA-3)
**Current Behavior:** `Theme` has no calendar roles.
**Required Behavior:** 6 additive roles (bytes pinned in PA-3).
**Fix Required:** add to `Theme` + `defaultTheme`, decoded/documented; extend the cross-RD additive-role
guard allowlist (PA-14). No existing role changes.

### Gap 3: no date value type / grid math
**Current Behavior:** none.
**Required Behavior:** `CalendarDate` + pure helpers + the pure grid/week-number/format math.
**Fix Required:** new `calendar-date.ts` / `calendar-grid.ts` / `date-format.ts` (view-free, unit-tested).

## Dependencies

### Internal Dependencies
- RD-01 reactive, RD-02 layout, RD-03 view/spine, RD-04 event loop, RD-05 app shell (`PopupHost`),
  RD-06/07 `Input` + `picture`, RD-14 `openAnchoredPopup` — all shipped/green.

### External Dependencies
- None (zero runtime deps; `check:deps` holds).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Popup generalization silently changes History/ComboBox placement/behavior | Med | High | AC-13: their existing tests are the guard; refactor to pass `contentSize={height:maxRows+1}` (intermediate `(maxRows+1)+2 = maxRows+3` = current) so geometry is byte-identical; run the RD-14 suite green before + after |
| Adding 6 core roles trips a cross-RD closed-set guard | High | Low | Anticipated (PA-14): extend the allowlist, keep every byte assertion |
| `calendar.ts` exceeds 500 lines | Med | Low | Grid math pre-split into `calendar-grid.ts` (PA-6); format into `date-format.ts` |
| Cursor/selected/today precedence drawn inconsistently | Med | Med | Single precedence helper (PA-4), asserted cell-by-cell in AC-4/AC-5 |
| GATE-2 finds a geometry/colour mismatch vs `calendar.cpp` | Low | High | Mandatory BEFORE-decode + AFTER-diff tasks; the 20×8 + `0x3E`/`0x21` decode already re-verified against source (preflight PF-001 + this plan) |
