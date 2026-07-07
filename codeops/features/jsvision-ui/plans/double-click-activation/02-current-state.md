# 02 — Current State Analysis

> All `file:line` grounded against the working tree @ 2026-07-07.

## The gap: no click-count in core

`MouseEvent` = `{ type, kind: 'down'|'up'|'move'|'drag', button, x, y }`
(`packages/core/src/engine/input/events.ts:28-34`). No `eventFlags`, no `meDoubleClick`, no
timestamp. `decode()` is deliberately pure and timestamp-free (corpus/golden fixtures depend on it).
⇒ double-click **cannot** be derived in core without breaking that contract (AR-1 rejects it).

## The universal seam already exists

`route()` builds **one** enriched envelope `ev2` that every dispatched event passes through before
any view sees it (`packages/ui/src/event/dispatch.ts:183-193`):

```ts
const ev2: DispatchEvent = { ...ev, emit, focusView, setCapture, releaseCapture,
                             hasCapture, setClipboard, getFocused, popupHost };
if (inner.type === 'mouse' || inner.type === 'wheel') { ctx.hitTestRoute(ev2); return; }
```

`hit-test.ts` then spreads `{ ...ev, local }` at the capture branch (`:157`), the down-bubble
(`:192`), and the non-down path (`:208`) — its parameter is named `ev`, bound to the `ev2` that
`route()` passes in (`dispatch.ts:197`). **Any field on the envelope propagates through these spreads
for free.** So a `clickCount` stamped upstream reaches every view.

The loop's entry is `route(ev)` → `route(ev, this.routeContext())` (`event-loop.ts:310-312`); the
loop already owns mutable dispatch state and builds the `RouteContext` (`:324`). It is the natural
owner of the multi-click state + an injectable clock.

**Injectable-clock precedent:** the editor takes `now?: () => number` (`editor-types.ts:35`) →
`this.clock = options.now ?? Date.now` (`editor.ts:149`); tests drive controlled timestamps through it.

## The three existing local detectors (the duplication)

1. **Editor** — `editor-mouse.ts:48-62`: `sameCell && t - lastClickTime <= 500` bumps
   `clickCount` `(n % 3) + 1`; 2 → `smDouble` (word), 3 → `smTriple` (line). State on the widget
   (`editor.ts:118-120`).
2. **Input** — `input.ts:449`: a second down on the same cell = `selectAll(true)` (a double-click
   substitute), tracked via `lastDownX` (`:79`).
3. **#39's proposal** — a 4th (per-widget `detectMultiClick`). This plan supersedes it with the
   loop-level primitive; the editor/input two stay for now (AR-6) and converge later.

## The consumers today

**`ListRows.onEvent`** (`list-rows.ts:269-288`): a `down` computes `newItem`, then
`focusTo(newItem)` + `select(newItem)` — **no `activate`**. `activate()` (`:365-372`) = `select` +
`onSelect?.(…)` + `ev.emit?.(command)`, reached only from Enter/Space (`:332-335`). This is the
single method to call on double-click.

**`GridRows.onEvent`** (`grid-rows.ts:250-262`): identical shape — `focusTo` + `select`, no emit;
`activate(ev)` on Enter/Space (`:297-300`).

**`TreeRows.handleMouseDown`** (`tree-rows.ts:251-264`):

```ts
this.focusTo(index);                                          // always focus the clicked row (:257)
if (local.x < graphWidth(row.level)) this.toggle(row.node);   // graph zone → toggle (TV-faithful)
else this.select(index, ev);                                  // text → select + onSelect + EMIT (NON-TV)
```

`select(index, ev)` (`tree-rows.ts:366`) sets `selected` + calls `onSelect` + emits `command` — it
does **not** focus (that is the separate `focusTo`). The `else` branch's emit is the non-TV
single-click activate (AR-5 removes it; double-click re-routes through `select(index, ev)` as the
activate path).

**File dialog** (`packages/files/…`): `FileList` wires activation to `openEntry` via `onSelect`
(`file-list.ts:84` → `file-dialog.ts:242-256`) — folder → enter, file → resolve + close. `onSelect`
only fires on Enter today; once `ListRows` calls `activate` on double-click, the mouse path reaches
it with **no new dialog code** (AR-9).

**`ComboBox`/`History`** popups watch the shared `selected` signal and pick on change
(`combo-box.ts:212-223`, `history.ts:120-131`) — single-click already sets `selected` → picks +
closes. Double-click is inert for them (the 2nd down lands after close) — no regression (AR-10).

## TV GATE-1 decode (BEFORE)

**`TListViewer::handleEvent`** — `tvision/source/tvision/tlstview.cpp` (re-read @ 2026-07-07):

```c
if( newItem != oldItem ) { focusItemNum( newItem ); drawView(); }
oldItem = newItem;
if( event.mouse.eventFlags & meDoubleClick ) break;                 // :271
} while( mouseEvent( event, evMouseMove | evMouseAuto ) );
focusItemNum( newItem ); drawView();
if( (event.mouse.eventFlags & meDoubleClick) && range > newItem )
    selectItem( newItem );                                          // :276-277  ← double-click = activate
...
case ' ' (space)  : selectItem( focused );                          // keyboard activate
void TListViewer::selectItem(short){ message(owner,evBroadcast,cmListItemSelected,this); }
```

**`TOutlineViewer::handleEvent`** — `tvision/source/tvision/toutline.cpp`:

```c
} while ( mouseEvent(event, evMouseMove + evMouseAuto) );
if (event.mouse.eventFlags & meDoubleClick)
        selected(foc);                                              // :465  ← double-click = activate
else {
  if (dragged < 2 && (cur = firstThat(isFocused)) != 0) {
    graph = getGraph(...);
    if (mouse.x < strwidth(graph)) { adjust(cur, !isExpanded(cur)); ... } // :472  single click in graph = toggle
    // NOTE: a single click on the TEXT does NOTHING (no selected()) — our port added the emit.
  }
}
```

**Decode conclusion:** both viewers — single click = focus (+ tree graph-zone toggle); **double
click = activate** (`selectItem`/`selected` → `cmListItemSelected`); Enter/Space = activate focused.
Our port kept the keyboard activate, dropped the double-click activate, and (tree only) *added* a
single-click text activate. This plan aligns all three. GATE-2 AFTER-diff task in 99.
