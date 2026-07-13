# Ambiguity Register: Input Dropdowns (RD-14)

> **Status**: ✅ GATE PASSED — all 15 items resolved
> **Last Updated**: 2026-07-02
> **Plan**: `codeops/features/jsvision-ui/plans/input-dropdowns/`
> **Implements**: `jsvision-ui/RD-14` ([RD-14-input-dropdowns.md](../../requirements/RD-14-input-dropdowns.md))

This is the **plan-level** register (PA-NN entries). It inherits every RD-14 scope decision
(feature register AR-130…AR-140 + preflight AR-162…AR-166) as pre-resolved context and adds the
plan-level decisions surfaced by the TV **GATE-1 decode** and the current-state recon. The two
GATE-1 carry-forwards from the RD-14 preflight (PF-007 popup rows, PF-008 store bound) are resolved
here (PA-2/PA-4). Four decisions were put to the user (PA-2/PA-3/PA-4/PA-5, 2026-07-02); the rest
are decode-facts (the C++ is the oracle) or single-dominant transcriptions recorded for
traceability.

## Register

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|----------|-----------------|-------------------|----------|--------|
| PA-1 | Naming | Plan slug + feature | `input-dropdowns` under `jsvision-ui` (matches RD filename + sibling plans) | **`input-dropdowns`**, feature `jsvision-ui` | ✅ Resolved (housekeeping) |
| PA-2 | Data & state | History store bound (PF-008): TV is a shared 1024-**byte** block, evict-oldest-by-bytes across all ids (`histlist.cpp:95,123-140`) | (A) per-id **entry-count** cap (modernized); (B) faithful byte-bounded block | **(A) per-id entry-count cap** — `Map<historyId, string[]>`, each id capped at a configurable `maxEntries` (default **16**), evict-oldest-per-id; preserves all AC-3 observable semantics; a permitted non-visual modernization | ✅ Resolved (user 2026-07-02) |
| PA-3 | UX / fidelity | Down-arrow glyph for the button icon (CP437 `0x19`) — EA-Ambiguous width, no clean narrow down-arrow | (A) U+2193 ↓ narrow; (B) U+25BC ▼ triangle; (C) ASCII `v` | **(A) U+2193 ↓ rendered narrow** — the faithful CP437 `0x19` shape, consistent with the project's block/arrow-glyph handling | ✅ Resolved (user 2026-07-02) |
| PA-4 | Data & state | `maxRows` semantics + default (PF-007): TV always grows the popup +7 (8-row window → 6 visible interior rows); RD wants configurability | (A) `maxRows` = visible rows, default 6, window = maxRows+2; (B) fixed +7 no knob; (C) `maxRows` = window rows, default 8 | **(A) `maxRows` = max visible list rows, default 6**; popup window height = `maxRows + 2`; clamped to space below the field. Corrects AC-8's "7-row/~5-visible" → **8-row window / 6 visible** | ✅ Resolved (user 2026-07-02) |
| PA-5 | Integration | Shared-overlay visibility (AR-163): one overlay `Group`, one `state.visible` toggled explicitly by the menu controller (`controller.ts:229/247`) — two clients would stomp | (A) derive visibility from having any visible popup child; (B) refcount retain/release API | **(A) derive from children** — `overlay.state.visible` becomes derived ("has any visible popup child"); the menu controller migrates off its explicit toggles to the derived model | ✅ Resolved (user 2026-07-02) |
| PA-6 | Behavioral / fidelity | History list order — RD AC-2 says "most-recent first" | Faithful C++ order vs. RD wording | **Oldest→newest, top→bottom** (`historyStr(id,0)` = front-most = oldest, `histlist.cpp:176-185`; viewer draws index 0 at top; focuses item index 1 on open when count > 1, `thstview.cpp:42-45`). **Corrects AC-2** — C++ outranks the RD per the fidelity directive; re-verified at GATE-2 | ✅ Resolved (decode/fidelity) |
| PA-7 | Consistency / fidelity | Popup geometry numbers — RD AC-8 says "7-row popup / ~5 visible" | Decoded arithmetic | Popup window = field-height + 7 (**8 rows** for a 1-row field: `a.y--`, `b.y+=7`, `b.y--` net `+7`, `thistory.cpp:90-98`); visible interior = window − 2 = **6 rows** (frame + `grow(-1,-1)`, `thistwin.cpp:63`). **Corrects AC-8 numbers** | ✅ Resolved (decode) |
| PA-8 | Integration | Public Input linkage seam shape (AR-162) — `value`/`maxLength`/`selectAll` are all `protected` (`input.ts:67/69/433`) | Promote fields to public vs. add public methods/getters | **Public methods/getters, fields stay `protected`**: promote `selectAll()` to public + add `getValueSignal(): Signal<string>` + `getMaxLength(): number`. Least churn, keeps encapsulation; existing callers unaffected | ✅ Resolved (single-dominant) |
| PA-9 | Integration | Overlay host when no app shell (bare RD-11 `Dialog`) — RD flags a plan-level seam detail | App-shell overlay (default) vs. Dialog-supplied host | **The popup takes an overlay host via the same attach-seam the `MenuBar` uses**; the app shell overlay is the default host (kitchen-sink + `demo:dropdowns` use it). A bare `Dialog` hosting a dropdown supplies its own overlay via the seam — documented, not built in this RD's MVP demos | ✅ Resolved (single-dominant) |
| PA-10 | Naming | `src/dropdown/` file split (AR-133) | One `history.ts` vs. split the store | **`popup.ts` (shared primitive), `history.ts` (History control), `history-store.ts` (the MRU store), `combo-box.ts` (ComboBox<T>), `index.ts` (barrel)**; explicit named re-exports from `src/index.ts`; each ≤ 500 lines | ✅ Resolved (single-dominant) |
| PA-11 | Fidelity | ComboBox open affordance — RD says "a trailing `▐↓▌` button" | Reuse History button vs. new glyph | **ComboBox reuses the History `▐↓▌` button glyph + roles** (draw like its siblings, per the directive governing pixels for a TV-less control) | ✅ Resolved (single-dominant/fidelity) |
| PA-12 | Naming / fidelity | Core History theme role names + decoded bytes (AR-139) | Role decomposition | **5 additive roles** (gray-dialog owner, decoded): `historyButtonSides` {fg green, bg lightGray = `0x72`}, `historyButtonArrow` {fg black, bg green = `0x20`}, `historyWindow: ThemeRole & { border, icon }` {interior/border white-on-blue `0x1F`, icon lightGreen-on-blue `0x1A`}, `historyViewer` {fg white, bg blue = `0x1F`}, `historyViewerFocused` {fg white, bg green = `0x2F`}. Mirrors the `window` role shape; decoded at GATE-1 (see [03-01](03-01-history.md)) | ✅ Resolved (single-dominant/decode) |
| PA-13 | Behavioral | ComboBox editable filter predicate | Default + override | **Case-insensitive substring by default, overridable** (`filter?: (item, text) => boolean`) — AR-134 | ✅ Resolved (RD AR-134) |
| PA-14 | Data & state | ComboBox binding | Signal shape | **Two signals**: `value: Signal<T \| null>` (selection) + the composed `Input`'s `text: Signal<string>` (field text) — AR-164 | ✅ Resolved (RD AR-164) |
| PA-15 | Behavioral | Popup dismissal triggers | Concrete mechanism | **List takes focus on open**; dismiss on (a) **Esc**, (b) **outside mouse-down** (closed + **consumed**, no pass-through), (c) **list-focus-loss** via the PF-009 `focusSignal()` — AR-166 | ✅ Resolved (RD AR-166) |
| PA-17 | Fidelity (runtime) | GATE-2 surfaced that the plan said "reuse `ListView` as-is" (02-current-state) but also decoded distinct `historyViewer`/`historyViewerFocused` roles (PA-12) — the RD-11 `ListView` hardcodes the cyan `list*` roles, so History rows would render cyan inside the blue popup (a fidelity break vs. `cpHistoryViewer`) | (A) additive `roles` override on `ListView`/`ListRows`; (B) a bespoke History viewer duplicating `ListRows` | **(A) additive `roles` override** — `ListViewOptions.roles?`/`ListRowsConfig.roles?` (default the RD-11 `list*` roles); History passes `{ normal: historyViewer, focused: historyViewerFocused, selected: historyViewer }` (`cpHistoryViewer` decode §4). Small, additive, DRY (no `ListRows` duplication); RD-11 unchanged by default (regression-verified). | ✅ Resolved (runtime 2026-07-02, GATE-2) |
| PA-16 | Behavioral (runtime) | How `openAnchoredPopup` detects a pick — decode §5 pick = `(evMouseDown && meDoubleClick) || (evKeyDown && kbEnter)`, but the jsvision input model has **no double-click** (`ListRows`: "Double-click activation is deferred") | (A) wire pick to a `list.selected` change (Enter/Space/**single-click** all pick); (B) Enter-only pick, click just moves focus | **(A) pick on `list.selected` change** — the popup effects over `list.selected` (skipping the initial value so a stale selection never auto-picks). `ListRows` sets `selected` on Enter/Space/click but NOT on arrow nav, so navigation never picks. Single-click-to-pick is a permitted modern adaptation (the fidelity directive governs drawing, not this input-model gap); it is a superset of the decoded Enter path (ST-8 still satisfied). | ✅ Resolved (runtime 2026-07-02) |

## Resolution Notes

**PA-2 (store bound).** The faithful TV store is one flat ~1024-byte block shared across *all*
`historyId`s, with `HistRec{id,len,str}` records packed contiguously and eviction dropping the
front-most (oldest) record by bytes until the incoming record fits (`histlist.cpp:123-140`). Its
cross-id shared budget is a 1990-era memory artifact — adding a long entry under one id could evict
entries under another. The directive permits modernizing non-visual internals, so the store is a
`Map<historyId, string[]>` with an independent per-id `maxEntries` cap (default 16). All four
**observable** `historyAdd` semantics are preserved verbatim: skip-empty, dedup (remove an existing
equal entry), append-most-recent, evict-oldest-when-full. `historyStr`/`historyCount` read the
per-id array with bounds checks.

**PA-6 (list order — fidelity correction).** Verified directly: `historyStr(id, 0)` calls
`startId` (`curRec = historyBlock`, the block front) then advances once to the first matching record
(`histlist.cpp:176-182`). Because `insertString` appends at the tail (`lastRec`, high address) and
eviction drops the front, the front-most record is the **oldest**. The viewer draws index 0 at the
top, so the list is **oldest→newest, top→bottom**, focusing item index 1 on open. This contradicts
RD AC-2's "most-recent first" — a mis-decode. Per the TV-fidelity directive the C++ is the oracle,
so AC-2 is corrected here and the plan's spec test encodes oldest-at-top. (ComboBox, having no TV
counterpart, lists in `items`-signal order — app-controlled.)

**PA-8 (Input seam).** Today `Input.value` (`input.ts:67`), `maxLength` (`:69`), and `selectAll()`
(`:433`) are `protected`. History must faithfully replace-text-and-`selectAll` a *linked*
(app-created) `Input` (`thistory.cpp:106-107`). Smallest non-breaking change: promote `selectAll()`
to public and add two public read accessors (`getValueSignal()`, `getMaxLength()`), leaving the
fields `protected`. History writes the picked text through the returned signal (clamped to
`getMaxLength()`) then calls `selectAll()`.

**PA-5 (derived overlay visibility).** `overlay.state.visible` is set `true` at
`controller.ts:229` and `false` at `:247`. The seam makes visibility derived from the overlay
having any visible child (an effect over `overlay`'s children, or a small `Group` helper); the menu
controller drops its two explicit assignments. This is the one change that touches existing
(menu) code — covered by a menu regression check in the execution plan (Phase 0).

### Inherited RD-14 decisions (pre-resolved — see the feature register)

AR-130 (global MRU store + injectable escape hatch), AR-131 (`editable?` modes), AR-132 (non-modal
popup), AR-133 (`src/dropdown/` subsystem), AR-134 (filter-as-you-type / type-ahead), AR-135 (open
keys), AR-136 (generic `ComboBox<T>`), AR-137 (one shared popup primitive), AR-138 (faithful
geometry + pick behavior), AR-139 (additive theme roles), AR-140 (stories + `demo:dropdowns`),
AR-162 (public Input seam), AR-163 (derived overlay visibility), AR-164 (two ComboBox signals),
AR-165 (no pre-reserved palette slots), AR-166 (concrete dismissal). These are recorded `✅ Resolved`
in `../../requirements/00-ambiguity-register.md`; the PA entries above only add plan-level detail.
