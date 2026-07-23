# 03-02 — Component: findDialog / replaceDialog / confirmBox / replacePrompt

> **File**: `packages/ui/src/editor/dialogs.ts` · **Implements**: R-2, R-4, R-5 · **Oracle**: re-baseline `editor-dialogs.spec:51,89` (AR-6)

## Goal

Compose each dialog body with a `col` of label + input `row`s + a centered button `row`, deleting the
local `tv` / `at` helpers. `replacePrompt`'s **outer** caret-anchored rect stays absolute (FR-4, AR-7);
its inner body flexes like the others. Import `col`, `row`, `grow`, `fixed`, `cover` from the internal view barrel (`../view/index.js`), matching this file's existing relative imports.

## Target structures

### findDialog (Dialog 38×12) — preserve focusable [Input, History, CheckGroup, OK, Cancel]

```ts
const input = new Input({ value: find, maxLength: 80 });
dlg.add(
  cover(
    col(
      { padding: 1, gap: 1 },
      new Label('~T~ext to find', input),                  // non-focusable, above the field
      row({ gap: 1 }, grow(input), fixed(new History({ link: input }), 3)),
      grow(new CheckGroup({ labels: ['~C~ase sensitive', '~W~hole words only'], value: flags })),
      fixed(row({ justify: 'center', gap: 2 }, okButton(), cancelButton()), 2),
    ),
  ),
);
```

Tree DFS focusable order = Input → History → CheckGroup → OK → Cancel (matches today). `History` sits to
the right of the field in the same `row` (as it does today), so it stays second in the order.

### replaceDialog (Dialog 40×16) — preserve [findInput, History, newInput, History, CheckGroup, OK, Cancel]

```ts
col(
  { padding: 1, gap: 1 },
  new Label('~T~ext to find', findInput),
  row({ gap: 1 }, grow(findInput), fixed(new History({ link: findInput }), 3)),
  new Label('~N~ew text', newInput),
  row({ gap: 1 }, grow(newInput), fixed(new History({ link: newInput }), 3)),
  grow(new CheckGroup({ labels: [...4 flags], value: flags })),
  fixed(row({ justify: 'center', gap: 2 }, okButton(), cancelButton()), 2),
)
```

### confirmBox (Dialog w×9) — preserve [Yes, No, Cancel]

```ts
cover(col({ padding: 1 }, grow(new Text(message)),
  fixed(row({ justify: 'center', gap: 2 }, yesButton(), noButton(), cancelButton()), 2)))
```

### replacePrompt — outer rect stays absolute, inner flexes (AR-7)

Keep `new Dialog({ rect: { x, y, width:40, height:7 } })` (the caret-anchored outer placement + the
avoid-cursor `y` formula, `dialogs.ts:185-189`, **untouched**). Replace only the inner absolute children:

```ts
dlg.add(cover(col({ padding: 1 }, grow(new Text('Replace this occurence?')),
  fixed(row({ justify: 'center', gap: 2 }, yesButton(), noButton(), cancelButton()), 2))));
```

## Oracle re-baseline (R-5, NFR-3) — `test/editor-dialogs.spec.test.ts`

**Spec-first for the re-baseline:** first rewrite the two child-rect blocks to the intended flex geometry
(red against the current absolute code), then implement to green. Record in the commit body: *"deliberate
geometry re-derivation under the layout-DSL flex-elimination policy (RD-01 FR-8 / RD-02 NFR-3)."*

**Update the file header comment (L5-14) too (PF-005).** It currently states the child rects are the TV
decode, placed "VERBATIM," and "derive from RD-08 + the decode, **never the implementation**." After the
re-baseline that is false — rewrite it to record that the child rects now solve from the `col`/`row` flex
tree under the RD-01 deliberate-divergence policy, while the **outer** bounds + the record round-trips stay
decode-faithful. Otherwise the edited oracle misrepresents its own provenance.

- `:51` findDialog — re-derive `input` (L63), `cluster` (L65), `buttons` (L67-70) `.layout.rect` to the
  values the `col`/`row` tree solves to at 38×12. **Keep** the outer `bounds.width/height` (58-59) and the
  record round-trip (77) assertions unedited.
- `:89` replaceDialog — re-derive `inputs` (L106-109), `cluster` (L111), `buttons` (L113-116). Keep the
  outer bounds (102-103) + the four-flag round-trip (119).
- **Do not touch** `:80`, `:123` (replacePrompt **outer** bounds — flexing the inner body must not move the
  outer window; if it does, the rebuild is wrong), `:145`, `:153`. If a "cluster" locator relied on
  `position==='absolute'`, update it to find the CheckGroup by type/identity, not position.

## Invariants to preserve (FR-2)

- Dialog outer sizes (38×12, 40×16, w×9, 40×7) and the `replacePrompt` anchor formula — unchanged.
- Record shapes + return values (`FindRec`, `ReplaceRec`, yes/no/cancel) — unchanged.
- `History` link, `CheckGroup` values/hotkeys, `Label` hotkey links — unchanged.
- Focusable orders above — proven by the new traversal specs (R-4).

## Verification

- `editor-dialogs.spec` lines 51/89 re-baselined and green; 80/123/145/153 unedited and green.
- New `editor-dialogs.traversal.spec.test.ts` asserts the four focusable orders, green-on-current-first.
- No local `tv`/`at` left in the file (`grep`).
