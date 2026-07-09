# Ambiguity Register: `@jsvision/web` Browser Runtime (RD-02 plan)

> **Status**: ✅ GATE PASSED — all 8 items resolved
> **Last Updated**: 2026-07-09
> **Scope**: plan-level decisions for RD-02. Requirements-level decisions are already resolved in
> `../../requirements/RD-02-web-runtime.md` (Scope Decisions AR-2/6/25/26) and imported here as
> pre-resolved context; this register records only the decisions the RD left open.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical/Packaging | RD Must-Have hedges "a separate `@jsvision/web/browser` **(or documented)** entry point so consumers never pull `node:tty`". The `node:tty` pull is transitive through the `@jsvision/core` barrel regardless of which `@jsvision/web` entry is imported, so a dual app-entry does not remove it. | (a) single `.` entry + a shipped `@jsvision/web/browser-stubs` subpath consumers alias `node:fs`/`node:tty` to + documented Vite-alias guidance / (b) dual `.` + `./browser` entries | **(a) Single `.` entry + `browser-stubs` subpath + documented alias.** The consumer alias is the real fix (spike `packages/examples/web-xterm/vite.config.ts:23-28`); a second app-entry would be redundant. | ✅ Resolved |
| 2 | Process/Versioning | RD Must-Have says "wired into `yarn sync-versions`", but `scripts/sync-versions.mjs:6` deliberately **skips `private:true`** packages, and `@jsvision/files` (also private) is not synced. | (a) leave `@jsvision/web` static at root version `0.1.0` like `@jsvision/files` — the script auto-adopts it when `private` is dropped at first release / (b) add an opt-in allowlist so the script syncs the private package now | **(a) Static, no script change.** Matches the `@jsvision/files` precedent; preserves the "skip private" invariant; "wired in" is satisfied structurally (lives under `packages/*`). | ✅ Resolved |
| 3 | Scope | Which Should-Haves land in this plan (mountApp / File System Access bridge / WebGL helper)? | (a) mountApp now (RD-03 blocks on it), defer FSA bridge (RD-07/tvedit) + WebGL (nicety) / (b) all three now / (c) none | **(a) Include `mountApp`; defer FSA bridge + WebGL.** `mountApp` is the primary API RD-03's Play dialog builds on (Phase-A critical path); the other two have no Phase-A consumer. | ✅ Resolved |
| 4 | Testing | The reclaim + clipboard surfaces touch DOM APIs (`window`/`document`/keydown/`navigator.clipboard`) absent in the repo's default node vitest environment. | (a) hand-mocked globals (tiny fakes) / (b) add a `jsdom`/`happy-dom` devDep as the test environment | **(a) Hand-mocked globals.** Only a handful of DOM APIs are touched; hand-mocks keep the devDep surface minimal (matches the repo's existing hand-built doubles like `CaptureStream`/`FakeInput`) and stay deterministic. Host + decode tests use `@xterm/headless` (devDep) per AC-2/AC-3. | ✅ Resolved |
| 5 | Process/Dogfood | Fate of the `packages/examples/web-xterm/` spike after extraction. | (a) refactor it to import `createBrowserHost`/caps/stubs from `@jsvision/web` (dogfood) / (b) leave it untouched | **(a) Refactor to consume the package.** Proves the extraction replaces the spike verbatim, live-smokes the real API, and deletes the duplicated locals; demo behavior stays identical. | ✅ Resolved |
| 6 | Technical/Data | Virtual FileSystem fidelity: symlink support, mtime determinism, path semantics. | (a) files + dirs only (`lstat===stat`, `kind` never `'symlink'`), deterministic per-entry-overridable mtime, pure-POSIX `..`/`.` normalization, same error shapes `@jsvision/files` expects / (b) full symlink emulation | **(a) Files + dirs, deterministic mtime, POSIX string ops.** Symlinks are an unused complication for a seeded in-memory demo tree; determinism matters for golden tests. Implements all 18 `FileSystem` methods (`packages/files/src/fs/types.ts:45-80`). Symlinks deferrable if a later demo needs them. | ✅ Resolved |
| 7 | Process | Does `@jsvision/web` need a kitchen-sink story (the NON-NEGOTIABLE gate)? | (a) no — it is non-visual runtime infrastructure; its meaningful live demo **is** RD-03's live-example system, which runs on it / (b) yes | **(a) No story.** The gate requires stories for **visual** components; `@jsvision/web` is the substrate. Recorded explicitly because the gate is non-negotiable. | ✅ Resolved |
| 8 | Naming/Process | The verify command that fills every Verify line. | `yarn verify` (lint → turbo typecheck/build/test/check:docs) + `yarn check:deps` | **`yarn verify` + `yarn check:deps`.** Unlike docs-site, `@jsvision/web`'s build script **is** named `build`, so it participates fully in `yarn verify`/CI — intended (a shipped product surface). | ✅ Resolved |

### Resolution Notes

**AR-1..8:** New plan-level decisions, user-confirmed 2026-07-09 after current-state analysis (the
`packages/examples/web-xterm/` spike is behavior-complete; `sync-versions.mjs` skips private; the
`@jsvision/files` `FileSystem` seam has 18 synchronous methods).

**Imported (pre-resolved in the RD):** host placement = a first-class `@jsvision/web` package
(RD Scope AR-6); browser fs = in-memory virtual `FileSystem` (RD Scope AR-2); package name +
visibility = `@jsvision/web`, private until first release (RD Scope AR-25); uploads stay in the
browser, never transmitted (RD Scope AR-26). Not re-confirmed here (gate import rule).

**Shipped-code hygiene (not an ambiguity, a hard constraint carried into 03-02/03-04):** the spike's
JSDoc carries CodeOps process IDs (`HR-24`, `AR-14`, `PA-9`, `HR-07`) and a "Turbo Vision application"
phrase. When the host is promoted into `packages/web/src` (shipped source), those references **must be
stripped** and every public export given an `@example`, or `check:docs` (`check-jsdoc.mjs`) fails.
Promotion is **verbatim in behavior**, not verbatim in comments.
