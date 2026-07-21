# 03-03 — `errorBox` + the `wrapText` export

> Implements RD-01 FR-1 for `packages/files/src/dialog/error-dialog.ts`, plus the one sanctioned
> cross-package change (AR-4). This is the only component whose **height** changes (AR-2/AR-3).

## 1. Promote `wrapText` to public ui API

`wrapText` is currently a module-private function in `packages/ui/src/controls/text.ts:24-64`. It
word-wraps to a width, hard-breaking any single word wider than the view and preserving blank lines.

**Move** it verbatim to `packages/ui/src/controls/measure.ts` (beside `stringWidth`, which it already
depends on), export it, re-import it in `text.ts`, and add it to the barrel:

```ts
// packages/ui/src/index.ts:212
export { stringWidth, wrapText } from './controls/measure.js';
```

The barrel comment at `:192` already frames these as helpers "so another package can compose a
bespoke grid on it" — `wrapText` belongs in exactly that set.

**Required by CLAUDE.md** (AC-10): public JSDoc with a lead sentence, `@param`/`@returns`, and a
copy-pasteable `@example`. `check:docs` fails otherwise. The plugin API-ref snapshot must then be
regenerated with `yarn plugin:sync --fix` — editing public JSDoc reliably drifts it and fails
`yarn verify` otherwise.

> Behavior must be identical after the move — `text.ts` keeps calling the same function. This is a
> relocation, not a rewrite.

## 2. Content-sized `errorBox`

```ts
const width = Math.min(60, Math.max(24, message.length + 6));
const lines = wrapText(message, width - 2).length;   // content box = width − 2 (padding 1 per side)
const height = lines + 4;                            // frame 2 + button band 2
const dlg = new Dialog({ title: 'Error', width, height, centered: true });

const text = new Text(message);
const ok = okButton();
dlg.add(cover(col(grow(text), fixed(row({ justify: 'center' }, ok), 2))));
```

- `width` is **unchanged** — only `height` is now derived.
- The old `(2, 2, width-4, 1)` / `(centred, height-3, 10, 2)` rects are deleted.
- `Text` and `Button` both self-measure, so `grow`/`fixed` here are about distribution, not rescue
  from a `{0,0}` collapse.
- `justify: 'center'` centres the OK button on the row's main axis, replacing the manual
  `Math.max(2, Math.floor((width - 10) / 2))` arithmetic.

### Height examples

| Message | Today | After |
|---------|-------|-------|
| `"Invalid directory"` (17) | 7 rows | **5** rows |
| `"Invalid file name: 'x'"` (22) | 7 rows | **5** rows |
| a 120-char message | 7 rows — **clipped after line 1** | **7** rows, fully shown |

The short-message box gets *tighter* and the long-message box finally shows its whole message. Both
are sanctioned geometry divergence; no test asserts either dimension (02 §6).

## 3. Why this is safe

- `errorBox` has **no** geometry oracle — `files.packaging.spec.test.ts:31,57,64` only checks that
  the export is a function (AR-3, 02 §6).
- Callers (`file-dialog.ts:299,304`, `chdir-dialog.ts:193`, `openers.ts`) pass a message and await a
  void promise; the signature, return value, and modal lifecycle are untouched (RD-01 FR-2).
- The message is still sanitized at draw time by `Text` — no new injection surface (RD-02 NFR-6).

## 4. Tab order

One focusable descendant: the OK button. AC-4 / NFR-2 still require an explicit oracle asserting it
is the sole tab stop (AR-9) — cheap, and it pins that the nested `col`/`row` introduce no phantom
stop.
