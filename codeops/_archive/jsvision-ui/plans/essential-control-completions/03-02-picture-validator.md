# 03-02 — picture(mask) validator

> New `packages/ui/src/controls/validators/picture.ts` (+ `validators/index.ts` re-export). TV source:
> `TPXPictureValidator` (`tvalidat.cpp`, `validate.h`). Implements the `Validator` shape unchanged.

## TV decode (GATE-1)

> Decoded 2026-07-01 from `/home/gevik/workdir/github/tvision/source/tvision/tvalidat.cpp` + `validate.h`.

### Result codes (`validate.h:74-75`)
`prComplete` (fully matches → accept + autoFill) · `prIncomplete` (valid so far) · `prEmpty` · `prError`
(reject) · `prSyntax` (bad mask) · `prAmbiguous` (multiple matches — internal, resolved to `prComplete`,
`:594`) · `prIncompNoFill` (internal, → `prIncomplete`, `:596`).

### Special characters (`scan()`, `:371-463`)
| Char | Meaning |
|------|---------|
| `#` | digit `0-9` required (`:387`) |
| `?` | letter required, stored as-typed (`:393`) |
| `&` | letter required, **forced uppercase** (`:399`) |
| `!` | any char, **forced uppercase** (`:405`) |
| `@` | any char, stored as-typed (`:408`) |
| `*N` / `*` | iteration: exactly N / unbounded repeat of the next group (`iteration()`, `:264-319`) |
| `{ }` | required group (`group()`, `:322-336`) |
| `[ ]` | optional group (`:428-436`) |
| `,` | alternation (try next branch; `process()`/`skipToComma`, `:465-517,244`) |
| `;x` | literal escape — next char is literal (`:440-441`) |
| other | literal, case-insensitive match; a typed space is replaced by the mask literal (`:438-451`) |

### State machine
`picture(input, autoFill)` (`:552-599`) → `process()` (alternation/backtrack, `:465-517`) → `scan()`
(linear match, `:371-463`) → `group()` (`:322-336`) / `iteration()` (`:264-319`) / `checkComplete()`
(remaining-mask-optional check, `:339-368`). `picture()`: `syntaxCheck` first (`:558`), `prEmpty` on empty
(`:561`), `process`, then leftover-input → `prError` (`:569`); autoFill on `prIncomplete` (`:572`).

### autoFill (`:572-585`)
On `prIncomplete` (+ flag), append **trailing non-special literals** from the current mask index (skipping
`;`), then re-`process`. Note specials (incl. `#`) are **not** filled, so `(###)###-####` from `"5551234"`
appends only up to the next literal. Constructor stores `voFill` if `autoFill` (`:108-109`). **Default =
ON (PA-3).**

### isValidInput vs isValid (`:149-162`)
- `isValidInput(s, suppressFill)` = `picture(s, voFill && !suppressFill) != prError` (transient; accepts
  incomplete).
- `isValid(s)` = `picture(s, False) == prComplete` (blocking; **never** autoFills; requires complete).

### syntaxCheck (`:519-550`)
Reject: null/empty mask; mask ending in `;`; unbalanced `[ ]` or `{ }`. Sets `vsSyntax` on a bad mask.

### Bounds (PA-2 — the security-critical facts)
- `scan` loop guarded by `index != termCh && pic[index] != ','` (`:379`); input read guarded by
  `jndex >= strlen(input)` → `checkComplete` (`:381`); autoFill loop guarded by `index < strlen(pic)`.
- **UNBOUNDED risks in TV:** `*N` runs N times with **no cap** (`:289`) — `*999999999#` ≈ 1e9 loops;
  unbounded `*` loops while `prComplete` (`:305`); `consume()` writes `input[jndex]` with **no length
  check** (`:214`).

## Spec (this implementation)

### API
```ts
/** Paradox picture-mask validator (TV TPXPictureValidator). autoFill defaults ON (PA-3). */
export function picture(mask: string, autoFill = true): Validator
```
Returns `{ isValidInput, isValid, error? }`. Faithful port of the `process`/`scan`/`group`/`iteration`/
`checkComplete` machine over **JS strings** (code-point indexing, PA-1 — consistent with `Input`).

### Bounds-safety (PA-2) — mandatory
- **`MAX_REPEAT = 1024`**: a `*N` with `N > MAX_REPEAT` is a **syntax error** — `syntaxCheck` returns false
  → the validator reports the mask invalid (allowlist: only provably-bounded masks accepted). Unbounded `*`
  is allowed but each iteration must **advance `jndex`** (consume input); an iteration that consumes nothing
  breaks the loop (prevents empty-match spin).
- **Global step budget**: a per-call counter `steps`, ceiling `MAX_STEPS = 64 * (mask.length + input.length)
  + 4096`; exceeding it aborts with `prError` (never hangs). Recursion depth is bounded by `mask.length`
  (each `group`/`iteration` advances `index` past its bracket).
- **No out-of-range indexing**: every `pic[i]`/`input[j]` access is guarded by an explicit length check
  before read; `consume` is bounded by `input.length` (JS strings can't overflow, but we still cap growth by
  the field `maxLength` at the call site).
- `syntaxCheck` runs at construction; a malformed mask makes `isValid` return false and `error` explain it —
  it never throws, never hangs.

### Firing (RD AR-101 / PA — TV-faithful)
`isValidInput` (transient, per keystroke) accepts `!= prError` (autoFill honored unless suppressed);
`isValid` (blocking, focus-leave / dialog `valid()`) requires `prComplete`, no autoFill. Plugs into the
unchanged `Input.validator` hook (`input.ts:182`).

### Examples (spec oracles derive from these — see 07)
- `picture("###-##")`: `"12"`→incomplete(ok input), `"1a"`→reject, `"123-45"`→complete; autoFill inserts `-`.
- `picture("(###)###-####")`: phone; autoFill fills `(`/`)`/`-` literals as typed.
- `picture("&&&")`: `"abc"`→complete, stored `"ABC"`; `"12"`→reject.
- `picture("[###]###-####")`: optional area code (`[ ]`).
- `picture("*3#")` = 3 digits; `picture("*99999#")` → **syntax error** (over `MAX_REPEAT`, PA-2).

## Security
Bounded per PA-2 (MAX_REPEAT + step budget + guarded indexing) — no hostile mask can hang, overflow, or
over-index; only masks that pass `syntaxCheck` are honored (allowlist). Masks are developer-authored; input
is untrusted and additionally clamped by the field `maxLength` (AC-15).
