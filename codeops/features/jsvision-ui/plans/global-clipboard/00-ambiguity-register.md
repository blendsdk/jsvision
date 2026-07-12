# Ambiguity Register: Global Clipboard & Selection

> **Status**: ✅ GATE PASSED — all 19 items resolved (AR-18/AR-19 are exec_plan runtime decisions)
> **Last Updated**: 2026-07-12 22:08
> **Source spec**: GitHub issue #73 (self-contained handoff doc; grounded & verified against current code this session)

All decisions below were made by the user (the repo owner, who also authored issue #73). The AI
recommended; the user chose. Items marked "User accepted recommendation" were confirmed via an
explicit batch acceptance.

| #  | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|----|----------|-----------------|-------------------|---------------|--------|
| 1  | Scope / Naming | How to structure this in CodeOps — all 22 jsvision-ui RDs are shipped; this is a follow-up capability | (a) Standalone plan, no RD; (b) write an RD first; (c) lightweight task | (a) Standalone plan under `codeops/features/jsvision-ui/plans/global-clipboard/`, citing issue #73 as source | ✅ Resolved |
| 2  | Behavioral | `Ctrl+C` collision with quit/abort while a field is focused | (a) `Ctrl+C` = copy unconditionally, `Alt+X` stays quit; (b) gate copy on selection at keymap layer (not expressible) | (a) `Ctrl+C` = copy unconditionally; `Alt+X` stays quit | ✅ Resolved — User accepted recommendation |
| 3  | Scope / Config | Default clipboard-key mode | `'modern'` / `'classic'` / `'both'` / `'none'` | Default `'both'` (modern chords + classic aliases) | ✅ Resolved — User accepted recommendation |
| 4  | Technical | Shape of the in-app paste seam (no OSC-52 read) | (a) dual-sink `setClipboard` + `readClipboard()`; (b) a distinct `ev.clipboard` object; (c) unify with the editor's `Editor`-as-clipboard | (a) dual-sink `setClipboard` + new `readClipboard()` seam | ✅ Resolved — User accepted recommendation |
| 5  | Technical / Cleanup | Retire `Input`'s classic `clipboardChord()` classifier once alias bindings cover it | (a) retire it; (b) keep both paths | (a) Retire it after confirming no other caller | ✅ Resolved — User accepted recommendation |
| 6  | Scope | Cross-widget shared clipboard (copy in Editor → paste in Input and reverse) — in scope now or fast-follow | (a) in scope now; (b) defer | (a) In scope now | ✅ Resolved |
| 7  | UX / Presentation | Selection-based enable/disable of `copy`/`cut` (so a `Cut` menu/status item greys) — in scope now or fast-follow | (a) in scope now; (b) defer | (a) In scope now | ✅ Resolved |
| 8  | Behavioral / Edge | A global keymap swallows `Ctrl+A/C/X/V` and converts them to commands; a classic/WordStar-mode `Editor` binds those chords to navigation and would lose them | (a) modern-first, document the caveat, classic-editor apps opt out via `clipboardKeys:'classic'\|'none'`; (b) detect a focused classic editor and skip globalizing (complex, no view context at keymap layer); (c) don't globalize `Ctrl+A` | (a) Modern-first; document the caveat | ✅ Resolved |
| 9  | Naming | New symbol/file names | `event/default-keymap.ts`, `DEFAULT_CLIPBOARD_KEYMAP`, `buildKeymap(clipboardKeys, userKeymap)`, `EventLoopOptions.clipboardKeys`, `ApplicationOptions.clipboardKeys`, `Commands.selectAll`, `DispatchEvent.readClipboard()` | Accept all as recommended | ✅ Resolved — User accepted recommendation |
| 10 | Naming | Plan slug | `global-clipboard` | Accept | ✅ Resolved — User accepted recommendation |
| 11 | Scope / Wrap-up | Close #5 as superseded + update `CHANGELOG.md` as part of this plan | (a) include in final phase; (b) defer | (a) Include in the final phase | ✅ Resolved — User accepted recommendation |
| 12 | UX | Kitchen-sink story — new dedicated story or extend the existing `input` story | (a) new dedicated `stories/clipboard.story.ts` (`controls/clipboard`); (b) extend `input.story.ts` | (a) New dedicated story | ✅ Resolved |
| 13 | Testing | Verify command | `yarn verify` + relevant `test:e2e` + kitchen-sink smoke | Accept | ✅ Resolved — User accepted recommendation (from CLAUDE.md) |
| 14 | Behavioral / Edge | A clipboard chord fired while a **non-editable** widget (Button/ListBox) is focused | Command routes, no handler consumes it → harmless no-op (defined by the existing command-routing mechanism) | Harmless no-op — the command is simply unhandled | ✅ Resolved — obvious from the routing mechanism (`dispatch.ts` 3-phase; no editable handler ⇒ nothing acts) |
| 15 | Integration / Edge | Clipboard commands while a modal `Dialog` is open | Commands route to the focused widget inside the modal subtree (existing modal-scope behavior) — clipboard must keep working inside a dialog's `Input` | Route to the focused widget inside the modal; regression-tested | ✅ Resolved — preserves existing `scopeRoot` modal isolation |
| 16 | Security / Data | The app-local clipboard buffer — persistence, sanitization, exfiltration surface | In-process memory only, no disk/network; pasted text still passes the existing per-code-point `mapPasteChar` + validator + `maxLength` on insert; OS-clipboard write keeps the existing `setClipboard` sanitize/capability gate; no OSC-52 **read** (DEF-25 stays deferred) | In-memory only, reuse existing sanitizers, no new I/O surface | ✅ Resolved — no new I/O surface; the one new surface is a benign in-memory retention of the last-copied text (held for the app's lifetime, e.g. a value copied from an `Input`; no worse than the OS clipboard, never serialized/logged) (PF-005); DEF-25 (external read) explicitly out of scope |
| 17 | Technical / Integration *(surfaced during authoring; mechanism corrected during preflight — PF-001)* | How a loop-agnostic `Input` drives selection-based enable-gating (it has no loop reference, unlike the `Editor`) | (a) public `Input.hasSelection()` + a reactive `hasSelection` signal the app binds to make the `enableCommand` call; (b) new `ev.enableCommand` seam so `Input` self-greys like the Editor (adds a primitive + widget→loop coupling); (c) defer gating (overrides AR-7) | (a) `Input.hasSelection()` accessor **plus a new reactive `hasSelection: Signal<boolean>`** (the Editor's `hasSelection` mirror — `Input` has no selection signal today); the app binds it and wires `enableCommand` | ✅ Resolved |
| 18 *(runtime — exec_plan)* | Technical / Sequencing | The immutable ST-8 oracle (placed in Phase 1) asserts `readClipboard()`, but the plan schedules the `readClipboard` read seam in Phase 2 (task 2.2.1) | (a) pull the read seam forward into Phase 1 (read+write are one buffer unit); (b) weaken ST-8 in Phase 1 and re-assert in Phase 2 (edits an immutable oracle's placement) | (a) Implement the `readClipboard()` seam across the four sites in Phase 1's task 1.2.1 alongside the dual-sink write, so ST-8 is satisfied where the plan places it. No design change; only a small reorder. Phase 2's task 2.2.1 becomes already-done. | ✅ Resolved |
| 19 *(runtime — exec_plan)* | Behavioral / Edge (AR-8 made real) | Wiring select-all exposed `editor.impl.test.ts > "keyBindings:'wordstar' … Ctrl+C = pageDown, not copy"`: the global `'both'` default swallows WordStar's Ctrl+C→pageDown into `Commands.copy` | (a) the WordStar test opts out via `clipboardKeys: 'none'` (the plan's documented WordStar pattern); (b) via `clipboardKeys: 'classic'` (keeps DOS clipboard chords); (c) change the framework to auto-detect WordStar editors (rejected by AR-8) | (a) The test models a WordStar app that opts out with `clipboardKeys: 'none'` — **user-chosen**. `mountEditor` gains an optional `clipboardKeys` param (default unchanged). Intent preserved (Ctrl+C=pageDown still verified); feature code unchanged. | ✅ Resolved |

### Resolution Notes

**AR-1:** Matches the repo's follow-up-plan pattern (`flexible-chrome-bars`, `tv-behavioral-fidelity`
are plans with no RD). Issue #73 is the owning spec; `01-requirements.md` uses the standalone full
form and links the issue.

**AR-2:** This framework quits on `Alt+X` (the `tvision-demo` convention), not `Ctrl+C`, so the
collision is largely theoretical. Empty-selection copy is already a harmless no-op
(`controls/input.ts:272`).

**AR-4:** Grounded — `event-loop.ts:11` already imports core `setClipboard`; the loop's route-context
`setClipboard` (`:457-460`) is the single write site to extend with the in-memory second sink.
`readClipboard()` is additive across `RouteContext` (`dispatch.ts:27-67`), the `ev2` enrichment
(`dispatch.ts:180-190`), `routeContext()` (`event-loop.ts:435`), and `DispatchEvent` (`view/types.ts`).

**AR-5:** `clipboardChord()` (`controls/input-clipboard.ts:27-32`) has one caller — `Input.onEvent`
(`controls/input.ts:251`). The classic chords are re-expressed as alias bindings in
`DEFAULT_CLIPBOARD_KEYMAP` under `'both'`/`'classic'`, so the classifier becomes redundant.

**AR-6:** Half of this is nearly free: `editor-events.ts:25` already sets
`ed.mirrorSink = ev.setClipboard`, so a dual-sink `setClipboard` (AR-4) makes the editor's **copy**
fill the shared buffer with no editor edit. Only the editor's **paste** fallback to `readClipboard()`
needs new wiring (`editor/editor-clipboard.ts`).

**AR-8:** The editor default is `'modern'` key bindings (`editor/keymap.ts`), where `Ctrl+A/C/X/V`
already mean select-all/copy/cut/paste — so converting them to commands is behavior-preserving for
the common case. Only a `'wordstar'`-bound editor diverges; that app sets `clipboardKeys` to
`'classic'` or `'none'`. Recorded as a documented limitation in the default-keymap JSDoc and
`03-01`.

**AR-14 / AR-15:** These are behavioral confirmations rather than open choices, recorded so the ST
cases have an explicit source. The 3-phase router (`dispatch.ts:198-217`) already delivers commands
to the focused chain within `scopeRoot`; a modal narrows `scopeRoot` to the modal subtree
(`event-loop.ts:430-432`).

**AR-16:** No secret/PII logging; the buffer is never serialized. `setClipboard` already encodes and
capability-gates the OS write (`event-loop.ts:457-460`); paste insertion already sanitizes per code
point (`controls/input-clipboard.ts:92-97`). **Preflight note (PF-005):** the buffer *is* a new
in-memory retention — the loop now holds the last-copied text (which an `Input` did not buffer before)
for the app's lifetime. This is low-risk and no more exposed than the OS clipboard the copy also
targets; clearing it is out of scope (it would not be more protective than the OS clipboard).

**AR-17:** Surfaced while authoring `03-03`. The chosen option keeps `Input` loop-agnostic (it never
gains a loop back-reference); the app opts into greying by binding `Input`'s reactive `hasSelection`
signal (and reading the `hasSelection()` accessor) where it enables the `copy`/`cut` menu/status items
— the same layer that already wires those items. Rejected (b) because a new `ev.enableCommand`
primitive couples every widget to command-registry mutation for a polish feature. **Preflight
correction (PF-001):** the original wording said the app would "reuse the existing selection-change
signal" — but `Input`/`View` have no such signal (only `focusSignal()`, which is focus-only). Option
(a) therefore **adds** a reactive `hasSelection: Signal<boolean>` to `Input` mirroring the Editor's
(`editor/editor-draw.ts` updates `ed.hasSelection` on every selection change); the decision to keep
`Input` loop-agnostic is unchanged.
