# jsvision

> Canonical project guidance for Codex and other engineering agents. Refresh
> project analysis with the CodeOps `analyze-project` skill while preserving
> hand-authored sections.

<!-- analyze-project: refreshed 2026-07-16 — merged the datagrid + forms branches; Overview/Toolchain/Project-structure list both @jsvision/datagrid and @jsvision/forms. Hand-authored Prime-directive/Conventions/Git/Documentation/TV-fidelity/Kitchen-sink/Special-rules preserved verbatim. -->
<!-- targeted refresh 2026-07-17 — datagrid RD-09 (footer aggregation + master-detail) shipped: Project-structure datagrid/ line now lists the footer band, reactive readouts, and editable master-detail. ui gained a backward-compat Text/Button measure() (flow self-sizing). Hand-authored sections preserved verbatim. -->

## Prime directive (NON-NEGOTIABLE)

> **Before the final `git push` that opens or updates a pull request, always run `yarn lint:fix`.**
> Auto-fix every lint and format violation on the branch locally, then stage and commit whatever it
> changes, so the PR lands green. CI must never be the first place a fixable lint/format error
> surfaces. No PR-bound push goes out until `yarn lint:fix` has run and the working tree is clean.

## Overview

- **Type:** monorepo (library SDK) — published `@jsvision/core`, `@jsvision/ui` (widgets), `@jsvision/files`, `@jsvision/datagrid` (editable enterprise data grid on `ui`), `@jsvision/forms` (headless form store + Zod validation + opt-in async validation); **internal (not published)** `@jsvision/web` (browser runtime), the `@jsvision/theme-designer` app, `@jsvision/examples`, and `@jsvision/docs-site`.
- **Description:** SDK for building Turbo Vision-style terminal (TUI) apps in TypeScript. `@jsvision/core` is the zero-dependency **foundation engine** behind one public entry point (`src/engine/index.ts`): capability detection, input decoding, a width-correct damage-diff renderer, a native-tty host with guaranteed restore on every exit path, a safety/essentials layer, and depth-aware color + theming. `@jsvision/ui` is the Turbo Vision-style **widget framework** on core (reactive core · layout engine · view/group spine · event loop · app shell · the full widget set). `@jsvision/web` runs any app in xterm.js with no backend — it is an **internal** package, consumed only inside this repo (docs-site live examples, the browser dogfood) and deliberately not published. Dev-only harnesses (capability probe, the kitchen-sink showcase, docs-site live examples) and a four-tier test strategy with a go/no-go gate (`yarn gate`) round it out.

## Toolchain

- **Repo shape:** **yarn 1.x + Turborepo monorepo** (`packages/*` workspaces). Published: `@jsvision/core` (zero runtime deps), `@jsvision/ui` (widget framework), `@jsvision/files`, `@jsvision/datagrid` (editable data grid on `ui`), `@jsvision/forms` (headless form store + Zod validation + opt-in async validation; `zod` peer dep). Internal — `"private": true`, npm skips them and they are **not** part of the public API surface: `@jsvision/web` (browser runtime; no release planned for now), `@jsvision/theme-designer` (app), `@jsvision/docs-site` (VitePress site — joins `yarn verify`'s test+typecheck; its build is isolated via the `vp:build` script name), `@jsvision/examples` (demos + probe). Published packages share one lockstep version (`yarn sync-package-versions`; root `package.json#version` is the source of truth).
- **Language(s):** TypeScript (ESM-only, `module`/`moduleResolution` NodeNext, `strict`); shared `tsconfig.base.json`, per-package `tsconfig.json`
- **Framework(s):** none — Node built-ins + zero runtime dependencies
- **Package manager:** **yarn 1.x** (`yarn.lock`, workspaces `packages/*`)
- **Orchestration:** **Turborepo** (`turbo.json`: `build`/`typecheck`/`test`/`test:e2e`/`check:deps`; `test` dependsOn `build`, `typecheck` dependsOn `^build`)
- **Test framework:** **vitest** (two projects: `unit` = `*.{spec,impl}.test.ts`, `e2e` = `*.e2e.test.ts` single-fork). Vite resolves NodeNext `.js`→`.ts` natively.
- **Lint/format:** root-global ESLint flat config (`typescript-eslint`) + Prettier
- **Node:** LTS **22 / 24** (`engines.node >= 22`)

## Commands

> All commands run from the monorepo root and fan out via turbo unless noted.

- **Verify (run before every commit):** `yarn verify` (= `yarn lint` then `turbo run typecheck build test check:docs`)
- **Build:** `yarn build` · **Typecheck:** `yarn typecheck` · **Test (unit):** `yarn test`
- **Test (e2e):** `yarn test:e2e` (or per package, e.g. `yarn workspace @jsvision/core test:e2e`)
- **Run the theme designer (dev):** `yarn designer` (live on a TTY; piped → headless walkthrough)
- **Run the probe harness (dev):** `yarn workspace @jsvision/examples probe` (`--auto`/`--out`/`--no-matrix`)
- **Docs website (dev):** `yarn docs:dev` · **API reference:** `yarn docs:api` (TypeDoc → gitignored `api/`) · **build:** `yarn docs:build` · **validate:** `node packages/docs-site/scripts/check-docs-build.mjs` (20-check gate)
- **Runnable demos (dev):** `yarn workspace @jsvision/examples <demo>` — `demo:kitchen` (the kitchen-sink showcase) plus per-subsystem walkthroughs `demo:{controls,containers,tree,table,tabs,feedback,date,color,surface,themes,shell,events,view,layout,reactive}` and real-TTY `demo:{controls-live,resize,playground}`
- **Acceptance gate (go/no-go):** `yarn gate` (`scripts/gate.mjs` — verify + core e2e + probe --auto; map in `docs/acceptance-gate.md`)
- **Performance bench (informational):** `yarn bench` (never gates; 35 ms shared-runner budget asserted off-CI, skipped under `CI`/`TUI_SKIP_PERF`)
- **Version sync (lockstep):** `yarn sync-package-versions` · `yarn sync-package-versions --check`
- **Lint:** `yarn lint` · **Fix:** `yarn lint:fix`
- **Dependency policy:** `yarn check:deps` (fails on any native runtime dependency)
- **JSDoc governance:** `yarn check:docs` (`scripts/check-jsdoc.mjs`; bans CodeOps/TV-C++ refs, requires `@example` on public exports) — part of `yarn verify`
- **Plugin self-sync:** `yarn plugin:sync --fix` (re-sync drifted recipe snippets, no AI) · `--detect` (JSON drift) · no-flag also drafts catalog entries via the Anthropic API (needs `ANTHROPIC_API_KEY`); outputs are verify-gated + left unstaged
- **Clean:** `rm -rf packages/*/dist .turbo`

## Project structure

```
packages/core/     Published @jsvision/core — the zero-dep TUI foundation engine (capability · input · width-correct damage renderer · native-tty host · safety · depth-aware color/theming) behind one entry src/engine/index.ts; holds bench/ + the four-tier test suite (test/).
packages/ui/       @jsvision/ui — the Turbo Vision-style widget framework on core (reactive core · layout · view/group spine · event loop · app shell · full widget set: controls, scroll/list/dialog, table, tabs, feedback, date, color, surface, tree, editor, dropdown, terminal). Single entry src/index.ts (re-exports subsystems + 7 core essentials). Private until release.
packages/web/      @jsvision/web — browser runtime: xterm.js host + buildBrowserCaps + mountApp + in-memory virtual FS + key-reclaim + outbound clipboard; no backend. Single barrel src/index.ts. Internal, not published — never imports xterm itself: the caller injects any object satisfying the structural TerminalLike (real @xterm/xterm or @xterm/headless), so web declares no xterm dependency of any kind.
packages/files/    @jsvision/files — Turbo Vision file-system dialog family (FileDialog/ChDirDialog + FileList/DirList/FileInput/FileInfoPane + openFile/errorBox) on ui; all path work via an injected FileSystem seam.
packages/datagrid/ @jsvision/datagrid — editable, enterprise-class data grid on ui: typed column model + GridDataSource, pure sort/filter/aggregate models, SortHeader (sort + funnel), virtual-scroll editable body + typed cell editors, filter/value-list popups + a filterPopup customization seam, a sticky column-aligned footer band (reactive aggregates + free-form widget row + "(loaded)" honesty labelling via an optional source.complete?()), reactive readouts (displayedRows/focusedRow/focusedKey), and editable master-detail (fromReactiveRows write-through source + masterDetail link); single barrel src/index.ts; kitchen-sink stories under test/. Private until release.
packages/forms/    @jsvision/forms — headless forms engine on ui: createForm store, one memoized Zod safeParse driving isValid/values/errors, widget binding (direct Input/Switch bind · bindField touched-on-first-blur · bindRadio/bindCheck domain-value lenses), and opt-in per-field async validation (asyncValidators map beside the sync parse: debounced + generation stale-guard + AbortSignal, distinct validating()/asyncError(), async-aware submit(), idempotent form.dispose()). zod is a peer dep; core/ui stay zero-dep.
packages/theme-designer/  @jsvision/theme-designer — standalone TUI app to author @jsvision/core themes (pure headless model + panels; tsx start, no build).
packages/examples/ @jsvision/examples — capability-probe harness + resize/playground + per-subsystem walkthroughs + the kitchen-sink showcase (demo:kitchen, Storybook-for-TUI) + the web-xterm browser dogfood; imports the packages by name.
packages/docs-site/  @jsvision/docs-site — VitePress docs + showcase site (dev-only, never shipped): the live-example system (Play → xterm via mountApp), a strict per-build meta-CSP, and the generated TypeDoc API reference (yarn docs:api). In verify's test+typecheck; build isolated via vp:build.
codeops/           CodeOps nested layout (marker .codeops.yml) — portfolio 00-roadmap.md + features/<slug>/ (00-roadmap + requirements/ + plans/<plan>/); _archive/ holds completed feature-sets.
docs/              Monorepo docs (root) — now only acceptance-gate.md, the load-bearing gate oracle for gate.spec + gate.mjs (do not move it).
scripts/           Root scripts — check-no-native-deps.mjs (dep-policy guard), gate.mjs (go/no-go aggregator), sync-package-versions.mjs (lockstep version sync).
.github/workflows/ ci.yml (3 OS × Node 20/22/24 → turbo verify + e2e + check:deps + audit + pack) · docs.yml (GitHub Pages deploy + per-PR previews).
_archive/          Archived Ink/React prototype — reference only, not built (distinct from codeops/_archive/).
Shared config: tsconfig.base.json · turbo.json · per-package vitest.config.ts (unit + e2e). Tests live in each package's test/: *.spec.test.ts (immutable spec oracle) · *.impl.test.ts (internals/edges) · *.e2e.test.ts (e2e project); core imports ../src/engine/…, other packages import @jsvision/* by name.
```

<!-- analyze-project: refreshed 2026-07-15 — compacted Project structure to one line per package/top-level dir; collapsed stacked refresh comments to this single entry; folded the @jsvision/forms widget-binding surface (bindField/bindRadio/bindCheck). Hand-authored Prime directive/Conventions/Git/Documentation/TV-fidelity/Kitchen-sink/Special rules preserved verbatim. -->

## Conventions

- **ESM-only**, zero runtime dependencies (pure-JS only; the `check:deps` guard enforces no native deps).
- **Foundation-first layering** with a single public entry point (`src/engine/index.ts`); every later RD adds modules under `src/engine/**` and re-exports public symbols there. Target 200–500 lines per file.
- **NodeNext import specifiers** use the `.js` extension even for `.ts` sources (e.g. `from './version.js'`).
- **Tests in `test/` only** — do not colocate tests with source.
- Public/exported symbols carry JSDoc (purpose, params, returns, side effects).
- **Grounded Options & Recommendations** — follow the always-on directive in the coding standards: filter out non-viable options (no strawmen), second-guess each, ground any code-modifying option in the real code, and lead with a recommendation and its reason; match ceremony to stakes.

## Git conventions

- **Commit scope:** the area touched — `scaffold`, `package`, `toolchain`, `packaging`, `tests`, `docs`, or the engine subsystem name in later RDs.
- **Main branch:** `master` • **Remote:** `origin` → `git@github.com:blendsdk/jsvision.git`. Publish (with provenance) is still deferred to a later milestone.
- **Pre-push lint (NON-NEGOTIABLE).** Run `yarn lint:fix` before the final `git push` that creates or
  updates a PR, then commit any files it changed. This applies auto-fixable lint/format issues locally
  so the PR does not break CI. See the [Prime directive](#prime-directive-non-negotiable) above.

## Documentation for users & AI agents (NON-NEGOTIABLE)

> Every JSDoc comment on a public or exported symbol is written for the people and agents that
> **use** this framework — never for its maintainers. The doc a consumer (or an AI agent) reads on
> hover **is** the API contract. **Decode-the-code archaeology, plan/requirement IDs, and internal
> process notes never appear in shipped code.** Canonical worklist + guard: `JSDOC-CLEANUP-PLAN.md`.

- **Audience.** Public JSDoc explains, to someone who has never seen the source, _what a symbol is,
  what it does, how to use it, and what to watch out for_. AI agents feed directly on these docs and
  their `@example`s — treat every example as executable spec: realistic, correct, copy-pasteable.

- **BANNED in all shipped code (`packages/*/src`), in JSDoc _and_ code comments:**
  - CodeOps process IDs — `RD-`, `PA-`, `AR-`, `PF-`, `HR-`, `GATE-`, `AC-`, `ST-`, `ADR-`, `DEF-`,
    `FR-`, `RT-`, `PL-`, and any `codeops/…`, `plans/…`, `requirements/…` path. These reference files
    that are being removed; a reference to a deleted file is worse than no reference.
  - Turbo Vision / C++ provenance — `t*.cpp`/`*.h` citations, `getColor(N)` palette-chain
    archaeology, "faithful to `TButton::draw`" notes. Fidelity is a **build-time** discipline (see
    the TV porting guideline below), not a shipped-code artifact; the SDK will diverge from TV over
    time and these notes will only mislead.
  - This is a **semantic rewrite, not a delete**: keep the _behavior_ an ID annotated ("enabled by
    default"), drop the _code_ ("(PA-3)").

- **REQUIRED on every public / exported symbol** (anything re-exported from a package `index.ts`):
  1. A lead sentence stating what it is / does, in plain language.
  2. The behaviors, constraints, and gotchas a caller must know (ordering rules, reactive-vs-
     imperative seams, footguns such as a missing `measure()` collapsing a view to `{0,0}`).
  3. `@param` / `@returns` for every parameter and return value.
  4. An **`@example`** with real, copy-pasteable usage. Examples are for AI consumption first — make
     them correct enough to paste and run.

- **Code comments — comment _why_, not _what_, and proactively explain anything above a junior
  developer's level.** Non-obvious algorithms, invariants, subtle ordering/lifecycle dependencies,
  and "why it is done this way" decisions get a short comment so a junior can follow the code.
  Trivial lines get nothing. No maintainer traceability — a note useful only to a maintainer belongs
  in the commit message, not the code.

- **Enforcement.** `scripts/check-jsdoc.mjs` (wired into `yarn verify` + CI) fails on any banned
  reference and on any public export missing an `@example`. Guard-first: it is the objective
  done-criterion for the cleanup and the regression gate afterward. The build is not green while it
  fails.

- **Scope.** Shipped source only (`packages/*/src`). Out of scope: this `AGENTS.md`, `codeops/`, and
  test files (their own conventions). Example/demo code (`packages/examples/`) follows the spirit —
  it is already user-facing and is itself agent-training material.

- **Plan-flow enforcement (make-plan / exec-plan).** A component is NOT `[x]` done until its public
  JSDoc carries an `@example`, its above-junior logic is commented, and `check-jsdoc.mjs` passes for
  its files.

## Turbo Vision fidelity (porting guideline)

> When you port a component that **already exists** in Borland Turbo Vision, decode the original
> first and match its geometry, glyphs, sizing, layout, hit-zones, and colors — don't reimagine a
> shape TV already defined. This is a **build-time discipline for faithful ports only**. It is _not_
> a shipped-code contract: per the documentation directive above, **no TV/C++ provenance is recorded
> in JSDoc or code comments.** New components, and any deliberate divergence from TV, carry no
> fidelity obligation.

- **Source of truth (for the decode, at porting time):** the original Turbo Vision (magiblot/tvision)
  checked out at `/home/gevik/workdir/github/tvision` — `source/tvision/t*.cpp` (drawing/sizing),
  `source/tvision/tvtext1.cpp` (the `frameChars`/glyph tables + `cpAppColor`), `include/tvision/*.h`
  - `include/tvision/app.h`/`dialogs.h` (geometry + the `cpX` palette definitions).

- **DECODE BEFORE (when porting an existing TV component).** Open the original class (e.g.
  `TMenuBox`, `TFrame`, `TButton`, `TInputLine`, `TScrollBar`, `TWindow`, `TDialog`) and decode:
  1. Its `draw()` + sizing (`getRect`/`sizeLimits`/`getItemRect`) — the exact column math, frame/gutter
     insets, padding, fill characters, `markers`/`shadows`/`specialChars`, and hit-zones.
  2. **Every color via the full `getColor(N)` palette chain** — resolve `N` through the view's local
     palette (`cpButton`/`cpInputLine`/…) → owner palette (`cpGrayDialog`/…) → `cpAppColor` → the
     attribute byte `0xHL` (high nibble = bg, low nibble = fg). Color indirection — not glyphs — is
     where fidelity silently breaks (a `TButton` shadow shipped wrong once because `getColor(8)` was
     guessed as "darkGray/black" instead of decoded to `0x70` black-on-lightGray).
  3. Watch for **mode-gated features** the color path enables/disables — e.g. `showMarkers` (the
     `[ ]` brackets) is monochrome-only; on a color palette a `TButton` has **no** brackets.
     Convert CP437 byte glyphs to Unicode (mind East-Asian ambiguous width — prefer unambiguous-narrow
     code points).

- **DIFF AFTER.** Re-open the same `.cpp` and **diff the rendered output against the decode**, cell by
  cell: glyphs, column math, hit-zones, and every resolved color. If they disagree, the code is wrong
  — fix it against the source. **The decode is a working step, not shipped-code content** — it is not
  written into JSDoc or code comments (per the documentation directive above). If an audit trail is
  wanted, put the decode in the commit message.

- **The C++ source outranks a spec test (TV-derived components only).** A `*.spec.test.ts` can encode
  a _mis-decode_ (a button oracle once asserted phantom `[ ]` brackets). So for a TV-derived
  component, if a spec oracle disagrees with a faithful C++ decode, **the spec test is the defect**:
  fix it against the source (a deliberate, narrow exception to "spec tests are immutable", scoped to
  fidelity oracles).

- **No invention for ports.** If the original is unclear or a detail isn't covered, surface it and
  ask — never substitute your own design for theirs. This governs **drawing/geometry/color** for
  components TV actually had; behavior the original couldn't have (truecolor, reactive binding, async
  modality) freely extends TV, and entirely new components have no TV counterpart to match.

- **Deliberately non-faithful components (geometry may diverge from TV — do NOT "restore fidelity").**
  As a recorded decision (see `codeops/_archive/layout-dsl-adoption/requirements/RD-01`), these
  dialogs are laid out with the layout DSL (flex composition), not TV's hand-computed cell geometry.
  Their **behavior** matches TV (input, focus/tab order, validation, colors, return values); only
  their child **positions** may differ, and that difference is intentional:
  `messageBox` / `confirm` / `inputBox`, editor `findDialog` / `replaceDialog` / `confirmBox`,
  `errorBox`, `FileDialog`, `ChDirDialog`, `formDialog`. Do not "port back" their rects to match TV.

## Kitchen-sink showcase (NON-NEGOTIABLE)

> Every user-facing component and capability MUST ship with a live demo ("story") in the
> **kitchen-sink showcase** (`packages/examples/kitchen-sink/`, run `yarn workspace @jsvision/examples
demo:kitchen`) — a Storybook-for-TUI that is our live selling point. **A component is not "done"
> until its story exists and passes the headless smoke test.** As we implement, the showcase grows
> with us. Canonical gate + plan checklist: [`codeops/kitchen-sink-gate.md`](codeops/kitchen-sink-gate.md).

- **The story contract (extensibility).** Adding a component to the showcase = add ONE
  `kitchen-sink/stories/<x>.story.ts` exporting a `Story` (`{ id, category, title, blurb, rd?,
build(ctx) }`) + one line in `stories/index.ts`. `build(ctx)` returns a `Group` of
  absolutely-positioned children within `ctx.width × ctx.height`; the shell owns all chrome
  (menu / status / grey canvas / navigation). A story never touches the desktop or host.
- **UX is a feature — it is the selling point.** Each story gets a one-line blurb, the live
  component, a visible bound-state echo where relevant, and interaction hints. Keep it polished: no
  clipped text, faithful TV colors, and both keyboard + mouse working.
- **Smoke test is mandatory.** Every story must pass `test/kitchen-sink.smoke.spec.test.ts` (mounts
  headlessly, paints something, unique id, required metadata) — the mechanical "the story exists and
  renders" check, no TTY needed.
- **Dogfooding / Navigator seam.** Navigation is menu-driven today (existing TV primitives, zero
  throwaway); when RD-11 lands `ListView`/`ScrollBar` the navigator upgrades to a persistent sidebar
  built from the very component it demos. Only `kitchen-sink/shell.ts` changes; stories stay untouched.
- **Plan-flow enforcement (make-plan / exec-plan).** For every user-facing component:
  - **make-plan** MUST add a story task to `99-execution-plan.md`: `[ ] Kitchen-sink story for <X>
(+ smoke test)`.
  - **exec-plan** MUST NOT mark the component `[x]` until its story is registered and the smoke test
    passes.
- **Scope.** Every _visual_ component MUST get a story; non-visual capabilities (reactivity,
  capability detection, color downsampling) get one when it is meaningful to show.

## Special rules

- **Spec-first task ordering** (CodeOps): spec tests → red → implement → green → impl tests → verify. A `*.spec.test.ts` is an immutable oracle — if it fails after implementation, fix the code, not the test.
- `npm audit` is **not** wired into `verify` (it runs in CI and is locally runnable) so audit advisories don't block local typecheck/test loops.
- Prettier is scoped to code: `codeops/` is in `.prettierignore` (CodeOps process docs, not code).

<!-- CODEOPS-ROUTING:START -->

## CodeOps routing and quality

- Tag each plan task `trivial`, `standard`, `complex`, or `sensitive`; default to `standard` only when evidence does not justify a higher risk.
- Core engine work is sensitive: input decoding, damage-diff rendering, width/capability probing, colour downsampling, layout solving, Turbo Vision fidelity ports, and async/stale-guard logic.
- Widget composition, kitchen-sink stories, demos, documentation, JSDoc, and fixtures are normally trivial or standard unless their actual risk says otherwise.
- Route by capability and risk, never by checked-in model names. Complex or sensitive phases require high-effort execution and independent correctness review. Add security, performance, concurrency, migration, or semantic reviewers when the plan tags require them.
- The structured policy in `codeops/codeops.json` is authoritative for CodeOps mode, review, routing, and metrics. Missing optional agents never weaken a gate.

<!-- CODEOPS-ROUTING:END -->
