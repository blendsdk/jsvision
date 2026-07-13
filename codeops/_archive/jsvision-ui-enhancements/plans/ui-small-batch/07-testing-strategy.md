# 07 — Testing Strategy

> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.3.2

Spec-first: each `ST-*` is an immutable oracle derived from the issue requirements + [AR](00-ambiguity-register.md),
written and made to fail (RED) before implementation. `*.impl.test.ts` covers internals/edges after GREEN.
All tests under `packages/ui/test/`. Verify: `yarn verify`.

## R1 — Tree markers (new `tree-markers.spec` file; `tree-graph.spec` + `fidelity.tree.spec` `'tv'` oracles unchanged)

| ST | Input | Expected |
|----|-------|----------|
| ST-1 | `createGraph(level, lines, flags)` with no `style` arg | Byte-identical to today (`'tv'` default): collapsed marker `+`, expanded/leaf `─`. |
| ST-2 | `style='brackets'`, collapsed-with-children | end graphic ends `[+]`; expanded ends `[-]`. |
| ST-3 | `style='brackets'`, leaf | marker column = 3 spaces (blank), alignment preserved. |
| ST-4 | `style='triangle'`, collapsed / expanded | `▸` / `▾`; leaf = single space. |
| ST-5 | `graphWidth(level, 'brackets')` vs `('tv')`/`('triangle')` | `level*3+5` for brackets; `level*3+3` for tv/triangle. |
| ST-6 | Mouse click within `graphWidth(level, 'brackets')` on a collapsed node | Toggles expand (hit-zone tracks the wider graphic). |
| ST-7 | `markerStyle:'triangle'` under a no-Unicode caps profile | Renders as `brackets` (`[+]`/`[-]`), not `▸`/`▾`. |
| ST-8 | `Tree` with `markerStyle:'brackets'` composed to a buffer | Rows show `[+]`/`[-]`; connectors + indentation correct. |

## R2 — Duplicate accelerators (`accelerators.spec`, `menu`/`dialog`/`tabs` specs)

| ST | Input | Expected |
|----|-------|----------|
| ST-9 | `findDuplicateAccelerators([])` / no dup (`['f','e','o']`) | `[]`. |
| ST-10 | `['x','','x']` | `[{ char:'x', indices:[0,2] }]`. |
| ST-11 | `['X','x']` (mixed case) | one group `char:'x'`, `indices:[0,1]` (case-insensitive). |
| ST-12 | `['x','x','x']` | one group, `indices:[0,1,2]`. |
| ST-13 | inputs with `''` (separators / no-hotkey) | `''` never grouped. |
| ST-14 | `subMenu('File',[item('E~x~it',…), separator(), item('E~x~port',…)])` built, `NODE_ENV!=='production'` | exactly one `devWarn` naming `'x'` + both labels. |
| ST-15 | same construction, `NODE_ENV='production'` | no warning (silent). |
| ST-16 | menu bar `~F~ile` + submenu `~F~oo` (char reused across scopes) | no warning (cross-scope reuse ok). |
| ST-17 | `Dialog` mounting two `Button`s `'~O~K'` + `'~O~ops'` | one `devWarn` on mount naming `'o'`. |
| ST-18 | `TabView` with tabs `~A~lpha` + `~A~lter` | one `devWarn` on mount naming `'a'` (data-level check over `tabs()`; strip tabs only — a page-content accelerator sharing the char does **not** warn). |

## R3 — Switch (`switch.spec`)

| ST | Input | Expected |
|----|-------|----------|
| ST-19 | `new Switch({ value: signal(false) })`, press `Space` | `value()` becomes `true`; second press → `false`. |
| ST-20 | click on the control | focus + toggle. |
| ST-21 | on-state draw | track painted green (`button`/`buttonFocused`), knob at right (`[   ●]`). |
| ST-22 | off-state draw | dim track, knob at left (`[●   ]`). |
| ST-23 | no-Unicode caps | knob renders `o` (`[o   ]`/`[   o]`). |
| ST-24 | `label:'~A~irplane'`, `Alt+A` from elsewhere in the dialog | focus + toggle. |
| ST-25 | `disabled:true` | ignores `Space`/click; not focusable; dim. |
| ST-26 | `measure()` | non-zero intrinsic size (width = label+track+text, height 1). |
| ST-27 | kitchen-sink `controls/switch` story | mounts headlessly, paints, unique id + required metadata (smoke). |

## Verification per phase

- **RED** after each phase's spec tests: confirm they fail with no impl.
- **GREEN**: spec tests pass; existing Tree fidelity oracle, menu/dialog/tabs suites, and all golden/a11y
  suites stay green (the `'tv'` path and all non-#6 behavior are byte-unchanged).
- **Impl tests**: edges — bracket geometry at deep levels; validator ordering/dedup; Switch wheel/ignore
  when disabled; caps fallbacks.
- **Final gate**: full `yarn verify` — which already runs `yarn lint` (eslint + prettier) then
  `turbo run typecheck build test check:docs` — plus the kitchen-sink smoke suite.
