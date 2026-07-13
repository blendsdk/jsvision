# Testing Strategy: Runtime Hardening (RD-13)

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Every HR-NN becomes a **spec oracle** (RED before the fix — AC-1 requires the critical trio to
demonstrably reproduce), then impl tests for edges. ST ids are grouped by the RD's acceptance
criteria: **ST-\<AC\>.\<letter\>**. The RD's per-HR "How to test / Expected result" text is the
source of each oracle; the register (PA-N) supersedes it only where recorded (PA-3's `ESC ESC`).

### Coverage Goals
- One spec oracle per HR (except docs-only HR-55) + fuzz/property oracles for the critical trio.
- Impl tests per component doc's "Testing Requirements".
- Existing suites stay green per phase (`yarn verify`, `test:e2e`, `check:deps`, `lint`, `gate` — AC-9).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-13, the component specs (`03-*.md`), and the Ambiguity Register.
> **IMMUTABLE ORACLE RULE** applies — with the project's one narrow exception: a **TV-fidelity**
> oracle that contradicts a faithful C++ decode is corrected against the cited `.cpp` (AC-8,
> `codeops/tv-fidelity-gate.md`).

### AC-1 — Critical trio (Phase 1)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1.x | `decode(createDecoderState(), Uint8Array.of(...))` for each of `[F4,90,80,80]`, `[ED,A0,80]`, `[E0,80,80]`, `[C0,80]` | never throws; **zero** key events; `flush()` leaves no carry | HR-01 |
| ST-1.x-fuzz | seeded fuzz: every lead byte `0x80–0xFF` × random continuation tails | `decode` never throws; every emitted printable key is a Unicode scalar value | HR-01 / AC-1 |
| ST-1.y | tree with desktop at `y≥1`; modal `Dialog` via `execView`; mouse-down at a known absolute cell over a known child; also a click on the modal's last row | delivered `ev.local` equals the child-local coordinate (no ancestor shift); last-row click hits the modal | HR-02 |
| ST-1.y-prop | same dialog mounted at offsets `{0,0}`, `{0,1}`, `{3,2}`, `{10,5}` | identical `ev.local` for the same dialog-relative click at every offset | HR-02 / AC-1 |
| ST-1.z | root scope with an effect tracking `s`; `batch(() => { s.set(1); dispose(root); })`; then `s.set(2)` | effect body never runs after disposal; zero re-runs on the later write | HR-03 |
| ST-1.z2 | `Show`/`For` branch/row torn down in the same flush that dirtied a child effect | no post-teardown execution; removed node absent from every source's `observers` | HR-03 |

### AC-2 — Core majors (Phase 2)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-2.1 | an `XTVERSION` DCS reply (`ESC P > \| … ST`) split at **every** interior byte offset | each split yields the same single query result (or `incomplete` carry); **zero** key events | HR-04 |
| ST-2.2 | `ScreenBuffer.text` writes `'a\tb'`, `'a\nb'`, lone `'\t'` | serialized bytes contain no raw `\t`/`\n`/C0; each C0 stored as one space cell; positions match the space-replaced string | HR-05 / **PA-5** |
| ST-2.3 | fake runtime where fd1+fd2 share `{dev,ino}`: (a) sink `'auto'`; (b) explicit `sink:'stderr'`; (c) distinct devices | (a) degrades to ring sink, no UI writes; (b) throws `LoggerConfigError`; (c) stderr allowed | HR-06 / **PA-6** |
| ST-2.4 | `resolveCapabilities({env:{TERM:'xterm-kitty',COLORTERM:'truecolor',LANG:'en_US.UTF-8'}})`; and a `TERM=dumb`/non-UTF-8 env | UTF-8: `glyphs.boxDrawing===true && halfBlocks===true`, `ambiguousWide===false`; non-UTF-8: all false. Plus: one demo minus its override, caps resolved with an **explicit** `env:{ LANG:'en_US.UTF-8' }` (PF-002 — locale-gated, not `unicode.utf8`-gated), still renders `┌`/`─` (not `+`/`-`) | HR-07 / **PA-9** |

### AC-3 — Lifecycle majors (Phase 3)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-3.a | group with two focusable children; focus one; `remove` it (repeat via `unmountDynamicChild`) | `getFocused()` is the sibling (re-home) or `null` when none remains; a dispatched key never reaches the removed view | HR-10 / **PA-10** |
| ST-3.b | unmount a view; call `isFocusable(view)` and `focusView(view)` | `isFocusable` is `false`; `focusView` is a genuine no-op (real focused leaf keeps `focused === true`) | HR-11 |
| ST-3.c | child registers `onMount(() => group.add(grandchild))`; flushes settle. Second: a `draw()` that `invalidate()`s a sibling | grandchild has non-degenerate bounds and painted; the sibling recomposes on the next scheduled flush | HR-12 / **PA-12** |
| ST-3.d | `group.addDynamic(For(sig, …))`; unmount the group; write `sig` | render fn not called again; zero new scopes (tracked via `onCleanup`/counter) | HR-13 |
| ST-3.e | begin a drag gesture; open+close a modal (capture cleared) without mouse-up; dispatch a mouse-move over the desktop | no window moves; `gesture` cleared | HR-14 / **PA-13** |

### AC-4 — Shell majors (Phase 4)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-4.a | window focused on the desktop; `emitCommand(Commands.close)`; also the tvision-demo F3 chord path | the focused window is removed; the next window (if any) focused; `ev.handled` set | HR-08 |
| ST-4.b | A focused, B inactive; mouse-down over B's close / zoom / grip columns; then a **second** click on the same zone | first click: B raised+activated, **not** closed/zoomed/resized; second click performs the action | HR-09 / `tframe.cpp:150-193` |

### AC-5 — Minor batch: core engine (Phase 5)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-5.a | start→render→stop→start→render a differing frame | the post-restart frame is a **full** repaint (no stale-baseline partial) | HR-15 |
| ST-5.b | `decode([0x1b,0x1b])` same chunk; and Esc → `flush()` → Esc | same chunk: one `escape` event with `alt:true`; flush-separated: two bare escapes | HR-16 / **PA-3** |
| ST-5.c | write `'éx'` (e + U+0301 + x) | mark composes onto the `e` cell (one cell, width 1, glyph carries the mark); `x` in the next cell | HR-17 |
| ST-5.d | serialize a width-2 glyph with `unicode.utf8:false` | two fallback cells `'? '`; no column drift in the row | HR-18 / **PA-11** |
| ST-5.e | table-driven `charWidth` over `U+2B50`, `U+231A/B`, `U+23E9–23F3`, `U+2705`, `U+2728`, `U+274C`, `U+1F004`, `U+1F200`, `U+17000`, emoji samples | width 2 for every EAW `W`/`F` sample | HR-19 / **PA-18** |
| ST-5.f | recolor only the continuation cell of a wide glyph; serialize the damage | the lead glyph is re-emitted with the new style; no empty styled run | HR-20 / **PA-14** |
| ST-5.g | `setClipboard('line1\r\nline2', caps)` (and control-char payloads) | the base64 payload decodes to the **exact** input | HR-21 / **PA-7** |
| ST-5.h | bytes typed during async detection (mixed into query replies) | they surface as key events after detection completes | HR-22 |
| ST-5.i | `import { KEY_NAMES, type PasteState } from '@jsvision/core'` | both resolve (compile + runtime) | HR-23 |
| ST-5.j | `decode([0x1b,0x5b])` then `flush()` | Alt+`[` (or escape+`[`) — not a fused CSI with the next key | HR-24 |
| ST-5.k | `box()` with a CJK/emoji title | title centered by display width; clipped to the box | HR-25 |
| ST-5.l | logger built with `env.JSVISION_DEBUG='1'` / `env.JSVISION_LOG=path`; grep source for `BLENDTUI_` | new names honored; zero `BLENDTUI_` references remain | HR-26 / **PA-4** |

### AC-6 — Minor batch: reactive/view (Phase 6)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-6.a | `computed(() => { throw E })`; read twice | first read throws `E`; second read **also** throws (never `undefined`) | HR-27 |
| ST-6.b | computeds `a ⇄ b`; read `a` | throws `ReactiveCycleError` (no silent `undefined`) | HR-28 |
| ST-6.c | batch whose body throws `E1` and whose closing flush throws `E2` | `E1` propagates; `E2` reported via the multi-throw drain | HR-29 / **PA-15** |
| ST-6.d | draw-context `box()` CJK title; `text('é…')` | display-width centering; combining marks composed, not dropped | HR-30 |
| ST-6.e | flip `state.visible` both directions with **only** `invalidate()` | the view disappears (region repainted) / appears (composed fresh) | HR-31 / **PA-8** |
| ST-6.f | `view.onCleanup(fn)` registered inside a `bind` body; re-run the bind 3×; unmount | `fn` fires exactly once, at unmount | HR-32 |
| ST-6.g | `auto` container: small flow child + large absolute child | `naturalSize` = the flow child's size | HR-33 |
| ST-6.h | two side-by-side windows, front casting a shadow onto the back; invalidate the back | the shadow overhang survives the partial recompose | HR-34 / **PA-16** |

### AC-7 — Minor batch: event/shell (Phase 7)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-7.a | menu bar with a bare top-level command item; arrow onto it; Enter. Then re-open, arrow onto it, Esc | Enter emits the command and closes; Esc always closes | HR-35 / **PA-17** |
| ST-7.b | open a menu; resize the viewport larger; click in the newly-exposed region | the click hits the catcher (menu closes; outer tree inert) | HR-36 |
| ST-7.c | dialog kept mounted after its modal ends; global Esc; a second unrelated modal opened | Esc not consumed by the retained dialog; the unrelated modal unaffected | HR-37 |
| ST-7.d | keymap-bound quit during a 2-deep modal stack; variant where a `Dialog.valid()` vetoes | no veto: both modals resolve with the quit command, then the app quits; veto: cascade stops, app stays | HR-38 / **PA-2** |
| ST-7.e | disable the focused child; press Tab; dispatch a key | focus moved to the neighbor; no key reaches the disabled view | HR-39 |
| ST-7.f | menu A open; click top-level title B | menu B opens directly (one click) | HR-40 |
| ST-7.g | zoom a window; resize the desktop; also check `restoredRect` after shrink | zoomed window re-maximizes to the new desktop; `restoredRect` clamped on-screen | HR-41 |
| ST-7.h | a sweep handler that removes a later view mid-sweep | the removed view is not delivered to | HR-42 |

### AC-8 — Minor batch: controls/containers, TV fidelity (Phases 8–9)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-8.a | bracketed-paste two-line text (with `\t`) into an `Input` | bound `Signal<string>` contains no control chars (`\t\r\n`→space) | HR-43 / `tinputli.cpp:430-431` |
| ST-8.b | Alt+hotkey while the `CheckGroup` is **not** focused (another dialog control is) | the item selects+presses and the cluster takes focus | HR-44 / `tcluster.cpp:257-284` |
| ST-8.c | `picture('@@--')`, value `"a"`, caret 0, type `b` | caret ends at 1 (after the typed char) | HR-45 (reproduced) |
| ST-8.d | mouse-down on a neighbor view, drag across a focused `Input` | the Input's selection/caret unchanged | HR-46 |
| ST-8.e | `picture('(###)###-####')` on `"(12"`; Backspace the `(` | the delete is rejected/reverted (validator consulted) | HR-47 / `tinputli.cpp:380-413` |
| ST-8.f | Ctrl+Backspace mid-word | deletes to the previous word boundary | HR-48 / `tinputli.cpp:389-397` |
| ST-8.g | disabled `Button` and `Cluster` rows containing `~hot~` runs | hot run rendered in the disabled role (both bytes) | HR-52 / `tbutton.cpp:107-108` |
| ST-8.h | click cell 5 → type → click cell 5 again | no select-all (double-click window reset by the edit) | HR-54 |
| ST-8.i | click a Button at `local.x === 0`; then at `local.x === 1` | col 0 inert; col 1 activates | HR-56 / `tbutton.cpp:177-180` |
| ST-8.j | `Text` with `"a  b"` (double space) and leading indentation | rendered verbatim (`"a  b"`, indent kept) | HR-57 / `tstatict.cpp:44-105` |
| ST-8.k | type into a `picture` field where the **filled** length would exceed `maxLength` | insertion clamps at `maxLength` and accepts what fits | HR-58 / `tinputli.cpp:282-288` |
| ST-8.l | write a shorter external value while a selection points past it | `selStart`/`selEnd`/`anchor` all clamped | HR-59 |
| ST-8.m | `MultiCheckGroup.press` with bound state `-3` | state normalizes into range (floored modulo) | HR-60 |
| ST-8.n | mouse-down mid-track on a `ScrollBar`, then drag | thumb jumps to the clicked position and follows the drag | HR-49 / `tscrlbar.cpp:181-208` |
| ST-8.o | focus a `ListBox`, then focus away | the focused row keeps the `listSelected` highlight | HR-50 / `tlstview.cpp:208-211` |
| ST-8.p | empty list draw | `<empty>` at column 1 | HR-51 / `tlstview.cpp:147-148` |
| ST-8.q | list of height `h`; inspect the owned bar's page step | `pgStep === h - 1` | HR-53 / `tlstview.cpp:48-52` |
| ST-8.r | `Scroller` with both bars | SE corner cell blank/bar-colored, never content | HR-61 |
| ST-8.s | click below the last row of a non-empty list | the last item is focused/selected | HR-62 / `tlstview.cpp:185-195` |

*(HR-55 is docs-only — JSDoc correction, no oracle.)*

### AC-9 / AC-10 — Gate & showcase (every phase + Phase 10)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-9 | per-phase: `yarn verify` + `test:e2e` + `check:deps` + `lint` + `gate` | all green; files ≤ 500 lines; JSDoc complete | AC-9 |
| ST-10 | `kitchen-sink.smoke` (mount-only; uses `env:{}`, so it does **not** assert glyphs — PF-006) + the demo golden post-override-removal resolved with an explicit UTF-8 locale (PF-002) | smoke green; box-drawing (not ASCII) in the locale-supplied demo golden | AC-10 |

> **⚠️ AUTHORING RULE:** expectations above come from RD-13/PA-N decisions/TV cites — never from
> reading the implementation. Fidelity oracles (ST-4.b, ST-8.*) additionally defer to the GATE-1
> decode: if the decode contradicts a row, the row is corrected against the `.cpp` **before** the
> RED run, with the cite recorded.

## Test Categories

### Specification test files (written BEFORE each phase's implementation)

| Test File | ST Cases | Component |
|-----------|----------|-----------|
| `packages/core/test/input-hardening.spec.test.ts` | ST-1.x(+fuzz), ST-2.1, ST-5.b,h,i,j | 03-01 |
| `packages/core/test/render-hardening.spec.test.ts` | ST-2.2, ST-5.c–g,k | 03-02 |
| `packages/core/test/safety-hardening.spec.test.ts` | ST-2.3, ST-5.a,l | 03-03 (logger/host/branding) |
| `packages/core/test/capability-hardening.spec.test.ts` | ST-2.4 | 03-03 (HR-07) |
| `packages/ui/test/reactive.hardening.spec.test.ts` | ST-1.z, ST-1.z2, ST-3.d, ST-6.a–c | 03-04 |
| `packages/ui/test/view.hardening.spec.test.ts` | ST-3.c, ST-6.d–h | 03-05 |
| `packages/ui/test/event.hardening.spec.test.ts` | ST-1.y(+prop), ST-3.a–b, ST-7.d–e,h | 03-06 |
| `packages/ui/test/app-shell.hardening.spec.test.ts` | ST-3.e, ST-4.a–b, ST-7.a–c,f–g | 03-07 |
| `packages/ui/test/controls.hardening.spec.test.ts` | ST-8.a–m | 03-08 |
| `packages/ui/test/containers.hardening.spec.test.ts` | ST-8.n–s | 03-09 |

Naming follows each package's existing convention (core hyphenated, ui dotted). Files exceeding
~300 lines split by concern at execution time (e.g. `controls.hardening-input.spec.test.ts`).
**Existing** spec files are edited only under two narrow carve-outs, each cited in the commit:
(1) the **fidelity exception** (TV-derived oracle corrections against the `.cpp`, AC-8); and
(2) a **renamed-contract update** — a spec oracle that asserts a value the plan deliberately renames
is updated to the new value (PF-005). The only case here is HR-26/PA-4: `safety-logger.spec.test.ts`
ST-19/ST-20 assert `BLENDTUI_DEBUG`; they are updated to `JSVISION_DEBUG`, cited to PA-4. This is a
contract rename, not a weakening of the oracle.

### Implementation tests (AFTER each phase's implementation)

One `*-hardening.impl.test.ts` sibling per spec file above, covering the per-component-doc
"Testing Requirements → Impl tests" bullets (resync positions, chunk permutations, fd permutations,
mid-flush edges, clamp/word-boundary edges, precedence matrices).

### Integration / E2E

| Test | Components | Description |
|------|-----------|-------------|
| existing `host-tier3.e2e` + demo e2e suites | host, demos | must stay green each phase (AC-9) |
| demo golden (HR-07) | capability→render | one demo's frame keeps box chars with no manual glyph caps (AC-2/AC-10) |
| `kitchen-sink.smoke` | all stories | headless mount stays green (AC-10) |

## Test Data / Fixtures

- Hostile-UTF-8 byte vectors + a seeded fuzz corpus (extends the existing `input-fuzz` seed model).
- A fake `RuntimeAdapter` with configurable `{dev,ino}` per fd (extends the existing safety fakes).
- Unicode EAW sample table for ST-5.e (mirrors the generated WIDE ranges' source data).
- No new mocks — real objects throughout, per the project standard (only the runtime adapter fake,
  which is the established host-test seam).

## Verification Checklist

- [ ] All ST cases defined with concrete input/output (above) and per-HR traceability
- [ ] Spec tests written BEFORE implementation, verified RED (the critical trio **must** reproduce)
- [ ] GREEN after implementation; fidelity oracles re-diffed at GATE-2
- [ ] Impl tests per component doc
- [ ] `yarn verify` + `test:e2e` + `check:deps` + `lint` + `gate` green per phase (ST-9)
- [ ] Kitchen-sink smoke + demo goldens green (ST-10)
