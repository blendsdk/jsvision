# 03-03 — Switch / Toggle (GH #11)

> **Parent**: [Index](00-index.md) · **Requirement**: [R3](01-requirements.md#r3--switch--toggle-gh-11) · **AR**: AR-14…AR-19
> **Files**: `packages/ui/src/controls/switch.ts` (new), `controls/index.ts`, `packages/ui/src/index.ts`; tests `packages/ui/test/switch.{spec,impl}.test.ts`; story `packages/examples/kitchen-sink/stories/switch.story.ts` (+ `stories/index.ts`)

## Design

`Switch extends View` (the `Slider` idiom, AR-14) — a single boolean control bound to a two-way
`Signal<boolean>`.

### API (AR-15)

```ts
export interface SwitchOptions {
  /** Two-way bound on/off state. */
  value: Signal<boolean>;
  /** Optional caption; `~X~` marks an Alt-hotkey. */
  label?: string;
  /** Text shown when on (default 'On'); '' hides it. */
  onLabel?: string;
  /** Text shown when off (default 'Off'); '' hides it. */
  offLabel?: string;
  /** Non-interactive + dim when true. */
  disabled?: boolean;
}

export class Switch extends View { constructor(opts: SwitchOptions) { … } }
```

- `focusable = true` (unless `disabled`).
- Binds `value` in `onMount` via `this.bind(...)` so a toggle repaints (View `draw()` is not auto-tracked).
- If `label` carries `~X~`, parse it (`parseTilde`) and match `Alt`+hotkey in a post-process sweep like
  `Label`/`Button` (so it works even when unfocused within a dialog); it also moves focus to the switch.

### Rendering

Layout (single row): `[optional label] [track] [optional On/Off text]`.

- **Track** (inner width 4, AR-17): off = `[●   ]` (knob left), on = `[   ●]` (knob right).
- **Colours (AR-16, no new role):**
  - on → track painted in `button` (`black/green`), `buttonFocused` (`white/green`) when focused.
  - off → track painted in `staticText`/`clusterDisabled` (dim).
  - focused → the `[`/`]` brackets take the focus accent (reuse the cluster/button focus look).
  - disabled → whole control in `clusterDisabled`.
- **Knob glyph (AR-17):** `●` (U+25CF); ASCII fallback `o` (`[o   ]`/`[   o]`) chosen from `ctx.caps`.
- **On/Off text** in `staticText`, omitted when the label is `''`.
- `measure()` advertises the intrinsic width (label + track + on/off text) and height 1 — a missing
  `measure()` would collapse the view to `{0,0}` (documented footgun).

### Interaction

- `Space` / `Enter` while focused → toggle `value`.
- Click anywhere on the control → focus + toggle.
- `Alt`+hotkey (if labelled) → focus + toggle.
- No animation (AR-18) — instant flip.
- Disabled → ignores all input, no focus.

## JSDoc / docs

- `Switch` + `SwitchOptions` exported from the barrel with a copy-pasteable `@example` (bind a
  `signal(false)`, toggle, read it back) — required by `check-jsdoc.mjs`.

## Kitchen-sink story (AR-19)

- `stories/switch.story.ts` → `{ id:'controls/switch', category:'controls', title:'Switch', blurb, build(ctx) }`
  placing 2–3 `Switch`es (one labelled with an `~X~` hotkey, one disabled) + a live bound-state echo,
  absolutely positioned within `ctx.width × ctx.height`. Register in `stories/index.ts`.
- Must pass `test/kitchen-sink.smoke.spec.test.ts` (mounts headlessly, paints, unique id, metadata).

## Acceptance (maps to ST-19…ST-27)

- Reflects + toggles a bound `Signal<boolean>` via `Space`/`Enter`/click/Alt-hotkey; focus visible.
- On/off render distinctly (green vs. dim, knob side); ASCII fallback under no-Unicode caps.
- Disabled ignores input and dims.
- `measure()` returns a non-zero intrinsic size.
- Story registered + smoke green; `yarn verify` green.
