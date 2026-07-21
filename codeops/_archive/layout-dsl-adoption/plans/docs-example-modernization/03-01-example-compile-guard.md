# Example Compile Guard: docs-example-modernization

> **Document**: 03-01-example-compile-guard.md
> **Parent**: [Index](00-index.md)
> **Covers**: FR-1, FR-1a, FR-2, FR-9 · AR-2, AR-5, AR-7, AR-9, AR-10, AR-11, AR-12, AR-13, AR-14,
> AR-15, AR-16

## Overview

A permanent guard that makes CLAUDE.md's *"every example is executable spec"* directive true rather
than aspirational. It extracts every `@example` body from the **six shipped packages** (AR-15),
compiles each as a standalone module **in memory** (AR-16), and fails the build on any failure that
is not explicitly grandfathered.

It is built **first**, before any example is edited, for two reasons: it is the oracle for the rest
of the plan, and its allowlist must record the pre-existing baseline — generating it *after* the
sweep would silently absorb anything the sweep broke.

## Architecture

### Current architecture

Nothing to replace. `scripts/check-jsdoc.mjs:130-133` checks only that an `@example` tag exists.
No test, script or CI step compiles an example body ([02](02-current-state.md) §What exists).

### Proposed changes

One new module in `packages/docs-site/src/` and four new files in `packages/docs-site/test/` (AR-7):

| File | Role |
|---|---|
| **`src/api/jsdoc-examples.mjs`** | **The harness itself** — `collectExamples`, `checkExamples`, and the in-memory compiler host. Lives in `src/` and not `test/` for two reasons: it follows the package's own established shape (`src/api/barrel-exports.mjs` is the module, `test/api-barrel-exports.spec.test.ts` is its oracle), and `packages/docs-site/tsconfig.json` includes `src/**` but **not** `test/**`, so only a module in `src/` is covered by `yarn typecheck` |
| `test/jsdoc-examples.spec.test.ts` | The immutable oracle — drives the harness over fixtures with an injected allowlist (ST-1…ST-11, ST-13, ST-14) **and** carries the standing repo-wide gate (ST-12, FR-1a) |
| `test/jsdoc-examples.allowlist.json` | The committed grandfather list (FR-9) |
| `test/jsdoc-examples.impl.test.ts` | Harness internals: fence variants, terminator un-escaping, symbol/ordinal keying, the anonymous fallback |
| `test/fixtures/jsdoc-examples/` | Small `.ts` sources with deliberately good and bad `@example` blocks |

The harness is a module the tests import, not logic embedded in a test body — the ST-cases need to
drive it over fixtures with an injected allowlist, which is impossible if it only ever runs over the
real repo.

> **The fixture cases and the repo gate are different things and must both exist.** ST-1…ST-11 +
> ST-13/ST-14 pin the *contract* against fixtures, deliberately insulated from repo state. **ST-12**
> is the gate that makes FR-1/FR-2 real: it runs the harness over the actual roots and asserts zero
> `unexpected` and zero `stale`. Without ST-12 the allowlist is a file nothing reads and the whole
> guard ships inert — which is what an earlier draft of this plan would have produced, because 07
> said the spec cases run "not over the live repo" and no task created anything that did.

## Implementation details

### The seam that makes it testable

```ts
/** One `@example` block, located and normalized. */
export interface ExampleBlock {
  /** Repo-relative path of the source file the block was found in. */
  readonly file: string;
  /**
   * Allowlist key's second half: the declaration's name, qualified `Class.member` for members,
   * suffixed `#N` (1-based, source order) where the key would otherwise repeat within the file.
   * `(anonymous)` when the JSDoc hangs on an unnamed node.
   */
  readonly symbol: string;
  /** 1-based line of the `@example` tag, for human-readable failure output only. */
  readonly line: number;
  /** Byte offset of the `@example` tag — the de-duplication identity (see §Extraction). */
  readonly pos: number;
  /** The block body, fence-stripped and comment-terminator-unescaped. */
  readonly body: string;
  /**
   * Absolute path this block is compiled *as*, always inside its own source's directory so that
   * relative specifiers and `type: module` resolve correctly. Nothing is ever written there.
   */
  readonly virtualPath: string;
}

/** A block that failed to compile, with every diagnostic reported against it. */
export interface ExampleFailure {
  readonly key: string;      // `${file}::${symbol}`
  readonly line: number;
  /** Every distinct diagnostic code, ascending — the comparison set (see §The allowlist contract). */
  readonly codes: readonly number[];
  /** For each `TS2304`, the identifier it could not find — part of the comparison. */
  readonly missingNames: readonly string[];
  /** All diagnostic messages, joined, for human readability only. */
  readonly message: string;
}

/** What the guard concluded — the shape the spec tests assert against. */
export interface GuardResult {
  readonly checked: number;
  /** Failures with no allowlist entry, or whose error code differs from the recorded one. */
  readonly unexpected: ExampleFailure[];
  /** Allowlist entries whose block now compiles — these must be removed. */
  readonly stale: string[];
}

export function collectExamples(roots: string[]): ExampleBlock[];
export function checkExamples(blocks: ExampleBlock[], allowlist: Allowlist): GuardResult;
```

`checkExamples` is where the contract lives, and it takes the allowlist as an argument. That is what
lets ST-3…ST-5 drive stale/new/matching cases from fixtures instead of waiting for the repo to
happen to be in the right state.

### Extraction

Walk the **six enumerated roots** — `packages/{core,ui,web,files,datagrid,forms}/src/**/*.ts` —
skipping `.d.ts`. Never a `packages/*/src` glob: that also matches `docs-site` and the inert
`spike-data-studio` (AR-15). For each declaration, take `ts.getJSDocTags(node)`, keep tags whose
`tagName.escapedText` is `'example'`, and read the body with
`ts.getTextOfJSDocComment(tag.comment)`. Empty bodies are skipped, not failed.

**De-duplication — do this first, it is not optional.** `ts.getJSDocTags(node)` returns the *same*
tag for every node the JSDoc binds to: for an `export const`, three nodes (`VariableStatement` →
`VariableDeclaration` → `Identifier`), each carrying a different `node.name`. A naive walk therefore
yields one block per *binding*, not per tag — which is how the planning probe reported 451 blocks
where only 393 distinct tags exist, and how a single tag in
`packages/core/src/engine/color/presets.ts:37` produced both `presets.ts::classicTheme` **and**
`presets.ts::(anonymous)`. **De-duplicate by `(file, tag.pos)` and resolve the symbol from the
outermost declaration that owns the JSDoc.** Getting this wrong does not merely miscount: it mints
two conflicting keys for one block, and an `(anonymous)` key that collapses many failures into one
entry whose recorded diagnostics change run to run.

**Fence stripping (AR-12).** Strip a leading fence line and a trailing fence before compiling,
**unconditionally and package-agnostically** — fencing is a per-block property, not a per-package
one (measured distribution: datagrid 85 · ui 8 · forms 2 · theme-designer 0). Without this the
backticks parse as template literals — it produced 44 phantom `TS2349` failures during measurement.

**Comment-terminator un-escaping.** A body that legitimately contains a block comment escapes its
terminator as `*\/` in the source, and `getTextOfJSDocComment` returns it verbatim, which is not
valid TypeScript. Un-escape `*\/` → `*/`. One real occurrence today:
`packages/datagrid/src/format.ts:27` (otherwise `TS1010 '*/' expected`).

**Symbol resolution and key uniqueness (AR-10).** The key's second half is the name of the
declaration the tag hangs on, with three qualifiers, all of which have live cases in this repo:

| Case | Rule | Live example |
|---|---|---|
| Member of a class/interface | qualify as `Class.member` — a bare method name is not file-unique by construction (39 such blocks) | 20 `MethodDeclaration`, 8 `MethodSignature`, 11 `PropertySignature` |
| Two `@example`s on the **same** declaration | suffix `#N`, 1-based in source order | `packages/ui/src/controls/input.ts:47` and `:58`, both on `class Input` — **a file this plan edits** |
| JSDoc on an unnamed node | `(anonymous)`, and `#N` if repeated | `packages/files/src/fs/node-fs.ts:9` — an `@example` on the file's leading comment, which binds to the first `ImportDeclaration` |

`#N` is scoped *within one symbol*, so AR-10's objection to file-wide ordinals — that inserting an
example above silently re-targets an entry — does not apply. Two blocks in one file on different
symbols are independent entries (ST-8); two on the same symbol are also independent (ST-14).

### Compilation — in memory, at the source's own path (AR-16, preserving AR-13)

All blocks are compiled in a single `ts.createProgram` backed by a **custom `ts.CompilerHost`** that
serves each block as a virtual `SourceFile`. **Nothing is written to disk.**

```ts
const virtual = new Map(blocks.map((b) => [b.virtualPath, b.body]));
const realHost = ts.createCompilerHost(options);

const host: ts.CompilerHost = {
  ...realHost,
  getSourceFile: (f, v, onErr, shouldCreate) =>
    virtual.has(f)
      ? ts.createSourceFile(f, virtual.get(f)!, v, /* setParentNodes */ true)
      : realHost.getSourceFile(f, v, onErr, shouldCreate),
  fileExists: (f) => virtual.has(f) || realHost.fileExists(f),
  readFile: (f) => virtual.get(f) ?? realHost.readFile(f),
  writeFile: () => {},                        // never emits, under any circumstances
};

const program = ts.createProgram({ rootNames: [...virtual.keys()], options, host });
```

**`virtualPath` must sit inside the block's own source directory** — that is AR-13, and it is
load-bearing for two independent reasons:

1. Examples such as `packages/datagrid/src/button-row.ts` import `'./button-row.js'`, and a relative
   specifier only resolves from the source's own directory. Compiling from a shared location
   produced ~22 phantom `TS2307 Cannot find module` failures during measurement.
2. Every package is `"type": "module"`, and **37 blocks use top-level `await`** — they compile only
   because the virtual path lands inside a `type: module` package. A path outside one silently
   changes the module kind.

The path is load-bearing; the *file* was not. The original design wrote real
`.jsdoc-example.<hash>.ts` files there, and that was the guard's single largest hazard — it failed
three independent ways, all verified during preflight:

- **It raced the build.** `turbo.json` orders `typecheck` on `^build` and `test` on `build`+`^build`,
  but establishes **no ordering between `typecheck` and `test`**. `yarn verify` runs
  `turbo run typecheck build test check:docs`, so `ui#typecheck` (`packages/ui/tsconfig.json`
  `include: ["src"]`) could be running while ~400 scratch files were live inside `packages/ui/src`.
- **A leak was silent, not loud.** The plan assumed a leaked file "would be compiled by the next
  `yarn typecheck`". Verified false: TypeScript's wildcard `include` **does not match dot-prefixed
  filenames**, so a `.jsdoc-example.abc.ts` holding a hard type error leaves `tsc -p` at exit 0.
  `.gitignore` has no entry for the pattern either, so the leak survived quietly until a `git add -A`.
- **Cleanup was unreachable on the path that matters.** A `finally` does not run on SIGINT/SIGTERM
  (vitest kills the worker) and never on SIGKILL or OOM.

The in-memory host removes all three at once, and removes a fourth the on-disk design would also
have had: vitest runs test *files* in parallel worker threads and `packages/docs-site/vitest.config.ts`
sets no `fileParallelism: false`, so the spec run, the impl run and AC-9's forced-failure run could
have been in the same directories simultaneously.

**Compiler options (AR-14).** Resolved from `tsconfig.base.json`, with exactly three overrides:
`noUnusedLocals: false`, `noUnusedParameters: false` (an unused local in a doc snippet is not an API
defect — including them would allowlist ~56 blocks for snippet hygiene alone), and `noEmit: true`
(base sets `declaration`/`declarationMap`/`sourceMap`; the guard must never emit). Everything else
is the repo's own, so a block that passes the guard compiles the way the repo compiles.

### The allowlist contract (AR-9, AR-11)

```jsonc
{
  "packages/ui/src/dialog/buttons.ts::cancelButton": {
    "codes": [2304],
    "missingNames": ["dialog"],
    "message": "TS2304 Cannot find name 'dialog'."
  },
  "packages/ui/src/feedback/spinner.ts::Spinner": {
    "codes": [2304],
    "missingNames": ["app"],
    "message": "TS2304 Cannot find name 'app'."
  }
}
```

The value is an **object**, not a string. An earlier draft showed a bare string
(`"TS2304 Cannot find name 'dialog'"`) while specifying comparison on the numeric code — which would
have forced the harness to parse the code back out of prose, and left two implementations free to
disagree about the file's shape. `codes` and `missingNames` are compared; `message` is for human
readability only (FR-9).

| # | Situation | Verdict | Pinned by |
|---|---|---|---|
| 1 | Block absent from the allowlist, compiles | pass | ST-1 |
| 2 | Block absent from the allowlist, does not compile | **fail** — "public `@example` blocks are an API contract" | ST-2 |
| 3 | Block on the allowlist, fails with the recorded code set **and** the recorded missing names | pass | ST-3 |
| 4 | Block on the allowlist, fails with a **different** code set or different missing names | **fail** — a new defect hiding behind an old entry | ST-5 |
| 5 | Block on the allowlist, now compiles | **fail** — stale entry, must be removed | ST-4 |
| 6 | Allowlist entry naming a file/symbol that no longer exists | **fail** — stale entry, must be removed | **ST-13** |

The list may only shrink. Matching on **codes** rather than full message text is deliberate: TS
message text carries type names that change under unrelated refactors, and a guard that fails on
cosmetic message drift would be turned off within a month.

**Why the comparison is a code *set* plus the `TS2304` identifier, not a single first code.** An
earlier draft recorded only the *first* diagnostic and compared only its code. That would have made
the guard blind to the single most likely mistake this plan can make: five of the six allowlisted
blocks the 03-02 sweep edits are grandfathered on `TS2304`
(`buttons.ts::cancelButton`/`okCancelButtons`/`yesNoButtons`, `spinner.ts::Spinner`,
`form-dialog.ts::formDialog`), and **a forgotten `at` import is also `TS2304`** — so a botched
conversion in `buttons.ts`, which carries 6 of the 53 converted lines, would have passed silently.
Comparing the full code set catches a *new* code appearing; comparing the named identifier for
`TS2304` catches `Cannot find name 'at'` arriving beside `Cannot find name 'dialog'`.

Editing an allowlisted block is permitted so long as no new error appears — which is what lets the
03-02 sweep touch six allowlisted blocks without dragging six unrelated examples into scope.

### Failure output

Failures must be actionable without re-running anything, and must not invite the wrong fix:

```
FAIL  jsdoc-examples: 1 example does not compile

  packages/ui/src/controls/slider.ts::Slider   (line 88)
    TS2554 Expected 2 arguments, but got 1

  Public @example blocks are an API contract and must compile.
  Do not add this to the allowlist — the allowlist may only shrink.
```

The last line matters. The path of least resistance when a guard like this fires is to append to
the allowlist, which would invert the ratchet; the message says so at the point of failure.

## Integration points

- Runs as part of `packages/docs-site`'s `test` script (`vitest run --project unit`), so it is
  reached by `yarn verify` → `turbo run … test` and by `turbo run test`.
- `turbo.json`'s `test dependsOn build` + `^build` supplies the built `dist/` the extracted examples
  resolve against ([02](02-current-state.md) §Dependencies). **`^build` covers only docs-site's
  declared dependencies** — today `core`, `files`, `ui`, `web`. Because AR-15 adds `datagrid` and
  `forms` to the guard's roots, both must be added to `packages/docs-site/package.json`
  devDependencies (task 1.2.4a), or their builds are unordered against `docs-site#test` and the
  committed allowlist becomes build-order dependent.
- Excluded from Windows/macOS by the `verify:shipped` filter in `package.json:24`
  (`--filter=@jsvision/{core,ui,web,files}`), documented at `ci.yml:44-55` — the reason AR-7 chose
  this package. The package already carries a full `ts.createProgram` in
  `test/api-barrel-exports.spec.test.ts`, with a 60 s vitest timeout whose comment explains exactly
  this cost; the guard measured ~1.9 s for 300 blocks.
- Does **not** interact with `scripts/gen-plugin-api.mjs` — the plugin API reference carries lead
  sentence and signature only, never `@example` bodies.

## Error handling

| Error case | Handling strategy | AR |
|---|---|---|
| A virtual path collides with a real source file | Cannot corrupt anything — nothing is written. The host resolves the virtual entry first, so a collision would only shadow that one file for the duration of the run; generate the path from the block's `pos` so it is unique and obviously machine-made | AR-16 |
| The run throws or is interrupted mid-compile | No cleanup path exists to fail — the process leaves nothing behind by construction. AC-9 remains as the regression check that a filesystem write is never reintroduced | AR-16 |
| Two harness runs execute concurrently in one vitest project | Harmless — each run's virtual map is private to its own `CompilerHost`. This was a real hazard under the on-disk design (`vitest.config.ts` sets no `fileParallelism: false`) | AR-16 |
| A block is fenced | Fence stripped before compiling, unconditionally — never scoped by package | AR-12 |
| A block contains an escaped comment terminator (`*\/`) | Un-escaped during extraction; otherwise `TS1010`. One live case: `datagrid/src/format.ts:27` | AR-12 |
| A block documents an unnamed declaration | Key falls back to `(anonymous)`, `#N`-suffixed if repeated. This is a **live case**, not a safety net: `packages/files/src/fs/node-fs.ts:9` hits it today. The line number is *not* part of the key, so the ordinal is what disambiguates | AR-10 |
| Two `@example` tags on the same declaration | Independent `#N`-suffixed entries; allowlisting one must not mask the other. Live case: `controls/input.ts:47` and `:58` | AR-10 |
| An allowlist entry names a file or symbol that no longer exists | Reported as stale — the list may only shrink | AR-11 |
| A block fails with a different code set, or a different `TS2304` identifier, than recorded | Reported as unexpected, not absorbed | AR-9 |
| A block cannot be parsed at all (literal `{ ... }` elision, top-level `return`) | Reported like any other failure and grandfathered. These are legitimate documentation idioms and a **permanent** allowlist residue — FR-9/AC-10 say so, so the drain issue is not written as if every entry is fixable | AR-5 |
| `dist/` is missing so every block fails to resolve `@jsvision/*` | Not special-cased: `test dependsOn build`+`^build` plus the AR-15 devDependency additions make it unreachable through the supported entry points, and a bare `vitest` run failing loudly is the correct signal | AR-15 |

> **Traceability:** every strategy above resolves to an Ambiguity Register entry.

## Testing requirements

- **ST-1…ST-8, ST-13, ST-14** ([07](07-testing-strategy.md)) drive
  `checkExamples(collectExamples([fixtureRoots]), injectedAllowlist)` over fixtures — **all six**
  verdict rows above (ST-13 is row 6, which had no case in the original draft despite 07's "every
  verdict row has a spec case" bar), plus fence handling, relative-import resolution, and the two
  key-collision cases. The fixtures must be driven through `collectExamples`, not hand-built as
  `ExampleBlock[]`: fence stripping and symbol resolution live there, so a hand-built block would
  make ST-6 and ST-14 assert nothing.
- **ST-12** is the standing repo-wide gate (FR-1a) — the case that makes FR-1/FR-2 real.
- The impl test covers harness internals the oracle does not reach: fence variants, terminator
  un-escaping, the `(anonymous)` fallback, and the `#N` ordinal rule.
- The allowlist is generated in **task 1.3.1** from the pre-sweep repo.
