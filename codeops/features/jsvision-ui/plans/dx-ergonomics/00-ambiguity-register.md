## Ambiguity Register: DX Ergonomics Pass (Proposals 2, 3, 4)

> **Status**: ✅ GATE PASSED — all 13 items resolved
> **Last Updated**: 2026-07-08 02:15
> **Source of truth**: `DX-ASSESSMENT.md` (repo root), Proposals 2–4.

| # | Category | Ambiguity / Gap | User Decision | Status |
|---|----------|-----------------|---------------|--------|
| 1 | Scope | Plan structure: one plan vs three; RD-backed vs standalone | **One standalone plan `dx-ergonomics`**, no RD, sourced from `DX-ASSESSMENT.md`; P2/P3/P4 as three phases | ✅ Resolved |
| 2 | Naming | Plan folder slug | **`dx-ergonomics`** | ✅ Resolved |
| 3 | Technical | P2: which option types get `caps: 'auto'` | **`ApplicationOptions` only**; `createApplication` resolves once and threads the concrete profile down. `EventLoopOptions`/`RenderRootOptions` keep required `caps` | ✅ Resolved |
| 4 | Integration | P2: exact re-export set | **The 6 + `resolveCapabilitiesAsync`** → `resolveCapabilities`, `resolveCapabilitiesAsync`, `CapabilityProfile`, `Attr`, `Style`, `createKeymap`, `Keymap` | ✅ Resolved |
| 5 | Behavioral | P3: `onCommand` multiplicity | **Many handlers per command, all fire** | ✅ Resolved |
| 6 | Behavioral | P3: does a fired handler consume the event | **Yes — set `ev.handled = true`** | ✅ Resolved |
| 7 | Integration | P3: where `onCommand` is surfaced | **`loop.onCommand` AND forwarded as `app.onCommand`**; returns an unsubscribe fn | ✅ Resolved |
| 8 | Technical | P3: refactor `QuitCommandSink` vs add alongside | **Generalize — quit becomes an internal `onCommand` registration through one mechanism**; a spec test guards quit (incl. modal cascade) | ✅ Resolved |
| 9 | Technical | P3: dispatch phase of the unified command sink | **preProcess** (preserves quit's early-catch; app commands from menu/status caught reliably). Implication accepted: an `app.onCommand` handler fires before a focused view could handle the same command | ✅ Resolved |
| 10 | Scope | P4: relationship to the editor's existing `infoBox`/`confirmBox`/`replacePrompt` | **Generalize** — build `messageBox`/`confirm`/`inputBox` in `dialog/`; **refactor the editor's `infoBox`/`confirmBox` to delegate** to them (DRY) | ✅ Resolved |
| 11 | Integration | P4: host parameter shape | **A minimal `{loop, desktop}` seam** (the existing `EditorDialogHost` shape); `Application` satisfies it directly, headless-testable | ✅ Resolved |
| 12 | Behavioral | P4: `confirm` button set + default titles | **`confirm` = Yes/No**, `true` on Yes / `false` on No·Esc·close; **`messageBox` requires an explicit `title`**; **`confirm` default title `'Confirm'`** | ✅ Resolved |
| 13 | UX | P4: kitchen-sink story for the modal helpers | **Exempt as non-visual modal capabilities**; prove them in the `tvision-demo` flagship (replacing the raw About ceremony) + unit/e2e tests. No kitchen-sink story | ✅ Resolved |

| 14 | Technical (runtime) | P3: placement (a) as written (`loop.mount` adds the sink to `root.children`) mutates the caller's Group — it broke `@jsvision/files` (`root.children.length===0`) and leaks a hidden child into every consumer's tree | **Loop-internal direct-sweep** — the loop owns the sink but does NOT add it to `root.children`; it delivers command events to the sink inside its private `route()` wrapper, gated on `!modal.isActive()`. No tree mutation, no public seam, behaviorally identical to (a) for command routing (pre-process-first, modal-dormant, quit cascade preserved). | ✅ Resolved |

### Resolution Notes

**AR-1/AR-2:** `make_plan` supports a standalone plan (no `> Implements:`). `00-index.md` cites `DX-ASSESSMENT.md` as the source of truth instead of an RD.

**AR-3/AR-4:** `ApplicationOptions.caps` is required at `packages/ui/src/app/application.ts:25`; `createApplication` passes `opts.caps` to both `createEventLoop` (`:211-219`) and `runApplication` (`:272`), and `run.ts` consumes `ctx.caps` (`:67`) — so `createApplication` resolves caps ONCE (when absent or `'auto'`, via `resolveCapabilities().profile`) and threads the concrete profile to both. The seven re-exports are all in `packages/core/src/engine/index.ts` (`resolveCapabilities`/`resolveCapabilitiesAsync` `:15`, `CapabilityProfile` `:17`, `createKeymap` `:35`, `Keymap` `:48`, `Attr` `:55`, `Style` `:74`). **Value vs type:** `resolveCapabilities`/`resolveCapabilitiesAsync`/`createKeymap` and **`Attr`** are VALUES (`Attr` is `export const Attr = {…}`, `render/types.ts:40`, used by value in custom `draw()`); `CapabilityProfile`/`Keymap`/`Style` are TYPES. `Attr` must be re-exported as a value — see the preflight report (PF-007).

**AR-5..AR-9:** The unified sink generalizes the internal `QuitCommandSink` (`application.ts:82-102`) — a `preProcess`, `visible:false` View that sets `ev.handled = true`. It holds a `Map<command, handler[]>`, fires every handler for a matched command, marks the event handled, and registers quit as one such handler. `onCommand` lives on `EventLoop` and `Application.onCommand` forwards to it; both return an unsubscribe fn. The command registry (`event/commands.ts`) is unchanged (it enqueues; the sink consumes).

**AR-10..AR-12:** `packages/ui/src/editor/dialogs.ts` defines `infoBox` (`:179`, OK, `Promise<void>`), `confirmBox` (`:158`, Yes/No/Cancel), a private `runDialog` (`:49`), and the `EditorDialogHost` seam `{loop:Pick<EventLoop,'execView'>, desktop:Pick<Desktop,'addWindow'|'removeWindow'|'bounds'>}` (`:30-35`). The new general helpers adopt that same host seam; the editor's `infoBox`/`confirmBox` are refactored to delegate (`infoBox`→`messageBox` with `buttons:'ok'`; `confirmBox` keeps its Yes/No/**Cancel** three-button contract, which the general `confirm` (Yes/No boolean) does NOT replace — they coexist, with `confirmBox` retained for the editor's save-prompt semantics). `Application` exposes `readonly desktop` (`application.ts:64`) + `readonly loop` (`:66`).

**AR-13:** Kitchen-sink `Story.build(ctx)` returns an absolutely-positioned `Group` and "never touches the desktop or host" (`codeops/kitchen-sink-gate.md`); a desktop-mounted modal cannot be a story. The gate exempts non-visual capabilities — the flagship `tvision-demo` is the live proof instead.

**Verify command (per task):** `yarn lint` → touched package `yarn workspace <pkg> typecheck` → `yarn verify`.
