# 03-05 — Seed Examples (the 8)

Owner of: the concrete example modules + their pages. Each is a real `defineExample` module (03-01),
a one-line registry entry, and a docs page embedding source + Play (03-03) + a11y region (03-04).
Every example must pass Tier-1 paint-smoke (AR-3). Phased per AR-20.

## Phase 5a — prove the mechanism (2)

| id | chrome | Builds | Proves |
|----|--------|--------|--------|
| `controls/button` | minimal | A `Button` bound to a click-count `signal`, with a visible state echo (`Text`). | The whole pipeline on the simplest widget: contract, whole-file snippet, paint-smoke, a11y, the **minimal** shell, theme/depth. |
| `files/file-dialog` | full | A `FileDialog` over `createBrowserFileSystem({ tree, home })` seeding a small tree (dirs + files). | The **virtual-FS** path (AC-9), the **full** shell (menu/status/About), a multi-view app, and the **AC-3 leak-test target** (AR-18). |

The `files/file-dialog` seed tree includes a file whose content carries a raw `ESC` byte — the source
of ST-14's `sanitize()` assertion (AC-10).

## Phase 5b — breadth (6)

| id | chrome | Builds | Proves |
|----|--------|--------|--------|
| `controls/input` | minimal | An `Input` with a live `filter`/`range` validator reject + a bound echo. | Text editing + validator UX on the minimal shell. |
| `controls/form-dialog` | full | A modal `Dialog`: `Input` + `CheckGroup` + `RadioGroup` + OK/Cancel with a `valid()` gate. | Focus/Tab, the valid()-veto close-gate, a richer multi-widget layout. |
| `containers/list-box` | minimal | A `ListBox` with type-ahead + a bound "selected" echo + wheel/↑↓. | Scrolling/list + keyboard + wheel. |
| `table/data-grid` | full | A typed `DataGrid<Person>`: sortable header, zebra, H-scroll. | A data-dense widget; sort + scroll interaction. |
| `apps/desktop` | full | The flagship Turbo Vision desktop — re-authored from `web-xterm/app.ts` `buildApp` (Desktop + windows + reactive clock). | DemoShell **full** over a real app; doubles as **RD-04's landing hero**. |
| `theming/preset-gallery` | full | A small gallery of widgets rendered so a theme switch + a depth change are visually obvious. | The **Theme** + **Depth** (re-mount) controls end-to-end; the downsampling showcase. |

## Drop order (time-box hedge, AR-20 / objection #2)
If make/exec runs long, the **core** stays: `controls/button`, `files/file-dialog`,
`controls/form-dialog`, `apps/desktop` (they cover every AC + the flagship). **Droppable:**
`controls/input`, `containers/list-box`, `table/data-grid`, `theming/preset-gallery`.

## Authoring rules
- Each module is whole-file-embeddable (small, single-purpose; no region markers — AR-6).
- No `@xterm/*` import and no DOM globals in a module; SSR/headless-safe (AR-14). `@jsvision/web`'s
  **pure** `createBrowserFileSystem` is the one sanctioned exception (used by `files/file-dialog`); the
  impure browser host surface (`mountApp`/`createBrowserHost`/`attachKeyReclaim`/`setClipboard`) stays out.
- A **modal-subject** example (`files/file-dialog`, `controls/form-dialog`) returns an `Application`
  that opens its `Dialog` via `execView` on start — a bare-placed `Dialog` is not modal (see 03-02).
- `apps/desktop` is re-authored in docs-site (not imported from the private `@jsvision/examples`). Its
  `web-xterm/app.ts` source imports `buildBrowserCaps` for `WEB_CAPS`; **drop that on re-author** — caps
  come from DemoShell/PlayController, so the example module stays free of the browser host surface.
- Each gets a docs page under `components/` (or `apps/` for `apps/desktop`) with: blurb, `<<<` source,
  `<PlayExample id="…"/>`, and the a11y region (03-04).

## Tests (see 07)
- ST-2 every seed example passes Tier-1 paint-smoke (non-empty frame).
- ST-13 `files/file-dialog` lists the seeded tree + navigates into a subdir (AC-9).
- Kitchen-sink note: RD-03 examples are a **separate** registry from the kitchen-sink stories (AR-3) —
  no kitchen-sink story is required for the mechanism itself.
