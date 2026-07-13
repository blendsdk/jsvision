# Requirements: Global Clipboard & Selection

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: GitHub issue #73 — the self-contained spec this plan implements (no upstream RD; all 22 jsvision-ui RDs are shipped). Supersedes #5.

## Feature Overview

Provide **framework-wide clipboard & selection** — `Ctrl+A` (select-all), `Ctrl+C` (copy), `Ctrl+X`
(cut), `Ctrl+V` (paste) — that works **globally** across every editable widget in `@jsvision/ui`,
not per-widget and not classic-only. In-app paste is functional on every terminal via a loop-owned
app-local clipboard buffer; copy/cut also mirror to the OS clipboard (existing OSC-52 write). The
external OS-clipboard **read** (DEF-25 / OSC-52 read) is explicitly out of scope.

## Functional Requirements

### Must Have

- [ ] **R1** — A framework **default keymap** maps `Ctrl+A/C/X/V` to
  `Commands.selectAll/copy/cut/paste`, merged into the event loop's keymap; a user-supplied `keymap`
  wins on conflict. *(AR-4; ST-1..ST-6)*
- [ ] **R2** — A new `Commands.selectAll` command exists, and **both** `Input` and `Editor` handle it
  as a command (satisfying the swallow-the-raw-chord invariant so select-all does not regress).
  *(AR-9; ST-7, ST-14, ST-20, ST-21)*
- [ ] **R3** — A focused `Input` performs copy/cut/select-all on the modern chords; copy/cut still
  mirror to the OS clipboard; an empty selection is a harmless no-op. *(ST-8..ST-10)*
- [ ] **R4** — In-app `Ctrl+V` pastes what was copied within the app, on **every** terminal, via an
  app-local buffer — **no** OSC-52 read, **no** core-decoder change. *(AR-4; ST-11, ST-12)*
- [ ] **R5** — The external terminal paste gesture (bracketed `PasteEvent`) still inserts into
  `Input`/`Editor` (no regression). *(ST-13)*
- [ ] **R6** — Classic chords `Ctrl+Insert`/`Shift+Insert`/`Shift+Delete` still work under the
  default (`clipboardKeys: 'both'`). *(AR-3; ST-3, ST-16)*
- [ ] **R7** — `ComboBox` and `History` inherit the behavior (their editable field is an `Input`),
  verified by test. *(ST-17)*
- [ ] **R8** — A focused **non-editable** widget makes the chords harmless no-ops. *(AR-14; ST-18)*
- [ ] **R9** — Clipboard commands route correctly to the focused widget **inside a modal `Dialog`**.
  *(AR-15; ST-19)*
- [ ] **R10** — `clipboardKeys` config (`'modern' | 'classic' | 'both' | 'none'`, default `'both'`)
  is exposed on `EventLoopOptions` and `ApplicationOptions` and selects the default keymap; `'none'`
  emits no clipboard commands from the default. Under `'none'` only the widgets' raw `Ctrl+A`
  select-all survives; copy/cut/paste and the classic chords are unbound (an app supplies its own
  keymap for them). *(AR-3, AR-9; ST-2, ST-4, ST-5, ST-6)*
- [ ] **R11** — A **kitchen-sink story** demonstrates global clipboard across widgets and passes the
  headless smoke test. *(AR-12; ST-25)*

### Should Have

- [ ] **R12** — **Cross-widget** shared clipboard: copy in `Editor` → paste in `Input`, and the
  reverse. *(AR-6; ST-22, ST-23)*
- [ ] **R13** — Selection-based **enable/disable** of `copy`/`cut` so a `Cut`/`Copy` menu or status
  item greys when there is no selection. *(AR-7; ST-24)*

### Won't Have (Out of Scope)

- **OSC-52 clipboard READ (DEF-25).** Reading the external OS clipboard on demand stays deferred; it
  needs a non-additive core-decoder round-trip, is often disabled by terminals, and is redundant with
  the terminal's own paste gesture. In-app paste (R4) + bracketed paste (R5) cover the need.
- **A `Cmd`/`Super` variant.** Terminals do not deliver the ⌘/Meta modifier to the app; scope is
  Ctrl-only. (Documented in #5.)
- **Rich-format / multi-item clipboard, clipboard history UI.** Plain text, single buffer.

## Technical Requirements

### Performance
- No new per-frame work. The default keymap is compiled once at loop construction; `readClipboard()`
  returns an in-memory string.

### Compatibility
- ESM-only, zero runtime dependencies; NodeNext `.js` import specifiers.
- Additive public surface only — no breaking change to existing `EventLoop`/`Application`/widget APIs.
  The default is `'both'`, so existing apps gain modern chords without losing classic ones. The one
  documented behavioral change: a focused field now consumes `Ctrl+C` (copy) rather than letting it
  pass; apps relying on `Ctrl+C` for something else set `clipboardKeys` accordingly (AR-2).
- Files stay 200–500 lines; split before ~700.

### Security
- The app-local clipboard buffer is in-process memory only — never serialized to disk or network. It
  is a new in-memory retention (an `Input` had no buffer before) holding the last-copied text for the
  app's lifetime; this is low-risk — no more exposed than the OS clipboard the copy also targets.
- Pasted text continues to pass the existing per-code-point sanitizer (`mapPasteChar`), the validator,
  and the `maxLength` cap on insertion.
- OS-clipboard writes continue to go through the existing `setClipboard` encode + capability gate.
- No secrets/PII logged; the buffer is never logged. *(AR-16)*

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Plan structure | Standalone plan / RD-first / task | Standalone plan, no RD | Follow-up capability; issue #73 is the spec | AR-1 |
| `Ctrl+C` semantics | Copy always / gate on selection | Copy always; `Alt+X` stays quit | Collision theoretical; empty copy already no-op | AR-2 |
| Default mode | modern/classic/both/none | `both` | Nothing regresses; modern available everywhere | AR-3 |
| Paste seam | dual-sink `setClipboard`+`readClipboard()` / distinct object / editor-as-clipboard | dual-sink + `readClipboard()` | Smallest, additive, trivial widget code | AR-4 |
| Classic classifier | Retire / keep both | Retire | One code path once aliases cover it | AR-5 |
| Cross-widget clipboard | Now / later | Now | Expected from "global"; small once buffer exists | AR-6 |
| Enable-gating | Now / later | Now | Low-effort menu/status polish | AR-7 |
| WordStar-mode Editor | Modern-first+doc / detect+skip / don't globalize A | Modern-first + documented opt-out | Modern is the editor default → behavior-preserving | AR-8 |

> **Traceability:** Every scope decision references the Ambiguity Register entry (AR #) that resolved
> it. See [00-ambiguity-register.md](00-ambiguity-register.md).

## Acceptance Criteria

1. [ ] `Ctrl+A/C/X/V` work in a focused `Input` **and** a focused `Editor`, identically, by default.
2. [ ] `Ctrl+V` pastes in-app on every terminal with **no** OSC-52 read / no core-decoder change.
3. [ ] Copy/cut still mirror to the OS clipboard (OSC-52 write).
4. [ ] External bracketed paste still inserts into `Input`/`Editor` (no regression).
5. [ ] Classic `Ctrl+Insert`/`Shift+Insert`/`Shift+Delete` still work under `'both'`.
6. [ ] `ComboBox`/`History` inherit the behavior (verified).
7. [ ] `Ctrl+A` select-all does **not** regress (the command-handler invariant is satisfied).
8. [ ] A focused non-editable widget makes the chords harmless no-ops.
9. [ ] Commands route correctly inside a modal `Dialog`.
10. [ ] `clipboardKeys` selects `modern`/`classic`/`both`/`none`; a user keymap overrides defaults.
11. [ ] Cross-widget copy/paste works (Editor↔Input).
12. [ ] `copy`/`cut` grey when there is no selection.
13. [ ] Kitchen-sink story added + smoke-green.
14. [ ] `yarn verify`, relevant `test:e2e`, `yarn lint`, `yarn check:docs` all green.
15. [ ] `#5` closed as superseded; `CHANGELOG.md` updated.
16. [ ] No banned CodeOps/TV-C++ IDs in shipped JSDoc/comments; every new public export carries an `@example`.
