# 03-03 — Component: demos / demo-shell conversions + CLAUDE.md carve-out

> **Targets**: `packages/examples/**` (bounded set), `CLAUDE.md` · **Requirements**: R-5, R-6 ·
> **Divergence**: none (didactic idiom adoption)

## R-5 — Demos / demo-shell (bounded per PA-5)

Two mechanical substitutions across the enumerated sites (full list + line numbers in `02-current-state.md`):

**a. Hand-computed centering → `center()`** — `controls-live/main.ts:81-91`:

```ts
// was: dialog.layout.rect = { x: Math.max(0, Math.floor((dw-width)/2)), y: ..., width: Math.min(width,dw), height: ... }
center(dialog, Math.min(width, dw), Math.min(height, dh));
```

Note the current code clamps width/height to the desktop (`Math.min`). Preserve that clamp by passing
the clamped values to `center()`; `center()` handles the origin. The desktop-relative centering is
what `centered = true` + the reflow pass already do — the hand `Math.floor((dw-width)/2)` is exactly
what it recomputes, so the visible result is identical.

**b. Full-viewport / full-interior absolute → `cover()`** — the demo-shell inners
(`kitchen-sink/shell.ts:164,261`, `datagrid-showcase/shell.ts:166,306`) and each walkthrough root
(`color-demo`, `date-demo`, `dropdowns-demo`, `tabs-demo`, `table-demo`, `feedback-demo`, `tree-demo`,
`surface-demo`, `containers-demo`, `files-demo`, `wizard-demo`):

```ts
// was: g.layout = { position:'absolute', rect: { x:0, y:0, width:w, height:h } };
cover(g);
```

Each of these placed a group at the **full** viewport/interior it lives in — the definition of
`cover()`. Where the group is sized to a fixed sub-viewport that equals its parent (the headless demo
viewport), `cover()` is still correct because the parent *is* that viewport. Spot-check any site where
the rect is **smaller** than the parent (a genuine sub-region, not a full cover) and leave it
`absolute` — those are `at()` candidates (Tier 3), not `cover()`. Per the sweep, the enumerated sites
are all full-covers; confirm during implementation before swapping each.

**Scope discipline (PA-5):** convert only the enumerated full-viewport roots + demo-shell inners +
the one `controls-live` dialog. Do **not** touch inner-widget `at()` placements in the same files —
those are Tier 3 (#110/#112).

**Guard:** output-parity e2e (`shell-demo.e2e`, per-demo `*.e2e.test.ts`,
`datagrid-showcase.walkthrough.spec`, `layout-dsl-playground.smoke.spec`) assert output frames, not
rects → they stay green unedited (ST-11). Rebuild `@jsvision/ui` before the examples test loop (the
examples import the built dist).

**Kitchen-sink quality bar (RD-02 NFR-4 / AR-12):** every converted demo-shell story still passes the
headless smoke test AND a recorded manual showcase pass — no clipped text, faithful colors,
keyboard + mouse working. The e2e green is necessary but not sufficient; do the visual pass.

## R-6 — CLAUDE.md carve-out (RD-01 FR-7 / AC-1)

Append a short block to the **"Turbo Vision fidelity (porting guideline)"** section of the project
`CLAUDE.md`, naming exactly the FR-1 deliberately-non-faithful set so a future porter does not
"restore fidelity." Suggested content (adapt wording to the section's voice):

> **Deliberately non-faithful components (geometry may diverge from TV — do NOT "restore fidelity").**
> As a recorded decision (see `codeops/features/layout-dsl-adoption/requirements/RD-01`), the
> following dialogs are laid out with the layout DSL (flex composition), not TV's hand-computed cell
> geometry. Their **behavior** matches TV (input, focus/tab order, validation, colors, return values);
> only their child **positions** may differ, and that difference is intentional:
> `messageBox` / `confirm` / `inputBox`, editor `findDialog` / `replaceDialog` / `confirmBox`,
> `errorBox`, `FileDialog`, `ChDirDialog`, `formDialog`.

**Constraint:** this record lives in `CLAUDE.md`, which is *not* shipped `packages/*/src` — so the
"no `codeops/` references in code" rule does not apply here (CLAUDE.md is process/config and is the
explicitly sanctioned FR-7 record location). Keep the RD reference.

**Validation (ST-12):** a `grep` confirms the block exists and names all nine dialog symbols; this
is non-code-artifact validation, not a code test.
