# Ambiguity Register: Navigation / Screen Router

> **Status**: ✅ GATE PASSED — all items resolved
> **Last Updated**: 2026-07-15

Basis: GitHub issue **#26** (no source RD — issue-driven). Decisions D1–D6 were pre-resolved in a
`grill_me` session (notes: `../_draft/grill-notes-navigation-router.md`); the four `AR-11…AR-14`
items were surfaced during Phase 1.2 current-state analysis and decided by the user. Items marked ★
are low-stakes recommended defaults, open to revision at preflight. **AR-19 (focus-restore
mechanism) is intentionally left to be finalized by the Phase 0 spike — its _contract tiers_ are
fixed; only the middle-tier resolver is evidence-decided.**

| #  | Category | Ambiguity / Gap | Options | Decision | Status |
|----|----------|-----------------|---------|----------|--------|
| 1  | Scope | Basis for the plan | RD / issue-driven | **GitHub #26; no source RD. grill_me pre-resolved D1–D6.** | ✅ |
| 2  | Architecture | Body slot: how the router becomes the app body (D1) | replace Desktop / separate factory / child-of-desktop | **Generalize `createApplication` with `content?: View`, default `new Desktop()`. Router is a body peer.** | ✅ |
| 3  | API | How a screen declares menu/status chrome (D2·A1) | route bundle / class accessors / imperative | **Route factory returns `{ view, status?, menu? }`; router reads it on activation.** | ✅ |
| 4  | Behavior | Merge semantics of a screen's chrome vs the app bars (D2·A2) | replace-when-present / append-to-base / per-bundle flag | **Replace-when-present; app-level bars are the base fallback; DRY via a `withBase(base, [...])` helper. No ordering rules in the router.** | ✅ |
| 5  | Behavior | Can chrome change while a screen is active (D2·A3) | static set / reactive item-set | **Static set per activation; intra-screen dynamism via command enable/disable (greying, see AR-11) + live `()=>string` labels.** | ✅ |
| 6  | Scope | Router-hosted windows / multi-Desktop (D3) | v1 / deferred | **Deferred to GH #88. v1 = plain full-screen screens only; body slot + keep-alive designed not to foreclose it.** | ✅ |
| 7  | Behavior | Retention on navigate-away (D4a) | dispose default / warm default / global+override | **Dispose-on-navigate-away by default; opt-in `keepAlive: true` per route (warm = mounted-hidden).** | ✅ |
| 8  | API | Route param typing (D4b) | typed generic map / loose bag / Zod schema | **Per-route typed via generic `createRouter<Routes>`. Zod REJECTED (zero-runtime-dep constraint on `@jsvision/ui`).** | ✅ |
| 9  | API | Deep-link / location surface (D5) | structured-now / string-first | **Ship reactive `location() → {name,params}` now; per-route `serialize`/`parse` codec designed now; `restore()` + URL sync deferred to GH #19.** | ✅ |
| 10 | Architecture | Window-command gating for router apps (D6) | auto-gate on content / explicit flag / always-register no-op | **Auto-gate: window cmds + `app.desktop` only when content is omitted or `instanceof Desktop`; else off + `app.desktop === undefined`. `Application.desktop` widens to `Desktop \| undefined` (additive).** | ✅ |
| 11 | Behavior | Greying is not reactive: `enable(name,on)` triggers no repaint (`event/commands.ts:60-62`) | registry bumps a signal / manual invalidate / label workaround | **Command registry bumps a version signal on enable/disable; `StatusLine` + `MenuBar` bind to it and repaint on any change. Additive; benefits the whole shell.** | ✅ |
| 12 | Behavior | `back()` when the back-stack is empty (root only) | no-op / emit quit / throw | **No-op (return false); app decides root-back policy via `canGoBack()`.** | ✅ |
| 13 | Error handling | A route's `build(ctx)` factory throws | isolate+log+abort / propagate | **Catch, report via the app logger seam, abort the navigation (current screen stays). Mirrors the render root's draw-error isolation.** | ✅ |
| 14 | API | Shape of the initial route | `{name,params?}` / bare name | **`initial: { name, params? }` — structured & typed, so an initial route can carry params.** | ✅ |
| 15 ★ | Structure | Where the router lives | new subsystem / into app/ | **New `packages/ui/src/router/` subsystem with a barrel; EXPLICIT named re-exports in `src/index.ts` (matches the layout/view/event convention).** | ✅ |
| 16 ★ | Concurrency | Re-entrant navigation (push during a screen's `build`/`onMount`) | tick-coalesced / guarded / unspecified | **Router mutations run through the loop's `runTick`/schedule seam (like focus ops) so a navigation coalesces to one frame; push-during-build is discouraged, not specially guarded in v1.** | ✅ |
| 17 ★ | Interop | Navigating while a modal (`execView`/dialog) is open | allowed / blocked | **Allowed in v1; document that apps should close modals before navigating. No guard added (dialogs resolve independently, loop-level).** | ✅ |
| 18 ★ | Scope | Keep-alive memory for a deep warm stack | unbounded / LRU cap | **Unbounded acceptable — keep-alive is opt-in per route. No LRU cap in v1; note it as a possible future knob.** | ✅ |
| 19 | Behavior | Focus-restore mechanism for disposed+recreated back-stack screens | exact View-ref / index-path / screen `focusKey` / first-focusable | **Tiered CONTRACT fixed: exact (warm, saved `View`) → optional per-screen `focusKey` → best-effort first-focusable floor. Middle tier DECIDED by the Phase 0 spike (ST-6b): the index-path resolver (`focusPath`/`viewAtPath`) restores the same-position leaf on an identical rebuild, so it is the AUTOMATIC middle tier — `focusKey` is the explicit override for reshaped rebuilds, first-focusable the floor. Order: exact → `focusKey` → index-path → floor.** | ✅ |
| 20 | Tooling | Verify command | — | **`yarn verify` (per CLAUDE.md; fills every Verify line).** | ✅ |
| 21 | API | The `ChromeHost` seam the router drives | — | **`interface ChromeHost { setStatus(items: View[] \| null): void; setMenu(items: MenuItem[] \| null): void }`. `createApplication` implements it over the real bars and passes it to router content; `null` restores the base.** | ✅ |
| 22 (runtime) | Architecture | HOW to widen `Application.desktop` without breaking existing apps + the public `messageBox(app,…)` seam (AR-10 said "additive" but a flat `Desktop \| undefined` breaks ~230 `app.desktop.*` sites + `ModalDialogHost`) | flat widen + churn / overloads / conditional return type | **`createApplication<O>` returns a CONDITIONAL type `CreatedApplication<O> = O extends {content:View} ? RouterApplication : DesktopApplication`. Base `Application.desktop: Desktop \| undefined` (per AR-10); a no-`content` call infers `DesktopApplication` (`desktop: Desktop`) → zero churn, `messageBox(app)` still typechecks; a `content` call infers `RouterApplication` (`desktop: undefined`). This is the implementation that fulfills AR-10's stated "must not break existing apps" constraint. Discovered during Phase 0.2; no new user decision — refines AR-10's mechanism.** | ✅ |
| 23 (runtime) | Architecture | HOW the router reaches the loop's `focusView`/`getFocused` for AR-19 focus restore (03-02 §Focus assumes `loop.focusView` but names no seam), and how `app.statusBase()` produces "fresh items" (AR-4/PF-003) from a built `StatusLine` | reach into loop / dedicated seam · clone views / rebuild from specs | **A dedicated `FocusHost { focusView, getFocused }` seam + `FocusHostAware`, wired by `createApplication` exactly like `ChromeHost` (a standalone-mounted router gets none; the loop's focus-healing then floors focus). `app.statusBase()` rebuilds fresh `StatusItemView`s from the base bar's command items' `text`/`command`/`key` (captured once at startup, before any swap); passive segments (spacers/widgets) are not part of a composable base. Internal refinement — no observable-behavior change vs. the plan; follows the established seam pattern.** | ✅ |

### Traceability note

Every design/scope/behavior decision in the component and testing docs carries an `AR-#`
back-reference above. Cosmetic/formatting choices with zero semantic impact are exempt. The
Phase 0 spike is the sole place a decision (AR-19's middle tier) is finalized against evidence
rather than up front — recorded here as a deliberate, bounded exception.
