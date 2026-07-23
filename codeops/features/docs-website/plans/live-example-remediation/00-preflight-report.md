# Preflight Report — Live-Example Remediation

> **Artifact**: `codeops/features/docs-website/plans/live-example-remediation/` (full plan)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2 · **Date**: 2026-07-10 · **Iteration**: 1
> ⚠️ **SAME-SESSION REVIEW** — the plan was authored in this session. Bias counter applied: an
> **independent challenger** (fresh context, no authoring memory) verified every concrete code claim
> against the codebase; findings below cite primary-source `file:line`.
> **Status**: ✅ PASSED — PF-001…PF-004 applied to the plan (1 MAJOR + 1 MINOR + 2 OBSERVATION, all resolved).

## Codebase Context Summary

Verified against the real code (this session's recon + the independent challenger):
- **Window API** (`packages/ui/src/window/window.ts`): `closable`/`zoomable`/`movable` are public,
  mutable fields defaulting `true` (`:99/103/105`); constructor takes only `title?` (`:127`).
  `layout = { position:'absolute', padding:1 }` (`:81`) → an absolute child `{0,0,W,H}` lands at the
  interior `(1,1)` (`layout.ts:96-101,141-149`); interior is exactly `(winW-2)×(winH-2)`. ✔ plan geometry correct.
- **Button** (`controls/button.ts`): `ButtonOptions.command?`/`default?` exist (`:22/25`); activate →
  `ev.emit?.(command)` (`:229`). ✔ 03-03 correct.
- **demo-shell.ts**: `demoApp(ctx,chrome)` `:149`, `demoShell` `:112`, `shellForView(opts,view)` `:163`
  (2-arg today → 1-arg in plan), `wireCommands` `:231`, `buildMenuBar()` `:202` (no-arg today),
  `buildStatusLine(chrome)` `:219`, `placeContent` `:179`, `intendedSize` `:195` all present;
  `menuBar`/`statusLine` set at construction. ✔
- **`ctx.text` clipping** (`view/draw-context.ts:91-122`): drops cells with `absX < clip.x` and wide
  glyphs straddling the right edge; a wide lead at `x=−1` is dropped whole (blank col 0, no orphan).
  ✔ the GridRows H-scroll golden (ST-A2/A3) targets exactly this and should pass **green as written**.
- **mountApp** (`web/mount.ts:101`): `term.onResize(({cols,rows}) => loop.resize(...))`. The web,
  docs-site-controller, and harness `TerminalLike`s all lack `cols/rows` — plan adds them correctly. ✔
- **App/desktop**: `setTheme`/`onCommand`/`desktop.bounds`/`addWindow`/`add`/`loop.resize`/`execView`
  all present with the used shapes. ✔
- **VitePress** `1.6.4`: region-import regex matches `// #region example`; `<<<` (block rule) nests
  inside `::: details` (container block rule). ✔ (static-analysis confidence; task 4.3 build check + fallback retained.)

## Findings

### 🟠 PF-001 (MAJOR) — Test supersession + rename inventory under-specified

The plan changes two APIs that many **existing RD-03 tests** depend on: the demoShell interface
(`content` → `build`/`title`/`kind`) and the registry field (`chrome` → `kind`). One existing
**immutable spec oracle is directly contradicted**, and the rename inventory is incomplete.

- **Contradicted oracle:** `demo-shell.spec.test.ts` **ST-4** (`:62`) asserts *"minimal chrome … no
  menu bar"* and Theme/Depth/About **in the status line** — the exact opposite of the unified shell
  (every example gets a menu bar; those controls move to the menu, #5). ST-4 must be **superseded**
  (the AR-9 precedent: a user-authorized rewrite of a shipped oracle when the requirement changes).
- **Signature-broken tests (compile/red after the change), not enumerated in the plan:**
  `paint-smoke.spec.test.ts:37` (`chrome: entry.chrome`), `demo-shell.spec.test.ts` (ST-4/5/9 at
  `:64/82/95/96`), `demo-shell.impl.test.ts:43,59`, `security.spec.test.ts:34`,
  `play-controller.spec.test.ts` (ST-7 + `fakeEntry('minimal'|'full',…)` at `:31,46,60,76,95,99,115`),
  `registry.spec.test.ts:6` (JSDoc), plus `play-harness.ts` `fakeEntry` (`:38,45`).
- **Resolution (proposed):** (a) add an AR (AR-19) authorizing the ST-4 supersession + the ST-5/ST-9/
  ST-7 rewrite to the unified-shell behaviour; (b) add explicit Phase-2 tasks enumerating every
  affected test file for the `content→build/title/kind` + `chrome→kind` migration; (c) 07 lists ST-4
  supersession alongside the ST-3→AR-9 note.

### 🟡 PF-002 (MINOR) — `PlayExample.vue` does not reference `chrome`

`PlayExample.vue` passes the whole `entry` to `createPlayController` (`:64-87`) and never reads
`chrome`; only `play-controller.ts:134` does. The plan (03-02 §Controller wiring, 99 task 2.2) lists
`PlayExample.vue` for the `chrome→kind` thread — a no-op. **Resolution (proposed):** drop
`PlayExample.vue` from the rename thread; its only real edits are the Phase-1 resize/wheel changes.

### 🔵 PF-003 (OBSERVATION) — Make the Window `padding:1` reliance explicit

The plan's `winRect−2` interior sizing is correct *because* `Window` has `padding:1` (window.ts:81),
which insets absolute children by 1. Worth a one-line note so the executor doesn't double-inset (the
known Dialog padding gotcha), and drop the redundant `win.zoomable = true; win.movable = true`
(already the defaults). **Resolution (proposed):** add the note to 03-02; simplify the field sets.

### 🔵 PF-004 (OBSERVATION) — Record that the GridRows golden is expected green

The challenger confirmed `ctx.text` already clips negative-x + drops straddling wide glyphs, so the
ST-A2/A3 golden should pass **without** a `grid-rows.ts` fix — corroborating that bug #3's browser
garble is downstream of #1/wheel (the manual M4 check is the real gate). **Resolution (proposed):**
note in 03-01/07 that the golden is expected green (regression coverage), and #3's fix is effectively
A1/A2 — so M4 must explicitly re-confirm no garble after Phase 1.

## Verdict

✅ **PASSED** — all four findings applied to the plan:
- **PF-001** → AR-19 added (authorizes the ST-4 supersession + ST-5/9/7 rewrite); 03-02 §Test
  migration enumerates every affected file; 99 Phase-2 tasks 2.1–2.3 made explicit; 07 notes updated.
- **PF-002** → 03-02 + 99 task 2.2 corrected (`PlayExample.vue` is untouched by the rename).
- **PF-003** → 03-02 shellForView notes the `padding:1` inset reliance; redundant field sets dropped.
- **PF-004** → 03-01 + 07 record the golden as expected-green (per `draw-context.ts:91-92`); M4 is
  the real gate for #3.

No CRITICAL findings, no code defects — the plan was code-accurate everywhere else (Window API,
Button, `ctx.text` clip, `mountApp`, App/desktop API, VitePress region all confirmed). Ready for
`exec-plan live-example-remediation`.
