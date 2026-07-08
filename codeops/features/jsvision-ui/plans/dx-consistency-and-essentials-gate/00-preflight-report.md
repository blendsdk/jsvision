# Preflight Report: DX consistency & essentials gate

> **Status**: ✅ PASSED — all 4 findings resolved (user accepted every recommendation) and applied
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/dx-consistency-and-essentials-gate/`
> **Codebase Grounded**: 10 source files examined, all document references verified
> **Last Updated**: 2026-07-08
>
> ℹ️ Not same-session: the plan was authored 2026-07-08 in a prior session; this scan runs in a
> fresh context. Same-agent-lineage bias risk is mild but non-zero — findings below were verified
> against live source, not from the plan's own claims.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest. Zero
runtime deps. `@jsvision/core` (published engine) + `@jsvision/ui` (private widget framework).
**Architecture:** Retained widget tree (`View`/`Group`) + Solid-style signals; controls extend a
`Cluster`/`View` base; options-object constructors are the dominant idiom. `run()` connects the event
loop to a native tty host; `createApplication` assembles the loop + desktop + chrome and builds the
`RunContext` passed to `runApplication`.
**Key Files Examined:** `controls/radio-group.ts`, `controls/check-group.ts`,
`controls/multi-check-group.ts`, `color/color-swatch.ts`, `color/color-picker.ts`, `app/run.ts`,
`app/application.ts`, `core/engine/safety/essentials.ts`, `core/engine/host/streams.ts`, `index.ts`
(barrel).

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 (PF-001) | 🟠 |
| 2 | Implicit Assumptions | 1 (PF-003) | 🟡 |
| 3 | Logical Contradictions | 1 (PF-001) | 🟠 |
| 4 | Completeness Gaps | 2 (PF-001, PF-004) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-003) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 (PF-002) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-002, PF-003, PF-004) | 🟡 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 1 | ✅ resolved + applied |
| MINOR | 3 | ✅ resolved + applied |
| OBSERVATION | 0 | — |

---

### PF-001: ColorPicker callback taxonomy is under-specified — spec drops the picker's own `onChange` and omits `onInput`, contradicting ST-5 🟠 MAJOR

**Dimension:** Completeness Gaps / Logical Contradictions / Ambiguities
**Location:** `03-01-callback-and-constructor-normalization.md` §B "ColorPicker" (lines 77–84);
`01-requirements.md` FR-5; `07-testing-strategy.md` ST-5.
**Codebase Evidence:** `packages/ui/src/color/color-picker.ts:169` (`onChange` = "Fired when `value`
changes" — **live** today), `:214` (`this.onChange = opts.onChange`), `:258-265` (the swatch is
created with **two** hooks: `onChange: this.onChange` at `:263` forwarding the picker's live callback,
and `onCommit: () => commit()` at `:264` closing the popup).

**The Problem:** Today the ColorPicker forwards its live callback to the swatch (`onChange:
this.onChange`, :263) **and** closes the popup on commit (`onCommit: () => commit()`, :264) — two
distinct hooks. The plan's §B gives one concrete replacement: `onChange: () => commit()` ("was
`onCommit`"). Followed literally this:

1. **Drops `this.onChange` forwarding** → `ColorPickerOptions.onChange` (a public callback) becomes
   dead: stored at :214, never fired. Silent breakage of a public API.
2. **Adds no `onInput`** to `ColorPickerOptions` and wires none — yet **ST-5** asserts the *picker*
   fires `onInput` on arrow (popup open) and `onChange` on Enter (popup closes). ST-5 cannot pass
   against the spec as written. (ST-5's "fires `onInput`" is also ambiguous: the picker's callback or
   the inner swatch's? The spec never resolves it.)
3. **Silently flips `ColorPicker.onChange` semantics** live→commit without FR-5 / the `:169` JSDoc
   ("Fired when `value` changes") acknowledging the change.

Mitigating fact: no example/demo currently consumes `ColorPicker`'s `onChange` (repo grep found none),
so this is a spec-completeness and spec-vs-oracle contradiction, not a silent break of a live consumer.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A (recommended) | Specify the full ColorPicker wiring: add `onInput?` to `ColorPickerOptions`, keep `onChange?` (now **commit** semantics); create the swatch with `onInput: this.onInput` and `onChange: (c) => { this.onChange?.(c); commit(); }`; update the `:169` JSDoc to "fired on commit". | Matches FR-5 + ST-5 exactly; no dead callback; symmetric with the ColorSwatch split | Slightly more spec text; one extra public field |
| B | Drop `onInput`/`onChange` from `ColorPicker`'s public options entirely (popup-close only), and rewrite ST-5 to observe the inner **swatch's** callbacks, not the picker's. | Smallest surface | ColorPicker loses its value callback (a real DX regression on a "DX consistency" plan); rewriting an ST oracle needs its own justification |
| C | Keep only `onChange` on `ColorPicker` (commit), wire `onChange: (c) => { this.onChange?.(c); commit(); }`, drop `onInput` and delete ST-5's `onInput` clause. | Minimal new surface; still fixes the dead-callback bug | Asymmetric with ColorSwatch (has `onInput`); ST-5 still needs an edit |

**Recommendation:** Option A — it is the only resolution consistent with **both** FR-5 ("forwards the
same `onInput`/`onChange` split") and ST-5 as written, and it removes the dead-callback defect. B and C
both require editing the ST-5 oracle, which the plan otherwise treats as immutable.
*Confidence: High. Hardening: verified line-by-line against `color-picker.ts:258-265`; advisor
challenger was unavailable, self-reconciled against ST-5's literal text.*

**User Decision:** Resolved — User accepted recommendation. Option A — full ColorPicker wiring (`onInput?` added, `onChange` = commit, swatch forwards both). Applied to 03-01 §B, FR-5, 02-current-state, ST-5.

---

### PF-002: FR-3 misstates `MultiCheckGroupOptions` (uses `items`, not `labels`) and the chosen `labels` key leaves sibling controls inconsistent 🟡 MINOR

**Dimension:** Consistency / Codebase Alignment (Stale Assumption)
**Location:** `01-requirements.md` FR-3; `03-01-...md` §A.
**Codebase Evidence:** `packages/ui/src/controls/multi-check-group.ts:12-19` —
`MultiCheckGroupOptions { readonly items; readonly states; readonly value }`. The key is **`items`**,
not `labels`.

**The Problem:** FR-3 says the new options mirror "the existing `MultiCheckGroupOptions` shape
(`readonly labels`, `readonly value`)" — but `MultiCheckGroupOptions` has no `labels` field; it uses
`items`. The plan then (correctly, per the controls' `labels` param convention) specifies
`RadioGroupOptions`/`CheckGroupOptions` with `readonly labels`. Net result: three sibling cluster
controls end up split — `MultiCheckGroup({ items })` vs `CheckGroup({ labels })` / `RadioGroup({
labels })`. For a plan whose thesis is *API-shape consistency*, shipping that divergence is worth a
conscious decision, not an accident.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A (recommended) | Keep `labels` for the new options; **fix FR-3's wording** to "mirroring the `readonly …; readonly value` pattern of `MultiCheckGroupOptions` (its list key is `items`)". Accept the `items`/`labels` divergence as out of scope. | `labels` matches the controls' own param names + domain language; no extra breaking change; corrects the factual error | Sibling inconsistency persists (documented, not fixed) |
| B | Also rename `MultiCheckGroupOptions.items` → `labels` (+ its `super(opts.items)` and call sites) for true tri-control consistency. | Achieves the plan's own consistency goal fully; cheap and safe pre-release | Expands scope past AR-4 ("MultiCheckGroup already takes an options type"); another breaking rename + call-site sweep |

**Recommendation:** Option A — the factual error must be fixed regardless; `labels` is the right key
for Radio/CheckGroup (it matches their existing parameter naming). B is a legitimate consistency win
and is genuinely low-cost pre-release, so flag it for the user, but it exceeds the register's stated
scope (AR-4).

**User Decision:** Resolved — User accepted recommendation. Option A — keep `labels`; FR-3 wording corrected (MultiCheckGroupOptions uses `items`; divergence accepted per AR-4). Applied to FR-3.

---

### PF-003: The essentials-gate docs frame the throw as "output piped to a file" — the `/dev/tty` fallback makes that inaccurate 🟡 MINOR

**Dimension:** Implicit Assumptions / Edge Cases / Codebase Alignment (Stale Assumption)
**Location:** `00-index.md` (P7 bullet, "output piped to a file"); `01-requirements.md` FR-7 ("a
non-TTY start … (e.g. output piped to a file)"); `03-02-essentials-gate.md` line 14 (the shipped
JSDoc text).
**Codebase Evidence:** `packages/core/src/engine/host/streams.ts:95-114` (`resolveStreams`): when
streams are **not injected**, `preferDevTty !== false`, the platform is POSIX, and `process.stdout`
is not a TTY, it opens `/dev/tty` (`:101-103`) and returns `isTTY: true` if a controlling terminal
exists. `detectTty` (`:144`) runs exactly this path. AR-3 calls `detectTty({ input: ctx.input, output:
ctx.output })`; on a default run those are `undefined`, so `injected` is `false` and the `/dev/tty`
fallback **is** taken.

**The Problem:** Running `myapp > out.txt` from an interactive shell pipes stdout but a controlling
terminal still exists → `detectTty` returns `true` → the gate does **not** throw, and the host binds
`/dev/tty` and runs normally (this is intended host behavior). So "output piped to a file" is *not*
the throw trigger. The real trigger is **no controlling terminal at all** (e.g. a cron job, a CI
runner, a container with no tty, or stdin+stdout both redirected with no `/dev/tty`). Because the
JSDoc directive is NON-NEGOTIABLE and requires accurate `@example`s, shipping the "piped to a file"
framing would put an inaccurate statement in a public doc.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A (recommended) | Reword the P7 docs/JSDoc throw-trigger to the accurate condition — e.g. "on a non-interactive launch with no controlling terminal (a cron/CI job, or stdin **and** stdout redirected with no `/dev/tty`)". Keep the `/dev/tty`-backed piped case as a *non*-throwing example if useful. | Accurate shipped docs; honors the JSDoc directive; teaches the real seam | A touch more nuance in the doc |
| B | Leave the wording; add a one-line plan note that `/dev/tty` may satisfy the gate under piped output. | Least churn | Ships a doc example that misrepresents behavior — violates the JSDoc-accuracy rule |

**Recommendation:** Option A — the gate's runtime behavior is correct and needs no code change; only
the *description* must match `streams.ts`. Since the plan will emit this as public JSDoc under a
NON-NEGOTIABLE accuracy directive, fix the wording in `03-02` (and the FR-7 / `00-index` echoes) now.

**User Decision:** Resolved — User accepted recommendation. Option A — throw condition reworded to "no interactive terminal at all" with the `/dev/tty` caveat. Applied to 00-index, FR-7, 03-02 (option JSDoc + gate note).

---

### PF-004: `02-current-state` under-catalogs the `onCommit` blast radius in `color-swatch.spec.test.ts` 🟡 MINOR

**Dimension:** Completeness Gaps / Codebase Alignment (Impact Blindness)
**Location:** `02-current-state.md` §P6.b "Blast radius (`onCommit:` outside color source)" — lists
only `color-swatch.spec.test.ts:68`.
**Codebase Evidence:** `packages/ui/test/color-swatch.spec.test.ts:62` (`const commits: Color[]`), `:68`
(`onCommit: (c) => commits.push(c)` in the `makeSwatch` helper), `:155`
(`expect(h.commits.at(-1), 'onCommit fired with the committed color')…`). The rename touches the
helper's collector field, the `h.commits` accessor, and at least one assertion **message** — more than
the single `:68` line the catalog names.

**The Problem:** The catalog understates the spec-test edit surface. It's low-risk (AR-5 already
authorizes updating these spec call sites, and ST-4 explicitly supersedes the `:68` assertion), but an
incomplete current-state map is exactly what causes a migration task (Phase 1.4) to miss a site and
leave a stale `onCommit` reference that ST-6's grep oracle would then fail on.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A (recommended) | Update `02-current-state` §P6.b to name all `onCommit` sites in `color-swatch.spec.test.ts` (the `commits` collector at :62/:68 and the assertion at :155), noting the assertion *message* is cosmetic while the *behavior* assertion is preserved (AR-5). | Accurate map; de-risks the ST-6 grep gate | Doc-only edit |
| B | Leave as-is; rely on ST-6's repo grep to catch any missed site during execution. | No doc churn | Trades a known gap for a red-bar discovery mid-execution |

**Recommendation:** Option A — a one-line catalog fix now is cheaper than a failed ST-6 grep later; the
plan already leans on `02-current-state` as the authoritative migration checklist for Phase 1.4.

**User Decision:** Resolved — User accepted recommendation. Option A — onCommit/onChange catalog completed (`:62`/`:68`/`:155` + ColorPicker forwards). Applied to 02-current-state §P6.b.

---

## Adversarial-checklist notes

- **Positional-constructor blast radius (P6.a): verified complete and accurate.** A repo-wide grep of
  `new RadioGroup(`/`new CheckGroup(` matched exactly the source/example/impl-test/spec-test sites
  `02-current-state` lists (dialogs.ts:66/117; controls-demo:87/88; controls-live:63/64;
  kitchen-sink checkgroup:19/radiogroup:21; accelerator-reveal.impl:45/93/94; controls.cluster.impl
  :37/46/54/62/73; controls.hardening.impl:133; controls.cluster.spec:44/73; controls.focus.spec
  :26/27; controls.hardening.spec:64). No missed site.
- **Core surface (NFR-1): verified.** `assertEssentials` (essentials.ts:139), `detectTty`
  (streams.ts:144), `EssentialsNotMetError` are all already exported from `core/engine/index.ts`
  (:123/:87/:125). Zero new core surface is accurate.
- **`run.ts` line anchors: verified.** `RunContext` :33-50, host creation :66, `await host.start()`
  :122 — all match; the gate's "immediately before :122" insertion point is valid, and `RunContext`
  is assembled in `application.ts:269-279` (the correct threading point for `requireTty`).
- **Headless opt-out mechanism (AR-3): sound.** With injected fake streams `resolveStreams` sets
  `injected=true`, skips `/dev/tty`, and returns `isTTY = input.isTTY && output.isTTY` — so a fake
  reporting `isTTY:false` throws (headless callers set `requireTty:false`) and one reporting `true`
  passes. "Honest under test doubles" holds.
