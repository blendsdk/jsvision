# Requirements — setlayout-primitive

> **Source**: GitHub [#117](https://github.com/blendsdk/jsvision/issues/117) · sibling of the
> builder-layer work in #113; **outside** the RD-01 deliberate-divergence set — this plan is
> behaviour-preserving except for one named, ruled-on exception (FR-4).

## Functional requirements

**FR-1 — `View.setLayout(patch)` exists and is the preferred write path.** A single method taking a
`Partial<LayoutProps>`, performing a **shallow** merge into the existing props and requesting a
reflow. One method only: no `setLayout(full)` replace variant, which would re-expose the very
footgun being removed.

**FR-2 — the merge is shallow, by design, and must stay that way.** `LayoutProps.size` is a
discriminated union (`{kind:'fixed',cells} | {kind:'fr',weight,min?} | {kind:'auto'}`). A deep merge
would recurse into it and leave the previous variant's fields behind — switching `fixed`→`fr` would
yield the corrupt token `{kind:'fr', weight:1, cells:1}`. Shallow merge swaps `size`/`rect`
atomically. Pinned by ST-S2, which exists to fail if anyone ever "improves" this to a deep merge.

**FR-3 — the `layout` field stays a plain, public, settable field.** No getter, no `_layout` backing
store (AR-7). Its JSDoc names `setLayout` as the preferred way to write, in prose, without an
`@deprecated` tag (AR-6). The 24 read sites are untouched.

**FR-4 — the DSL builders write through `setLayout`, and thereby gain auto-invalidation.** All 13
sites in `dsl/absolute.ts`, `dsl/flex.ts` and `dsl/stack.ts` ([02 §2](02-current-state.md)). This is
the plan's **one deliberate behaviour change** (AR-5): a tagger applied to an already-mounted view
now requests a reflow where today it silently does not. Treated as a latent bug fix, not a
regression — `filter-popup.ts:285` is the only site that exercises it.

**FR-5 — the 7 self-layout sites migrate.** [02 §3](02-current-state.md). Four are already spreads
and convert mechanically; two sit on `Group` subclasses where replace and merge are indistinguishable;
one (`dialog.ts:109`) starts from a non-empty object and is safe for a traced reason, not an assumed
one ([02 §4](02-current-state.md)).

**FR-6 — every migrated site is audited for replace-dependence before it converts (P3).** For each
site the question is *"does anything downstream depend on the replace having cleared a prop?"*, and
the answer is recorded with its reasoning in [03-02 §audit](03-02-migration.md) (AR-8). A site whose
answer is "yes" does **not** convert — it stays a wholesale assignment with a plain-language comment,
exactly as this feature's earlier plans handled their preserved sites.

## Non-functional requirements

**NFR-1 — no rendered output changes.** Beyond FR-4's extra reflow *requests* (which coalesce into
the same frame), every converted site must produce byte-identical layout. Any movement is a
transcription error, not a re-derivation.

**NFR-2 — spec-first.** `setLayout`'s contract is specified and red before it is implemented. The
merge/shallow/invalidate behaviours are oracles derived from FR-1/FR-2/FR-4, never from the
implementation that ends up satisfying them.

**NFR-3 — no measurable layout-pass cost.** `setLayout` allocates one object per call, exactly as
the spread it replaces did. Invalidation is a flag write into a coalescing scheduler
([02 §1](02-current-state.md)), so per-call invalidation inside `stack.ts`'s loop adds no reflow.
`yarn bench` is informational and never gates, but a visible regression there stops the phase.

**NFR-4 — zero regression, verify-green per phase.** `TUI_SKIP_PERF=1 yarn verify && yarn workspace
@jsvision/examples test:e2e` green at every phase boundary (AR-4); `yarn check:deps` green.

**NFR-5 — the public API surface stays coherent.** `setLayout` is exported behaviour on a public
class, so it carries JSDoc with an `@example` and passes `yarn check:docs`. Editing `View`'s JSDoc
drifts the committed plugin API-reference snapshot — `yarn plugin:sync --fix` is part of the work,
not an afterthought.

**NFR-6 — scope containment.** No file outside `packages/{ui,forms,datagrid}/src` is touched.
`packages/spike-data-studio` is explicitly excluded (AR-9).

## Acceptance criteria

| # | Criterion | Oracle |
|---|-----------|--------|
| AC-1 | `setLayout(patch)` merges shallowly and requests a reflow | ST-S1, ST-S2, ST-S3, ST-S4 |
| AC-2 | All 13 DSL sites write through `setLayout` | grep audit · ST-S6 |
| AC-3 | A tagger on a mounted view requests a reflow | ST-S5 |
| AC-4 | All 7 self-layout sites converted, or preserved with a recorded reason (FR-6) | grep audit · 03-02 §audit |
| AC-5 | Every site's replace-dependence is recorded with reasoning before it converts | 03-02 §audit — one row per site, no blanks |
| AC-6 | Rendered output unchanged | ST-S7, ST-S8 + the adoption plans' existing suites |
| AC-7 | `TUI_SKIP_PERF=1 yarn verify` **and** the examples e2e green at every phase boundary | verify log |
| AC-8 | `layout` remains a settable public field; the 11 field initializers still compile | `yarn typecheck` |
| AC-9 | No file under `packages/spike-data-studio` or another package's `src/` touched | `git diff --stat` |
| AC-10 | The plugin API-reference snapshot is in sync | `yarn verify` (check-plugin) |

## Explicitly out of scope

- **P4 — making `layout` read-only** (AR-1). Blocked on the ~118 remaining composition writes
  (#110's remainder, #112, #114), on a solution for the 11 field initializers, and on
  `spike-data-studio` being deleted or migrated. Recorded as a follow-on with its preconditions
  named, so the next planner does not rediscover them.
- **The ~118 composition writes** (AR-2) — owned by the open adoption issues.
- **The 11 `override layout` field initializers** (AR-3) — left declarative.
