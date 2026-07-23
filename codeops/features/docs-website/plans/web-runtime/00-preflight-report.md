# Preflight Report — `@jsvision/web` Browser Runtime (docs-website/RD-02 plan)

> **Artifact**: `codeops/features/docs-website/plans/web-runtime/` (10 docs + `99-execution-plan.md`)
> **Type**: Implementation plan
> **Scanned against**: HEAD `9b081a1` (clean tree)
> **Date**: 2026-07-09
> **Skills version**: 3.3.2
> **Reviewer note**: The plan was authored in a prior session (already committed), so this is an
> independent-session review. Advisor hardening was attempted but the advisor tool was unavailable;
> each MAJOR finding was self-challenged in-context and every claim is grounded in `file:line`.

## Outcome

**✅ PREFLIGHT PASSED — all 7 findings resolved** (fixes applied to the plan docs 2026-07-09).
2 MAJOR · 4 MINOR · 1 OBSERVATION, all fixed at the user's direction ("fix the best possible way").
The plan was well-constructed and codebase-grounded to begin with — the host is genuinely proven in
the spike, the security model is sound, and most claims verified exactly. The two MAJORs both
concerned the collision between "promote the spike verbatim" and "headless-testable", plus a false
verify-coverage claim; neither undermined the package thesis, and both are now reconciled in the plan.

### Resolution summary (what changed in the plan)

- **PF-001** — `03-04` + `99-plan` 5.3.1 now state the dogfood is proven by the live `demo:web` boot
  (the `web-xterm` spike is intentionally outside verify's typecheck scope, like every browser demo);
  the false "verify typechecks the spike" claim and the nonexistent `examples build` step are gone.
- **PF-002** — `03-02` introduces a local `TerminalLike` structural interface (host + `mountApp` +
  reclaim type against it), so an `@xterm/headless` terminal is a valid argument with no `as unknown`
  cast; `mountApp` calls `term.focus?.()` (optional) and never constructs a terminal itself (requires
  `term` or a `createTerminal` factory), so it never value-imports the CJS-default `@xterm/xterm`.
  `03-01` drops `@xterm/xterm` from devDeps (source no longer imports it) — it stays an optional peer.
- **PF-003** — "18 methods" → "14 methods + the `sep` property" across all docs incl. ST-11; citation
  fixed to `:44-80`.
- **PF-004** — the `node:fs` enumeration now names all three sites (host/streams, host/platform,
  safety/logger) and explains the logger site stays load-safe / fails loud.
- **PF-005** — ST-4 reworded to the two satisfiable checks (`web/src` clean + stubbed build clean),
  matching the RD's "in the bundle" framing.
- **PF-006** — folded into PF-001 (the `examples build` clause removed).
- **PF-007** — the illustrative `(AR-6)` in the `mtime` JSDoc snippet scrubbed.

## Codebase Context Summary

Verified against the real code:

- **Spike is real & behavior-complete** — `packages/examples/web-xterm/{browser-host,app,node-stub,vite.config,main}.ts` exist; `demo:web` script exists in `packages/examples/package.json:40`.
- **Core barrel** re-exports every claimed symbol (`serialize`/`decode`/`flush`/`createDecoderState`/`cursor`/`ESC_TIMEOUT_MS`/`resolveCapabilities`/`sanitize` + types) — `packages/core/src/engine/index.ts`. `ScreenBuffer.clone()` exists (`render/buffer.ts:349`). Decoder emits `key:'up'` (`input/keys.ts:35`) and `key:'f1'` (`input/keys.ts:45`).
- **`check-jsdoc.mjs`** really bans the CodeOps IDs and requires `@example` on public exports; the spike really carries `HR-24`/`AR-14` (`browser-host.ts`), `PA-9`/`HR-07` (`app.ts`), and "Turbo Vision" (`main.ts`/`app.ts`) — the hygiene claim is accurate.
- **`sync-versions.mjs`** skips `private:true` (confirmed); root version `0.1.0`; `@jsvision/files` is the correct package template (`private`, same scripts/deps).
- Discrepancies drove the findings below.

---

## Findings

### 🟠 PF-001 (MAJOR) — Dimension 7/13 · The dogfooded spike is **not** typechecked by `yarn verify`, contradicting the plan

**Where**: `03-04-browser-integration.md` "Verify (this component)"; `99-execution-plan.md` Step 5.3.1 + Definition of Done.

**Claim in plan**: *"`yarn verify` green (incl. the refactored spike typechecking against built `@jsvision/web`)"* and *"the refactored spike typechecks against the built `@jsvision/web`."*

**Reality**: `packages/examples/tsconfig.json` has `include: ["capability-probe", "resize-demo", "keyboard-mouse-playground"]` — `web-xterm` is **excluded**. Its own `packages/examples/web-xterm/tsconfig.json` header states it is *"not part of the root `yarn typecheck`, whose include list omits it."* `packages/examples` has **no `build` script**. So `yarn verify` (lint → turbo typecheck/build/test/check:docs) never typechecks or builds the refactored spike. The dogfood's type-correctness against the real `@jsvision/web` API is validated **only** by manually running `demo:web` (Vite) — not by verify/CI.

**Impact**: A broken dogfood refactor (wrong import, changed type) passes `yarn verify` and CI silently. The AR-5 "verbatim extraction" proof rests partly on an automated gate that doesn't run.

**Options**:
- **(a) — Recommended** — Correct the plan wording: the dogfood is validated by the manual `demo:web` boot (the live proof AR-5 already names), **not** by `yarn verify` typecheck. Drop `yarn workspace @jsvision/examples build` from 5.3.1 (see PF-006) and state the spike is out of verify's typecheck scope by design (matching every other demo).
- **(b)** — Add `web-xterm` to `packages/examples/tsconfig.json`'s `include` so the refactor is a real gate. Costs: `web-xterm` uses a *browser* tsconfig (`lib:["DOM",...]`, `types:[]`) incompatible with the examples node tsconfig — you'd need a project reference or a separate `typecheck:web` script wired into verify. Real coverage, non-trivial wiring.
- **(c)** — Accept as-is (leave the claim). Not recommended — it's a false statement about what CI covers.

**Recommendation**: **(a)**. The manual `demo:web` boot is the intended live proof; the plan should say so honestly rather than assert a typecheck gate that doesn't exist. If you want the stronger gate, **(b)** is a clean follow-up but adds tsconfig plumbing disproportionate to a demo.

---

### 🟠 PF-002 (MAJOR) — Dimension 6/7/13 · Host/`mountApp` are typed to `@xterm/xterm`'s `Terminal`, which the headless spec tests (ST-2/3/10) cannot satisfy; `mountApp` also calls headless-absent APIs

**Where**: `03-02-browser-host.md` (`BrowserHostOptions.term: Terminal`, `MountAppOptions.term?: Terminal`, `mountApp` wiring "…`term.focus()`", "else created"); `07-testing-strategy.md` ST-2/ST-3/ST-10; `99-execution-plan.md` Steps 2.1.1, 2.2.x.

**Three grounded problems, one root cause** (the plan promotes the spike's `@xterm/xterm`-typed host verbatim, but the tests and thesis are *headless*):

1. **Type incompatibility.** The host is typed `term: Terminal` from `@xterm/xterm` (spike `browser-host.ts:23`). `@xterm/xterm`'s `Terminal` has `focus`/`blur`/`element`/`textarea`/`attachCustomKeyEventHandler`/`selectAll`/`onRender` — **all absent in `@xterm/headless`** (verified in both `.d.ts`). So an `@xterm/headless` `Terminal` is **not** structurally assignable to the `@xterm/xterm` `Terminal` type. ST-2/ST-3 (`createBrowserHost` over a headless term) and ST-10 (`mountApp` over a headless term) will **not typecheck** without an `as unknown as Terminal` cast — which the coding standards forbid ("no unsafe casts `as any`/`as unknown`"). The repo's own golden helper (`packages/core/test/golden-screen-helpers.ts`) sidesteps this by typing the headless emulator as `@xterm/headless`'s *own* `Terminal`, not xterm's.

2. **`focus()` on headless.** `mountApp`'s wiring calls `term.focus()` (verbatim from `main.ts:89`); `@xterm/headless` has **no `focus()`** (0 occurrences in its typings). ST-10 (run `mountApp` over a headless term) throws at runtime on that line.

3. **The "else create a terminal" path.** `mountApp` is synchronous and, when no `term` is injected, must `new Terminal()` from `@xterm/xterm`. That package is **CommonJS exposing only a `default` export** (verified: `import('@xterm/xterm')` keys = `['default']`), so `import { Terminal } from '@xterm/xterm'` as a *value* is `undefined` under NodeNext ESM (the repo works around this with a default import). It also drags the browser-only package into the runtime graph of a package that declares it *optional*.

**Impact**: Three of the twelve immutable spec oracles (ST-2/3/10) cannot be implemented as written without forbidden casts and a runtime throw; `mountApp`'s create-path is latently broken under `tsc`-built ESM.

**Options**:
- **(a) — Recommended** — Type the host/`mountApp` against a **narrow local `TerminalLike` interface** (only the members actually used: `write(data)`, `onData(cb)`, `onResize(cb)`, and an **optional** `focus?()`), exactly the "narrow local interface, no DOM lib" pattern the plan already adopts for the reclaim/clipboard DOM APIs. Both `@xterm/xterm` and `@xterm/headless` satisfy it structurally, `focus?.()` no-ops headlessly, and `@xterm/xterm` can drop to a **types-only devDependency**. Make terminal *creation* the caller's job (require an injected `term`, or accept a `createTerminal` factory) so the package never value-imports the browser-only module. Behavior stays verbatim; the type surface becomes honest.
- **(b)** — Keep the `@xterm/xterm` `Terminal` type and change the tests to construct a real `@xterm/xterm` terminal under a DOM-mock/`happy-dom` env. Contradicts AR-4 (hand-mocked globals, no jsdom/happy-dom) and the "headless via `@xterm/headless`" decision in ST-2/3.
- **(c)** — Keep verbatim and cast in tests (`as unknown as Terminal`) + guard `focus()`. Violates the no-unsafe-cast standard; leaves the create-path bug.

**Recommendation**: **(a)** — it reconciles "verbatim behavior" with "headless-testable", matches the plan's own narrow-interface idiom, removes the forbidden cast, fixes `focus()` and the create-path, and demotes `@xterm/xterm` to types-only. Note this in `03-02` and add a task under Phase 2. (The host *logic* is still promoted verbatim — only the `term` **type annotation** narrows, which is what "the only structural change is the injectable timer" should have also covered.)

---

### 🟡 PF-003 (MINOR) — Dimension 12/13 · "18 `FileSystem` methods" — the interface has **15 members** (14 methods + the `sep` property)

**Where**: `00-index.md` (Key Decisions), `00-ambiguity-register.md` AR-6, `01-requirements.md` #5, `02-current-state.md`, `03-03-virtual-filesystem.md`, `99-execution-plan.md` 3.2.1, **ST-11** (`07-testing-strategy.md`).

**Reality**: `packages/files/src/fs/types.ts` (interface at lines 44–80) declares `readDir, stat, lstat, resolve, isAbsolute, join, dirname, basename, sep (readonly property), homedir, roots, readFile, writeFile, rename, unlink` = **15 members**, of which **14 are methods** and `sep` is a property. The plan's own enumeration lists exactly these 15 yet labels them "18 methods." No functional risk (`implements FileSystem` is TypeScript-enforced), but the count is wrong in ~7 places including the immutable **ST-11** oracle.

**Recommendation**: Replace "18 methods" with "the full `FileSystem` interface (14 methods + the `sep` property)" everywhere, ST-11 included. Also fix the line citation `:45-80` → `:44-80` (cosmetic).

---

### 🟡 PF-004 (MINOR) — Dimension 13 · The `node:fs` import enumeration is incomplete — `safety/logger.ts` is a third, barrel-reachable site

**Where**: `02-current-state.md` ("The only Node built-ins the core graph statically imports are `node:fs` + `node:tty`, both from the native `host/` subsystem (`streams.ts`, `platform.ts`)"); `03-04-browser-integration.md` (stub covers "the `node:fs` (`writeSync`/`openSync`/`closeSync`) … named imports the `@jsvision/core` barrel statically pulls from its native `host/`").

**Reality**: There are **three** static `node:fs` import sites in core: `host/streams.ts:13`, `host/platform.ts:13`, **and `safety/logger.ts:14`** — the last a **namespace import** (`import * as nodeFs from 'node:fs'`), and `safety` **is** re-exported from the barrel (`engine/index.ts:130,142`). It is load-safe (nothing dereferences `nodeFs` at module load; it's used lazily as the default `LoggerFs` at `logger.ts:190`, and `openSync` is in the stub so the file-logger path still throws loudly), so the spike works — but the plan's characterization is inaccurate and the stub omits `fstatSync` (which `LoggerFs` needs; harmless only because `openSync` throws first).

**Recommendation**: Correct the enumeration to name all three sites (host/streams, host/platform, safety/logger) and note the logger site is a barrel-reachable namespace import that stays load-safe. Relevant to the ST-4 boundary reasoning (PF-005).

---

### 🟡 PF-005 (MINOR) — Dimension 7 · ST-4's "no `node:fs` reachable from the browser entry" is unsatisfiable read literally

**Where**: `07-testing-strategy.md` ST-4; `03-03`/`03-04` companion text.

**Reality**: `@jsvision/web` → `@jsvision/core` statically reaches `node:fs` (three sites, PF-004). A pure source-graph scan from the browser entry therefore *always* finds `node:fs`; the boundary only holds **after the consumer's Vite alias / in the built bundle** (which the RD's AC-4 states as "no `node:fs` import present *in the bundle*… build with the stubs"). ST-4 compresses this to "no `node:fs` reachable from the browser entry (import-graph scan)", which a literal implementer could make either trivially-true (scan only `web/src`) or impossible (scan the transitive graph).

**Recommendation**: Reword ST-4's boundary clause to the two concrete, satisfiable checks: (i) `@jsvision/web`'s **own source** imports no `node:fs`/`node:tty`, and (ii) a **stubbed build** of the demo contains no `node:fs` specifier. Mirror the RD's "in the bundle" framing.

---

### 🟡 PF-006 (MINOR) — Dimension 13 · `99-execution-plan.md` 5.3.1 runs a nonexistent `examples build` script

**Where**: `99-execution-plan.md` Step 5.3.1: "`yarn workspace @jsvision/examples build`/`demo:web` still boots."

**Reality**: `packages/examples/package.json` has **no `build` script** (AGENTS.md: "examples don't build"). `yarn workspace @jsvision/examples build` errors. Ties into PF-001.

**Recommendation**: Drop the `build` clause; the check is that `demo:web` still boots (and optionally `yarn workspace @jsvision/examples typecheck`, which covers the *other* demos but not `web-xterm` — see PF-001).

---

### 🔵 PF-007 (OBSERVATION) — Illustrative shipped-code snippets embed banned CodeOps IDs in JSDoc

**Where**: `03-02` (`BrowserHostOptions.timer` doc, caps snippet), `03-03` (`mtime?: Date` doc: *"…for every seeded entry (AR-6)."*).

**Note**: These `.ts` snippets model the *shipped* API but carry `(AR-6)`-style IDs inside JSDoc — the exact thing `check-jsdoc.mjs` rejects in `packages/web/src`. The plan repeatedly warns to strip IDs and add `@example`, so it is self-consistent; the risk is only a careless verbatim copy. Consider scrubbing the illustrative snippets so they model clean output.

---

## Verified-consistent (not defects)

- RD-02 Must-Have #7 ("a separate `@jsvision/web/browser` entry point") is intentionally superseded by AR-1 (single `.` entry + `browser-stubs` subpath); the register documents the transitive-`node:tty` reasoning correctly.
- No new native runtime dependency; `@xterm/*` are pure-JS dev/peer — `check:deps` stays green (the `check-no-native-deps.mjs` grounding holds).
- Security model (sanitize boundary, no network on FS ops, gesture-gated write-only clipboard, lexical `..`) is real and grounded in `@jsvision/core`'s `sanitize` + the injectable `FileSystem`.

---

## Decisions log

User directive 2026-07-09: "fix this the best possible way then proceed" → the recommended option
was applied for every finding.

| PF | Severity | Decision | Notes |
|----|----------|----------|-------|
| PF-001 | MAJOR | Fixed — corrected wording (Rec a) | Dogfood = manual `demo:web` boot; false verify claim removed |
| PF-002 | MAJOR | Fixed — narrow `TerminalLike` (Rec a) | Host/mount/reclaim; optional `focus?()`; injected term/factory; xterm→optional peer only |
| PF-003 | MINOR | Fixed | 14 methods + `sep`; citation `:44-80` |
| PF-004 | MINOR | Fixed | Third `node:fs` site (safety/logger) named; load-safe rationale |
| PF-005 | MINOR | Fixed | ST-4 → two satisfiable checks (web/src + stubbed build) |
| PF-006 | MINOR | Fixed | `examples build` step removed (with PF-001) |
| PF-007 | OBS | Fixed | `(AR-6)` scrubbed from the `mtime` snippet |
