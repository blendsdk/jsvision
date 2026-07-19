# 03-01 — Component: Base `Dialog` `center()` / `at()` adoption

> **Target**: `packages/ui/src/dialog/dialog.ts:99-109` · **Requirement**: R-1 · **Divergence**: none

## Intent

Express the `Dialog`'s self-placement through the DSL builders instead of a hand-written
`layout` object literal, without changing the resulting layout descriptor by a single field. This
dogfoods `center()`/`at()` in the framework's own core widget and removes a hand-set `rect`.

## The subtlety (PA-6)

`center(v,w,h)` sets `{position:'absolute', rect:{0,0,w,h}}` + `v.centered = true` but **no `padding`**.
`at(v,rect)` sets `{position:'absolute', rect}` + **no `centered`, no `padding`**. The current Dialog
assignment carries `padding: 1` and manages `this.centered` independently with an override. So the
swap must: (1) keep `padding:1`; (2) not let `center()` force `centered = true` when
`opts.centered === false`; (3) keep the explicit-rect branch un-centered by default.

## Target shape

Preserve the three branches. Seed `padding` first so the merge-preserving builders retain it, and
keep the existing `this.centered` computation as the source of truth for the flag (do **not** rely on
`center()`'s side-effect for the flag, because of the override case):

```ts
const width = opts.width ?? opts.rect?.width;
const height = opts.height ?? opts.rect?.height;
this.centered = opts.centered ?? (width !== undefined && height !== undefined && opts.rect === undefined);
if (width !== undefined && height !== undefined) {
  this.layout = { padding: 1 };                     // seed; builders merge-preserve it
  if (opts.rect === undefined) {
    center(this, width, height);                    // → {padding:1, position:'absolute', rect:{0,0,w,h}}, centered=true
  } else {
    at(this, { x: opts.rect.x ?? 0, y: opts.rect.y ?? 0, width, height });
  }
  this.centered = /* the value computed above */;   // re-assert: authoritative over center()'s side-effect
}
```

**Equivalence to preserve (the hard gate):**
- sized + no rect → `layout` deep-equals `{ position:'absolute', padding:1, rect:{x:0,y:0,width,height} }`, `centered === true`.
- explicit rect → `layout` deep-equals `{ position:'absolute', padding:1, rect:{x,y,width,height} }`, `centered === false` (unless overridden).
- `opts.centered` override → the flag matches `opts.centered` regardless of branch.

> **Implementation note (exec judgment):** if the composed form does not read at least as clearly as
> the current literal (the override re-assertion can feel like indirection), it is acceptable to keep
> the imperative assignment — R-1's contract is *DSL-expressed OR provably identical + at least as
> clear*, and the witness oracles are the objective gate either way (PA-7). Prefer the DSL form; do
> not ship a less-readable one to satisfy the letter of the task.

## Import

Add `center`, `at` to the existing DSL import in `dialog.ts` (from `../view/dsl/index.js`, per the
package's barrel + NodeNext `.js` specifier convention).

## Verification

`ST-1..ST-4` + `ST-10` (see `07-testing-strategy.md`). All are witness/characterization — green on
current code, must stay green. No spec oracle edited.
