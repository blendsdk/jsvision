# Code-grade Editor (Lezer) — Feasibility Decision Memo

> **⚠️ Reconstructed record.** The original spike (a 9-probe feasibility run on branch
> `spike/lezer-editor`, throwaway package `packages/spike-lezer-editor/`) was **never committed** —
> the branch was checked out ~2h on 2026-07-17 but no commit was ever made, and the working-tree
> code + its README (which held the probe numbers) were discarded when the branch was abandoned.
> This memo is rebuilt from the surviving distilled decision and from GitHub issue **#18**. The
> **architecture, verdict, and rationale are intact**; the **per-probe measurements are
> unrecoverable** and are flagged as such below. Re-measure them in a fresh spike if a number is
> load-bearing for the build.

**Decision:** build the code-development-grade editor with **Lezer** as the language engine.
**Decided:** 2026-07-17 (verdict) · packaging shape settled 2026-07-18.
**Environment (original spike):** pure-JS `@lezer/*`, Node ≥ 20, no native build, no DOM — passes the
`check:deps` no-native-runtime-dep guard. (Exact versions were in the lost README.)
**Build issue:** #102 — *"Code-grade editor: syntax highlighting + tree-based folding via Lezer (new
@jsvision/lang)"* (the live tracker for this work). **Closed epic:** #18 — *"RD-08 Editor family: a
code-development-grade editor (line numbers, syntax highlighting, folding) — in-house, no CodeMirror
dep"* (CLOSED 2026-07-17). **Prerequisite refactor:** #101 — extract the editor into
`@jsvision/editor`.

---

## TL;DR — recommendation

**Verdict:** ☐ GO  ☒ **GO (spike-proven)**  ☐ NO-GO

**Single strongest reason:** Lezer gives a **real incremental parse tree in pure JS** — no DOM, no
WASM, no native build (passes `check:deps`) — which is exactly what makes folding, indent, and
bracket behavior "code-grade", without committing us to maintaining grammars/tokenizers in-house.

**What this reinterprets about #18:** #18's title says *"no CodeMirror dep."* That still holds —
Lezer is CodeMirror's **incremental parser**, not CodeMirror's **editor view**. We take the parser
(pure JS, headless) and **reject** CodeMirror's `view`/`language`/`commands` and Monaco (all
DOM-bound). The existing `@jsvision/ui` `editor/` **is** the view.

**Recommended first slice:** land the #101 editor extraction, add the `Tokenizer`/`FoldProvider`
seam types to `@jsvision/core`, then stand up `@jsvision/lang` (Lezer) against that seam — highlight
+ tree-based folding for one language end-to-end.

**Confidence:** High on the architecture (spike ran end-to-end across 9 probes and resolved the
make-or-break integration questions favourably). Lower-fidelity on exact cost numbers — those were
in the lost README; see *Unrecoverable* below.

---

## The decision — architecture (settled)

**Language engine: Lezer (`@lezer/*`).** A real incremental parse tree in pure JS: no DOM, no WASM,
no native. Drives syntax highlighting, **tree-based** folding, and incremental reparse. This is the
primary engine.

**Breadth fallback: VS Code TextMate** (`vscode-textmate` + the pure-JS `oniguruma-to-es`) for the
long tail of languages that lack a Lezer grammar — behind the **same** `(from, to, tag)` span
**`Tokenizer` seam**, so the editor never knows which engine produced the spans.

**Explicitly rejected:** CodeMirror's `view`/`language`/`commands` and Monaco — all DOM-bound. Our
view is the shipped `@jsvision/ui` editor.

### Three moving parts (packaging — settled 2026-07-18)

1. **Extract the editor** out of `@jsvision/ui` into its own **`@jsvision/editor`** package —
   tracked as **#101**, a refactor in its own right, sequenced to land **before** the RD-08 build
   (cheaper to move the small current editor than the big future one).
   - *Not a hard blocker:* RD-08 could be built inside `ui` and extracted later, at higher cost.
   - *Coupling is real (measured in #101):* the editor imports **9** `ui` subsystems and reaches
     into `controls/measure.js` and `dialog/message-box.js`, and **`@jsvision/files` depends on the
     editor** — so extraction must **widen `ui`'s public API** and **re-point `files`**.
2. **Seam interfaces (`Tokenizer` / `FoldProvider`) live in `@jsvision/core`** as pure, zero-dep
   **type declarations**. This is the key layering move: the Lezer package then depends only on
   `@jsvision/core` + `@lezer/*` — **never** on `ui` or `editor`.
3. **Lezer layer in a new opt-in `@jsvision/lang`** package, with `@lezer/*` as ordinary runtime
   deps.

**Zero-dep invariant preserved:** `@jsvision/core` and `@jsvision/ui` keep `{}` runtime deps. The
heavy optional dependency is quarantined in `@jsvision/lang`, exactly mirroring the
`@jsvision/forms` → `zod` precedent.

**Works without Lezer:** the **indent-based default folder + the gutter** live in `@jsvision/editor`
(zero-dep), so the editor renders a gutter and basic folding even when `@jsvision/lang` is not
installed. Lezer is a progressive enhancement, not a hard requirement.

### Layering (target)

```
@jsvision/core     seam types: Tokenizer, FoldProvider (pure, zero-dep)
      ▲
@jsvision/editor   the view + gutter + indent-based default folder (zero-dep)   ← extracted via #101
      ▲                                            ▲
@jsvision/ui       (widgets)                 @jsvision/lang   Lezer engine (@lezer/* deps, opt-in)
                                                   └── depends only on core, never on ui/editor
```

---

## Why (rationale)

- **Don't hand-maintain grammars/tokenizers.** In-house lexers for a real language set is a huge,
  perpetual cost. Lezer's grammar ecosystem removes it.
- **The parse tree is what makes it "code-grade."** Tree-based folding, indent, and bracket matching
  need a real syntax tree — a regex highlighter can't give the same fidelity.
- **Pure-JS keeps the zero-dep story honest** where it's actually marketed (`core`/`ui`); the Lezer
  weight is opt-in and isolated.

---

## Residual costs (identified — NOT blockers)

- **Per-language fold allow-lists** — roughly ~8 node names per language to drive tree folding.
- **A bounded-chunk buffer → Lezer `Input` adapter** — feed the gap-buffer to Lezer's incremental
  `Input` interface in bounded chunks.
- **Off-frame / time-budgeted parsing for very large files** — keep the parse off the render frame
  so a big file never blocks a paint.

---

## Unrecoverable from the lost spike (re-measure if needed)

- The **per-probe scorecard** and any **timing / memory numbers** (they lived in the throwaway
  package's README, never committed).
- The **exact `@lezer/*` and tool versions** exercised.
- The precise **enumeration of all 9 probes** and their individual green/yellow/red verdicts. Only
  the aggregate ("spike-proven, GO") and the architecture survived.

If the RD-08 build needs any of these as a hard input, the cheapest path is a **short re-spike** of
just that question — the architecture below does not need re-litigating.

---

## Next actions

1. **`make_requirements` for the code-grade editor (RD-08)** — feed this memo in as settled evidence
   for the engine + packaging decision.
2. **#101 first** — extract `@jsvision/editor` (widen `ui`'s public API for `measure` /
   `message-box`; re-point `@jsvision/files`); add `@jsvision/editor` to the lockstep-version set.
3. **Add the `Tokenizer` / `FoldProvider` seam types to `@jsvision/core`.**
4. **Scaffold `@jsvision/lang`** with `@lezer/*`; implement the `(from, to, tag)` `Tokenizer` +
   `FoldProvider` for one language, wired to the editor via the core seam.
5. **Tracking issue filed:** #102 — the live tracker for the build (#18 is closed and its title,
   "no CodeMirror dep", under-describes the actual plan).

## Unrelated bug found during the spike (worth filing separately)

`format.ts` computes the width of a **ZWJ / multi-codepoint emoji** as the **summed width of its
parts** (which can exceed 2) while clamping the rendered cell to 1|2 — a width-accounting mismatch
independent of the editor work. File as its own bug.
