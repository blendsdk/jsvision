# Preflight Report: docs-example-modernization

> **Artifact**: `codeops/features/layout-dsl-adoption/plans/docs-example-modernization/` (9 documents)
> **Iteration**: 1
> **Date**: 2026-07-20
> **Scan**: all 13 dimensions, clustered fan-out (3 auditor dispatches) + lead codebase reconnaissance
> **Findings**: 35 — 🔴 3 · 🟠 9 · 🟡 20 · 🔵 3
> **Status**: ✅ PASSED — all 35 findings resolved and applied to the plan (2026-07-20)

⚠️ **SAME-SESSION REVIEW** — the plan was authored 2026-07-20 15:12–15:22, this scan the same day.
Independence was bought by fan-out: three auditors scanned disjoint dimension clusters with the
lead's findings withheld, and every load-bearing number below was re-measured against the repo
rather than reasoned from the plan's own text.

## Verification method

The plan's central premises were re-derived empirically, not read:

- The 53-line / 37-file absolute-`@example` surface and the per-task partition in 2.2.1–2.2.8 were
  re-counted from the tree and are **exactly right** (9+10+5+8+8+5+4+4 = 53; 2+6+5+6+6+5+4+3 = 37).
- The 7 docs-site shadows and 38 call sites: **confirmed**.
- The extraction described in 03-01 §Extraction was **rebuilt with the TypeScript compiler API** and
  the real blocks compiled against the built `dist/`s. This is what produced PF-003, PF-004 and
  PF-013 — they are measurements, not inferences.
- `tsc`'s treatment of dot-prefixed files under a wildcard `include` was verified by experiment
  (PF-001).

---

## 🔴 CRITICAL

### PF-001 — The scratch-file mechanism is unsafe in three independent ways

**Dimensions**: 8 (security) · 13 (codebase alignment) · 6 (feasibility)

The harness writes `.jsdoc-example.<hash>.ts` **into `packages/<pkg>/src/`** beside real sources
(AR-13, `03-01:100-118`). Three separate defects:

1. **Concurrency race with turbo.** `turbo.json` orders `typecheck` on `^build` and `test` on
   `build`+`^build`, but establishes **no ordering between `typecheck` and `test`**. `yarn verify`
   runs `turbo run typecheck build test check:docs` — so `ui#typecheck` (`packages/ui/tsconfig.json`
   `include: ["src"]`) can be running while `docs-site#test` has ~400 scratch files live inside
   `packages/ui/src`. Intermittent, unattributable CI failures in an unrelated package.
2. **A leak is silent, not loud.** `02:188` rates this risk Medium/High on the premise that a leaked
   file "is picked up by `tsc`/`check:docs`". Verified false for the `tsc` half: TypeScript's
   wildcard `include` **does not match dot-prefixed filenames** — a `.jsdoc-example.abc.ts` holding a
   hard type error leaves `tsc -p` at exit 0. `.gitignore` has no entry for the pattern. The leak
   survives quietly until a `git add -A`.
3. **`finally` cannot cover interruption.** `01:87` and `03-01:116` promise cleanup "on **every** exit
   path including interruption"; a `finally` does not run on SIGINT/SIGTERM (vitest kills the worker),
   never on SIGKILL/OOM. No signal handler and no start-of-run stale sweep is specified. And AC-9's
   verification ("run with a fixture forced to **fail**", `99:100`) exercises a *compile failure* —
   the ordinary handled path that returns a `GuardResult` normally — while `07:109-113` presents it
   as evidence for the interrupted path.

**Adjacent**: `03-01:118` requires the generated name be "excluded from `check-jsdoc.mjs`'s walk".
`scripts/check-jsdoc.mjs:64-74` filters only on `.ts`/`.d.ts`/`.test.ts` and does **not** skip
dot-prefixed names — so satisfying that sentence means editing a repo-wide gate. No task does; it is
not in 00-index §Related Files.

**Failure scenario**: Ctrl-C during Phase 1's `yarn test` leaves ~400 scratch files across seven
`src/` trees. `yarn typecheck` stays green, so nothing surfaces. The developer commits them.

**Options**

| # | Option | Assessment |
|---|---|---|
| (a) | Keep the beside-source write; add `.gitignore` entry, a **start-of-run stale sweep** (idempotent recovery beats an unreachable `finally`), SIGINT/SIGTERM handlers, forced `noEmit`, a widened AC-9 glob (`.jsdoc-example.*`, not just `.ts`), and either a `check-jsdoc.mjs` exclusion task or the deletion of `03-01:118`. Serialize the guard against `typecheck` — e.g. move it out of `test` into its own turbo task ordered after `typecheck`. | Preserves AR-13, which is load-bearing (relative specifiers, and `type: module` for the 37 top-level-`await` blocks). Most work. |
| (b) | Write scratch files into a **sibling directory inside the package** (e.g. `packages/ui/.jsdoc-examples/`) with a `tsconfig` `paths`/`baseUrl` shim so relative specifiers still resolve. | Removes the collision surface entirely, but the shim must reproduce `'./button-row.js'` resolution for every source directory — fragile, and re-opens the ~22 phantom `TS2307`s AR-13 was written to close. |
| (c) | Compile **in memory** with a custom `ts.CompilerHost` — never touch the filesystem at all. | Eliminates the entire hazard class, including PF-014. `getSourceFile`/`fileExists`/`readFile` are overridden to serve virtual files at the real source's path, so relative resolution keeps working. This is the standard TS-API pattern for exactly this problem. |

**Recommendation: (c), falling back to (a).** The plan's own risk table already rates this the
top hazard, and every mitigation in (a) is a control that has to keep working forever on a path
nobody exercises. A virtual `CompilerHost` deletes the hazard instead of guarding it, and the repo
already builds full `ts.createProgram`s in this very package (`packages/docs-site/src/api/barrel-exports.mjs`).
If (c) proves harder than it looks against NodeNext resolution, (a) is a complete fallback — but
its AC-9 and `.gitignore` items should land regardless.

*Confidence: high (leak-invisibility and the turbo ordering were both verified directly).
Hardening: three independent auditors reached the concurrency/cleanup conclusion separately; no
challenger dispatched because the finding is measurement-backed, not judgment.*

---

### PF-002 — The permanent gate — the plan's stated point — is wired to nothing

**Dimensions**: 3 (contradiction) · 4 (completeness) · 7 (testability)

`03-01:30` says `jsdoc-examples.spec.test.ts` "drives the harness over fixtures (ST-1…ST-8) **and
runs it for real over the repo**"; `03-01:196` repeats it. `07:40-41` says the opposite: ST-1…ST-8
run over **fixtures**, "**not** over the live repo". `07`'s test-category tables (`:100-101`,
`:106-107`, `:117-122`) contain no live-repo case. No task in `99` creates one — `1.3.1` *generates*
the allowlist as a one-shot step and `1.3.2`/`1.3.3` cross-check and record numbers.

**Failure scenario**: the executor implements exactly what 07 enumerates. Phase 1 closes green with a
harness, fixtures and a committed JSON file that **nothing reads**. FR-1 ("fails the build on any
failure not present in a committed allowlist") and FR-2's ratchet never exist. Phase 2's declared
oracle — `07:17`, "the guard *is* its test" — is absent, so the 53 edits and the four defect fixes
ship unverified while AC-1 reads as satisfied.

There is also an ordering trap in the other direction: if the executor instead follows `03-01:30`
and puts the repo run in the spec file at task **1.1.2**, that file then depends on
`jsdoc-examples.allowlist.json`, which task **1.3.1** creates two steps later — making 1.1.3's
"all **eight** fail" and 1.2.4's "GREEN" both wrong.

**Options**

| # | Option | Assessment |
|---|---|---|
| (a) | Add task **1.3.4** — "wire the standing gate: assert `checkExamples(collectExamples(SHIPPED_ROOTS), readAllowlist())` reports zero `unexpected` and zero `stale`" — give it an ST id (ST-12), name its host file, and reconcile `07:40-41` to "ST-1…ST-8 *specifically* run over fixtures". Ordered after 1.3.1. | Minimal, closes the gap exactly, keeps the fixture oracle's independence from repo state. |
| (b) | Put the live run in `jsdoc-examples.spec.test.ts` at 1.1.2 as `03-01:30` reads, and renumber the red/green expectations. | Makes an immutable spec oracle depend on mutable repo state and on a file created two steps later — the spec file would go red on every unrelated `@example` edit for reasons unrelated to its contract. |

**Recommendation: (a).** It is the smaller edit and it keeps the spec oracle honest: a
fixture-driven contract test and a repo-state gate are different things, and 07 is right to separate
them — 03-01 is the document that should yield.

*Confidence: high. Hardening: independently reported by two of three auditor clusters.*

---

### PF-003 — The measured baseline is an artifact of two harness bugs, and the plan encodes it as an executable stop-rule

**Dimensions**: 2 (assumptions) · 12 (consistency) · 13 (stale assumptions)

`02:6` states "Everything in this document was **measured**". Both headline numbers are wrong, in
ways that were reproduced:

**(i) 451 is a multi-count.** `03-01:84` specifies "For each declaration, take `ts.getJSDocTags(node)`".
That returns the *same* tag for every node the JSDoc binds to — for an `export const`, three nodes
(`VariableStatement` → `VariableDeclaration` → `Identifier`), each with a different `node.name`.
Rebuilding that walk over the seven trees yields **451 attributions but only 393 distinct tags**
(raw `grep -c` = 395). Per package, plan vs. distinct: core 110→**72**, ui 176→**171**, files 20→**18**,
datagrid 108→**98**, theme-designer 20→**17**. The plan's headline number *is* the bug's signature.
Reproduced concretely on `packages/core/src/engine/color/presets.ts:37`, where one tag yields both
`presets.ts::classicTheme` and `presets.ts::(anonymous)` — and `(anonymous)` is produced 15 times in
that one file.

**(ii) 192 was measured with different compiler options than the plan mandates.**
`tsconfig.base.json:8-9` sets `noUnusedLocals` and `noUnusedParameters` to `true`, and `03-01:100-104`
+ task `99:76` mandate "the project's own compiler options resolved from `tsconfig.base.json` — not
hand-rolled ones". Compiling 300 import-less blocks both ways:

| options | failing | per package |
|---|---|---|
| base **minus** `noUnusedLocals` | 160 | ui 93 · web 4 · files 7 · forms 1 |
| base **as written** | 209 | ui 120 · web 11 · files 10 · forms 1 |

The loose row reproduces `02:79-86` **exactly** (ui 93, web 4, files 7, forms 1). So the probe ran
with the check off, and under the mandated options ~56 of the 393 blocks fail on nothing but an
unused local (`dialog/dialog.ts:53`, `scroll/scroller.ts:47`, `controls/input.ts:58`,
`web/src/browser-stubs.ts:45`, …).

**Failure scenario**: task `99:88` instructs the executor — "the real harness should report **fewer**
— if it reports **more**, **stop and investigate**, because the harness is over-reporting." A
*correct* harness reports substantially more. Phase 1 stalls at its own gate, or the executor
"fixes" the harness until it reproduces a number produced by a bug.

**Second consequence**: the AC-6 oracle table (`02:100-112`) is wrong for `spinner.ts:83` — under base
options its first diagnostic is `TS6133`, not the `TS2304 Cannot find name 'app'` the table asserts
and `03-01:130` uses as its worked allowlist example.

**Options**

| # | Option | Assessment |
|---|---|---|
| (a) | Compile with base options **minus** `noUnusedLocals`/`noUnusedParameters`; record that as an AR decision in 03-01; de-duplicate extraction by tag position and resolve the symbol from the outermost owning declaration; re-baseline 02's table to 393; delete the "if more, stop" instruction. | An unused local in a doc snippet is not an API defect — the guard is about correctness of the documented API, and this keeps the recorded baseline meaningful. Keeps 02's failure figures usable. |
| (b) | Keep base options verbatim as the plan mandates; re-baseline 02 entirely from a corrected harness; fix the AC-6 table's `spinner` row; delete the "if more, stop" instruction. | Defensible on the "compiles the way the repo compiles" principle, but adds ~56 permanent allowlist entries whose only content is snippet hygiene, and inflates the drain issue with non-defects. |
| (c) | Drop the counts from 02 entirely; let task 1.3.1 produce the only number that matters. | Cheapest, but loses the pre-execution sanity check the nine-row AC-6 table provides — that table is genuinely useful and was verified correct row-for-row. |

**Recommendation: (a).** It is the only option that makes 02's carefully-built AC-6 oracle survive,
and the `noUnusedLocals` question is an AR-grade decision the plan never noticed it was making. But
this is a maintainer call about what an `@example` *is*, not a mechanical fix — hence the options.

*Confidence: high (both numbers reproduced from the tree). Hardening: the auditor attempted and
documented refutation for each; the multi-count explanation was checked against the one package it
does not fit (web, 11 vs 12) and the discrepancy is separately acknowledged.*

---

## 🟠 MAJOR

### PF-004 — The `file::Symbol` allowlist key is not unique, in a file this plan edits

`packages/ui/src/controls/input.ts:47` and `:58` are **two `@example` tags on the same declaration**
(`export class Input`) — both key to `input.ts::Input`. The first is one of the 53 absolute lines
(task 2.2.2); the second is one of the blocks that fails under base options (PF-003). `03-01:96`
handles only the other case ("two blocks in one file on **different** symbols"), and ST-8 tests
exactly that. Same-symbol duplication is unhandled: allowlisting one grandfathers the other, and
removing one leaves an unsatisfiable `stale` verdict. Structurally the same hazard covers the 39
member-keyed blocks (20 `MethodDeclaration`, 8 `MethodSignature`, 11 `PropertySignature`) — a bare
method name is not file-unique by construction.

**Recommendation**: key as `file::Symbol#N` (ordinal only when >1) and qualify members as
`file::Class.member`; add an ST case for the same-symbol pair. AR-10's rejection of `file#ordinal`
was about *file-wide* ordinals and does not apply to a within-symbol tiebreak.

### PF-005 — Code-only matching blinds the guard to the sweep's single likeliest mistake

`03-01:135` matches allowlisted blocks on error **code**; `03-01:56` records only the **first**
diagnostic. Five of the six blocks the sweep edits that are already allowlisted are grandfathered on
**`TS2304`** (`buttons.ts::cancelButton`/`okCancelButtons`/`yesNoButtons`, `spinner.ts::Spinner`,
`form-dialog.ts::formDialog` — `02:102-108`). A forgotten `at` import in any of them yields
`TS2304 Cannot find name 'at'` — the **same code** → **pass**. `buttons.ts` alone carries 6 of the 53
converted lines. `03-02` §Error handling asserts the opposite outcome ("The guard fails the block on
`TS2304`. This is the primary reason 03-01 is sequenced first") — that claim is false as designed.

**Recommendation**: compare the *set* of diagnostic codes rather than the first, or record
`code + the identifier named in the message` for `TS2304`. Fix 03-02's error table either way.

### PF-006 — `spacer(1)` is a flexible 1fr spacer, not the one-cell gap FR-8 wants

`packages/ui/src/view/dsl/flex.ts:219-225`: `spacer(n)` sets `{ size: { kind: 'fr', weight: n } }`;
the exact-gap form is `spacer({ fixed: n })` — its own JSDoc says so. FR-8's prescribed composition
`col(grow(list), spacer(1), fixed(echo, 1))` (`01:42`, `03-03:104`, `99:186`) therefore gives `list`
1fr and the *gap* 1fr — roughly half the column height each, against `03-03:98`'s stated intent of
"a column with a one-row gap". `paint-smoke` asserts only `paintedCells > 0` and will not catch it.

**Recommendation**: `col(grow(list), spacer({ fixed: 1 }), fixed(echo, 1))` in all three places.

### PF-007 — AC-3's carve-out names files that do not match AC-3's own grep

AC-3 (`01:112-115`) requires `grep -rn "^ \* .*\.layout = " packages/*/src` to return hits "**only**
under `packages/ui/src/layout/` — the engine's own docs (`layout.ts:42-44`, `types.ts:61`)". Measured:
those two locations **do not match that pattern at all** — `layout.ts:42-44` documents `LayoutBox`
literals (`props: { … }`) and `types.ts:61` is a prose default list. The hits that actually survive
the sweep are three prose mentions in `packages/ui/src/view/dsl/`: `absolute.ts:21`, `flex.ts:5`,
`index.ts:4`. AC-3 fails as written at task 2.4.1.

**Recommendation**: restate AC-3's carve-out as `packages/ui/src/view/dsl/` (prose references to the
raw field, in the docs of the builders that replace it) and drop the `layout.ts`/`types.ts` citation.

### PF-008 — The four-defect / allowlist accounting is contradictory in four places

- `02:115` "The last three are FR-6 defects and are **fixed**, so they never enter the allowlist" vs
  task `99:143` "**Remove their three allowlist entries**". Phase 1 generates from the **pre-sweep**
  repo, where all three fail — so they *must* enter at 1.3.1 and leave at 2.3.1. An executor obeying
  `02:115` hand-prunes them, and Phase 1's `yarn verify` goes red with no task authorising a fix.
- `application.ts:275`'s entry is generated at 1.3.1 and **never removed** — task 2.3.2 fixes the
  example and says nothing about the list. 2.4.2's `yarn verify` then hard-fails on a stale entry
  (AR-11) with no covering task.
- Success criterion 7 (`99:243`) — "shrank by **exactly the three** fixed arity defects" — contradicts
  FR-6's four defects and AC-5.
- **No task verifies AC-6** at all; 2.4.1 checks AC-2/AC-3/AC-5 only.
- AR-9 (`00-ambiguity-register.md:25`) says the sweep edits "**9** already-allowlisted blocks"; AC-6,
  `02:115-116` and `03-02:135` all say **six** — and AR-9's own rationale then says six.

**Recommendation**: rewrite `02:115` to "are in the *pre-sweep* allowlist and are removed under FR-6";
amend 2.3.2 to remove `application.ts`'s entry; change criterion 7 to "**four**"; add an AC-6 check
line to 2.4.1; fix AR-9's 9→6.

### PF-009 — `syncOverlayVisible` is not a phantom, and the three-branch rule has no branch for what it actually is

`02:137-139` and `03-02` treat it as a symbol that "was renamed" or "was never public". Measured: it
**exists** at `packages/ui/src/app/application.ts:288`, carries a full public-style JSDoc with its own
`@example`, is exported from `packages/ui/src/app/index.ts:8`, is consumed cross-subsystem by
`packages/ui/dist/menu/controller.js`, and is pinned by a **ui spec test**
(`packages/ui/test/dropdown.seams.spec.test.ts:26`). It is absent from exactly one place: the root
barrel `packages/ui/src/index.ts`, which re-exports only `createApplication` as a value from `./app/`.

So the honest reading is a fourth branch the plan does not offer: **the root-barrel omission is the
defect**, and the example is correct. 03-02's "In no case is a new public export added" would then
enshrine a barrel bug rather than fix it. Note `packages/docs-site/test/api-barrel-exports.spec.test.ts`
exists precisely to reason about barrel completeness, and `check-jsdoc.mjs` already demanded an
`@example` on this symbol.

**Recommendation**: add branch (0) to 03-02 — "if the symbol is exported from its subsystem barrel and
merely missing from the root barrel, that is a barrel defect; surface it and let the maintainer rule
whether to export it here or file it". Do not pre-commit "no new public export" for a case that is a
one-line omission rather than API growth. This is a maintainer call, which is why it is a finding and
not a fix.

### PF-010 — The "five unedited suites" regression net is one suite deep

`03-03:145` calls the five suites "the witness for FR-7/FR-8". Measured against the code:

| Suite | What it actually does |
|---|---|
| `paint-smoke.spec.test.ts` | Builds all examples at 80×24, asserts `paintedCells > 0` — **liveness only** (`:43`) |
| `dialog-reopen.spec.test.ts` | 2 of 7 examples, structural |
| `a11y.spec.test.ts` | Asserts `PlayExample.vue` contains `aria-label` and each id has a `.md` page (`:34-47`) — **builds no example** |
| `no-keyboard.spec.test.ts` | Three pure functions over a `matchMedia` stub (`:13-31`) — **builds no example** |
| `deep-link.impl.test.ts` | Hard-coded `IDS` array (`:9`) — **imports no example** |
| `file-dialog.spec.test.ts` | Imports only `HOME`/`seedFs`; constructs its own `FileDialog` (`:14`) — the example's `build()`, which holds the `at()` call sites, is **never invoked** |

The one genuine behavioural change in the plan — replace→merge across 38 call sites — ships behind a
net that is one liveness check plus two structural cases. The exact hazard `03-03:80-82` flags (a
merge-preserved `padding` shifting a child by one cell) is caught by nothing.

Also inconsistent: `07:11`/`03-03:130`/AC-7 say **five**; `07:117-122` enumerates **seven** (adding
`no-keyboard` and `snippet-drift`), and `07:124` binds the `git diff` contract to "these".

**Recommendation**: restate what each suite guards, fix five/seven, and **promote task 3.4.1's
rendered before/after from "tiebreak" to the primary control** — `07:131` already half-concedes this.
That is the honest net, and it is adequate; the defect is believing it is five-deep.

### PF-011 — The guard's roots are specified three ways, and they disagree

- FR-1 (`01:21-24`): "`packages/*/src/**/*.ts` across the seven shipped packages" — that glob also
  matches `packages/docs-site/src` (12 tags) and `packages/spike-data-studio/src` (2), the latter a
  package CLAUDE.md describes as "delete after the Data Studio decision".
- `03-01:83`: the seven-package enumeration.
- `packages/docs-site/src/api/packages.mjs`: the docs-site's **own** established boundary is four —
  "The four documented packages", core/ui/files/web — which is exactly docs-site's devDependency set.

Two consequences beyond the ambiguity: `theme-designer` is an **app**, not a shipped package (CLAUDE.md
scopes the JSDoc directive to shipped source), it has **no `build` script** and therefore no `dist`,
and all 17 of its blocks become permanent allowlist entries. And `datagrid`/`forms`/`theme-designer`
are **not docs-site devDependencies**, so `turbo`'s `^build` for `docs-site#test` does not order their
builds before the guard runs — under `turbo run typecheck build test` those builds are concurrent,
making the guard's result (and the committed allowlist) build-order dependent.

**Recommendation**: pick one root list explicitly, state it in FR-1 as an enumeration rather than a
glob, and add whatever packages survive to `packages/docs-site/package.json` devDependencies so the
build graph orders them. Dropping `theme-designer` and `spike-data-studio` is the cheap correct call;
whether `datagrid`/`forms` are in is a maintainer choice (they are shipped, so probably yes — which
means the devDependency edit is required).

### PF-012 — Verdict row 6 has no ST case, against an explicit "every row" bar

`03-01:130-137` has six verdict rows. Mapping 07's cases: ST-1→1, ST-2→2, ST-3→3, ST-5→4, ST-4→5;
ST-6/7/8 cover fences, relative imports and two-symbol files. **Row 6 — "allowlist entry naming a
file/symbol that no longer exists → fail as stale" — is uncovered**, while `07:24-27` sets the
substitute-for-coverage bar as "**every** verdict row in 03-01 has a spec case" and `03-01:192-193`
claims ST-1…ST-8 are "the six verdict rows above plus fence handling and relative-import resolution"
(5 + 3 = 8, not 6 + 3). Row 6 is the path that fires after every rename or file move; unpinned, a
harness that silently skips unmatched keys passes all eight cases and the list accrues dead weight —
precisely what AR-11 exists to prevent.

**Recommendation**: add ST-12 (allowlist entry keyed to a fixture file/symbol that does not exist →
appears in `stale`).

---

## 🟡 MINOR

| # | Finding | Evidence |
|---|---|---|
| PF-013 | Extraction handles fences and nothing else; four real blocks fail at syntax level. `packages/datagrid/src/format.ts:27` contains a JSDoc-escaped `*\/` that `getTextOfJSDocComment` emits verbatim → `TS1010` (an **extraction defect** — un-escape it). `core/engine/capability/index.ts:75,123` use a literal `{ ... }` elision (`TS1128`) and `datagrid/src/validation.ts:83` a top-level `return` (`TS1108`) — legitimate idioms that become permanent entries; say so in FR-9/AC-10 so the drain issue isn't written as if every entry is fixable | measured |
| PF-014 | Two guard runs can execute concurrently **inside one vitest project**: `include: ['test/**/*.{spec,impl}.test.ts']` with no `fileParallelism: false`, and the plan puts a live run in the spec file, harness runs in the impl file, and AC-9's forced-failure run. A glob-based cleanup in run A would unlink run B's files mid-`createProgram`. Distinct from PF-001's turbo race. Mandate exact-path unlinks, never a glob | `packages/docs-site/vitest.config.ts` |
| PF-015 | AR-12's *(measured)* fence claim is wrong in both directions: actual leading-fence counts are datagrid 85, **ui 8** (`controls/measure.ts:31,66`, `table/columns.ts:63,115,182,216`, `table/grid-rows.ts:78,359`), forms 2, **theme-designer 0**. Harmless if stripping is unconditional; dangerous if an executor scopes it by package as the AR implies | `00-ambiguity-register.md:28`, `03-01:88` |
| PF-016 | `(anonymous)` is a live deterministic case, not a safety net: `packages/files/src/fs/node-fs.ts:9` carries an `@example` on the file's leading comment, which TS binds to the first `ImportDeclaration`. `03-01:182` says the line number disambiguates — but the line is deliberately **not** part of the key (AR-10), so two anonymous blocks in one file are indistinguishable. Fall back to `::(anonymous)#N` | measured |
| PF-017 | FR-8 does the one thing AR-4 declares out of scope — converting a docs-site absolute canvas (`Group` + `WIDTH×HEIGHT` + three `at()` rects) to `col`/`row` composition. Both rows were maintainer-decided and are never reconciled; #129's executor will find one canvas already converted. Carve `list-box.ts` out of AR-4 by name, or move FR-8 to #129 | `01` §Won't Have vs `03-03` §FR-8 |
| PF-018 | ST-6/7/8 are phrased over fixture *files* but 1.1.2 and `07:40` scope them to `checkExamples(blocks, allowlist)`. If the test hand-builds `ExampleBlock[]`, ST-6 asserts nothing (the body it supplies is already stripped) and ST-8 never touches the symbol resolver. Restate as `checkExamples(collectExamples([fixtureRoots]), allowlist)` | `99:63`, `07:40` |
| PF-019 | The "cleanup after the harness throws mid-run" impl case (`07:107`, `99:99`) has no fault-injection seam — the published API is `collectExamples(roots)` / `checkExamples(blocks, allowlist)`, no fs/host injection. Writable with ingenuity (a poisoned block path), but the route should be named | `03-01:73-74` |
| PF-020 | Task 3.3.1 adds an `at` import to **each** of the seven files; 3.3.2 then removes all three of `list-box.ts`'s `at()` calls, leaving an unused import that success criterion 4 forbids. 3.3.2's own verify fails on it | `99:185-186` |
| PF-021 | `03-02:80-83` lists nine files "carrying more than one" absolute line; there are **ten** — `packages/forms/src/form-dialog.ts` (2) is missing. Task 2.2.8 does count it, so this bites only an executor using 03-02 as the worklist | measured |
| PF-022 | "38 call sites" is reused for the post-conversion state (`07:18`, `07:119`, `03-03:150`), but FR-8 deletes three of them — **35** remain after the sweep | `03-03:11,52` |
| PF-023 | FR-8 (`01:42-43`) omits the `cover()` that `03-03:109-112` calls mandatory ("getting this wrong collapses the example to nothing"). Requirements are what an executor implements against | — |
| PF-024 | `03-02:118` says to "add `resolveCapabilities` to its `@jsvision/core` import" — `tree.ts:67` and `tab-view.ts:178` have **no `@jsvision/core` import line**, and the repo does it both ways (`group.ts:39` from core, `datagrid/src/grid.ts:274` from ui, both legal since `ui/src/index.ts:20` re-exports it). Pick one idiom; the guard cannot arbitrate | measured |
| PF-025 | The "sibling to copy" for the arity fix documents a **different function**: `group.ts:57-58` is `createRenderRoot`, not `createEventLoop`. Real `createEventLoop` siblings exist and are uncited (`dialog/dialog.ts:72`, `dialog/buttons.ts:29`). The prescribed fix itself is correct — `event/types.ts:37-39` confirms `caps` is the only required option | `02:133`, `03-02:110` |
| PF-026 | The allowlist entry value's format is under-specified for a committed contract file: `03-01:123-128` shows a single string (`"TS2304 Cannot find name 'dialog'"`) while `:139-142` matches on code only and `ExampleFailure.code` is a `number` — so the harness must parse the code back out, which is never stated. FR-9 reads equally well as `{ "code": 2304, "message": "…" }` | — |
| PF-027 | `Text` **does** have `measure()` (`packages/ui/src/controls/text.ts:91`); `03-03:119`'s stated rationale for `fixed(echo, 1)` is false. The conclusion still holds — `fixed` is right here — but the reasoning was carried over from a note about `Label`/`Input`/`CheckGroup`/`History`, which genuinely lack it | measured |
| PF-028 | Stale task references and an off-by-one line-ref cluster: `03-01:197` and `03-02:135` credit allowlist generation to task **1.3.3** (it is 1.3.1); `02:190` credits the wall-clock to **1.4.2** (it is 1.3.3). All seven shadow-helper lines in `03-03:34-40` are +1 (real: `list-box.ts:45`, `button.ts:14`, `input.ts:15`, `form-dialog.ts:28`, `file-dialog.ts:16`, `table/data-grid.ts:35`, `preset-gallery.ts:12`); `03-02:43`'s "group.ts:44-58" starts at a closing brace; `03-02:64`'s "indicator.ts:35-43" starts mid-body; `02:22`'s api-extract `:196` is `:195`. Individually trivial, collectively they make the plan's refs untrustworthy as navigation for a mechanical sweep | measured |
| PF-029 | AR-7's load-bearing rationale — "It is **the one** package listing `typescript` as a direct devDep" — is false: core, ui, files, forms, datagrid and docs-site all list it. The **decision** still stands on its other two legs (Linux-only via `verify:shipped`, already depends on built `@jsvision/*`), but the recorded reason is wrong | measured |
| PF-030 | AR-8 records that `yarn verify` is "the verify command behind **every** task's Verify line"; `99:67` and `99:80` use `yarn workspace @jsvision/docs-site test`. Defensible as an inner-loop shortcut — but then AR-8's text is wrong as recorded | — |
| PF-031 | `02:44-47` — "returns eight hits, **six** of which are prose" — enumerates only four (`flex.ts:110,130`, `types.ts:61`, `button-row.ts:60`). The arithmetic only closes if the two subject blocks (`group.ts:47`, `indicator.ts:38`) are counted, which would put the paragraph's own subject outside its own sweep | measured |
| PF-032 | The harness module's own file path is never named — not in `00-index` §Related Files, not in any task deliverable. Tasks 1.2.1–1.2.3 say "implement `collectExamples()`" with no home. The repo's own precedent is unambiguous: the analogous machinery lives in `packages/docs-site/src/api/*.mjs` with its oracle in `test/` — and `src/` is typechecked while `test/` is **not** (`packages/docs-site/tsconfig.json` includes only `examples/**` and `src/**`) | — |

---

## 🔵 OBSERVATIONS

| # | Observation |
|---|---|
| PF-033 | Phase 3's serialization rationale (`99:222-229`) — "so the allowlist is not being regenerated while a second surface is moving" — describes an interaction that cannot occur: Phase 3 edits `packages/docs-site/examples/**`, outside the guard's roots and outside `packages/*/src` entirely, and cannot affect a single allowlist entry. Serializing may still be right for review hygiene; the stated reason is not the reason |
| PF-034 | ST-9's "Import `at` as `list-box.ts` does" (`07:77`) is a forward reference — the spec test is written at 3.2.1, *before* 3.3.1, when `list-box.ts:45` still declares the **shadow**. An executor reading it literally could copy the shadow's replace semantics into the oracle, which is exactly the mis-decode ST-10 exists to prevent. Say "import `at` from `@jsvision/ui`" |
| PF-035 | AR-7's strongest evidence goes uncited: `packages/docs-site/test/api-barrel-exports.spec.test.ts` **already** builds a full `ts.createProgram` in this package, and `vitest.config.ts` already carries a 60 s timeout with a comment explaining exactly this cost. Measured guard cost is ~1.9 s for 300 blocks against the full `@jsvision/*` typings, so `02:190`'s timeout risk is comfortable |

---

## Verified clean — checked and correct

Recorded so a later reader does not re-derive them:

- **The 53-line / 37-file decomposition.** Re-counted independently by the lead and two auditors:
  `grep -rn "^ \* .*\.layout = .*position: 'absolute'" packages/*/src` → 53 hits / 37 files, and tasks
  2.2.1–2.2.8 partition them **exactly**, per-file counts matching the repo file-for-file. Nothing
  omitted, nothing double-counted.
- **The `split-view` handling.** FR-5 correctly targets `:109` and correctly holds out `:103` (a
  `SplitView` constructor option, not a layout prop).
- **The 2.2.6-before-2.3.1 ordering** for the three files that carry both an absolute line and an
  arity defect — the one real ordering trap in Phase 2, and it is handled explicitly.
- **The FR-6 fix itself.** `event/types.ts:37-39` confirms `caps` is the only required
  `EventLoopOptions` member, so `createEventLoop(viewport, { caps })` is correct.
- **The nine-row AC-6 failure table** (`02:100-113`) — all nine `file::Symbol::line` triples verified
  against the sources (subject to PF-003's `spinner` caveat).
- **The plugin-snapshot claim.** `gen-plugin-api.mjs:131-135` emits lead sentence + signature only,
  so editing an `@example` body does **not** drift the committed API-ref snapshot. The plan is right
  to omit a `plugin:sync --fix` task.
- **`at()`'s merge semantics** (`absolute.ts:42-50` → `setLayout` → `invalidateLayout`), the
  `padding`-is-the-only-load-bearing-preserved-prop analysis (`layout.ts:94`, `:137-147`), and the
  ST-9…ST-11 writability (`view.ts:73` initializes `layout` to `{}`; `view.host` is a public field).
- **AR numbering** AR-1…AR-13, no gaps, every cross-reference in the 03-docs resolves.
- **39-task arithmetic** (13+15+8+3) and every per-step task count.
- **Refuted hypotheses** (checked, not defects): global-scope collisions between scratch files
  (every package is `type: module`, so each is a module — confirmed by experiment); top-level `await`
  in 37 blocks (compiles under ESM + ES2022); `{@link}` mangling, unterminated fences, non-`ts`
  fences, empty bodies, JSX (all zero); allowlist entries for files the plan deletes (it deletes no
  file under `packages/*/src`).

---

## Verdict

✅ **PREFLIGHT PASSED** — 35 findings, 35 resolved. The maintainer ruled on the three criticals and
the `syncOverlayVisible` API question and accepted the recorded recommendation for the remainder;
every fix is applied to the plan documents.

**Rulings taken** (2026-07-20):

| Finding | Ruling |
|---|---|
| PF-001 | **In-memory `ts.CompilerHost`** — the harness writes nothing. Recorded as AR-16 |
| PF-003 | **Base options minus `noUnusedLocals`/`noUnusedParameters`**, baseline re-derived, stop-rule deleted. Recorded as AR-14 |
| PF-009 | **Add a fourth branch** — a root-barrel omission is surfaced for a maintainer ruling, not pre-judged. No public export is added unilaterally |
| Remainder | Apply the recommendation recorded against each finding |

**What changed in the plan:** three new AR rows (AR-14/15/16) and seven amended (AR-4/7/8/9/10/12/13);
one new requirement (FR-1a, the standing gate); three new spec cases (ST-12 the repo gate, ST-13
verdict row 6, ST-14 the same-symbol key collision); two new tasks (1.2.4 docs-site devDependencies,
1.3.4 wire the gate) taking the plan from 39 to 41; and corrections to AC-1/3/6/7/9, the measured
baseline, the regression-net claims, and the `spacer({ fixed: 1 })` prescription.

### Original verdict (iteration 1, before rulings)

❌ **PREFLIGHT BLOCKED** — 3 critical and 9 major findings unresolved.

The plan is unusually well built at the level it was checked: the sweep decomposition is exact, the
ordering traps are handled, the AR register is complete and the "verified clean" list above is long.
What it did not do is validate the *harness* premises — and every critical finding lives there. The
guard is the plan's own stated point ("The guard is the point", `00-index:31`); as specified it does
not run over the repo, its baseline is an artifact of two bugs in its own extraction spec, and its
scratch-file mechanism is unsafe. Those are fixable on paper before a line is written, which is
exactly what this gate is for.
