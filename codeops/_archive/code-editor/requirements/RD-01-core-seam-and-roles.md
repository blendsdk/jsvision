# RD-01: Core seam types & syntax theme roles

- **Priority:** Must
- **Depends on:** — (foundation; `@jsvision/core` only). Parallel prerequisite for the feature: #101 (editor extraction).
- **Status:** Drafted

## Summary

The zero-dep foundation the rest of the feature plugs into, added to **`@jsvision/core`**: the
`Tokenizer` / `FoldProvider` **seam types** (pure type declarations — no Lezer, no DOM), a
`SyntaxBucket` category enum, and ~11 new **theme roles** (8 syntax buckets + `gutter` +
`gutterActive` + `bracketMatch`). This is what keeps `core`/`ui` zero-dep: the editor renders
highlights and folds by talking to these types and roles, while the actual Lezer implementation lives
in `@jsvision/lang` (RD-02). Nothing here imports `@lezer/*`.

## Functional requirements

### FR-1.1 — `SyntaxBucket` category enum *(AR-03)*
A closed union of ~8 semantic token categories the highlighter emits:
```ts
type SyntaxBucket =
  | 'keyword' | 'comment' | 'string' | 'number'
  | 'type' | 'function' | 'variable' | 'punctuation';
```
- `variable` is the default-foreground bucket (unclassified identifiers).
- The set is **additive** — a later bucket appends without breaking the seam.

### FR-1.2 — `DocReader` seam *(AR-20)*
The read-only text seam a language session parses through, so `@jsvision/lang` never sees the
gap-buffer internals:
```ts
interface DocReader {
  readonly length: number;               // in UTF-16 code units
  slice(from: number, to: number): string; // a bounded chunk [from, to)
}
```
The editor supplies a gap-buffer-backed reader; the chunked-read contract lets the Lezer `Input`
adapter (RD-02) feed the parser without materializing the whole document.

### FR-1.3 — `Tokenizer` seam *(AR-20, AR-04)*
A live highlighter over one document, fed edits, queried **per range** (viewport-scoped) via a
callback so no whole-document span list is allocated:
```ts
interface Tokenizer {
  edit(change: { from: number; to: number; insertLength: number }): void; // incremental reparse hint
  highlight(from: number, to: number,
            emit: (from: number, to: number, bucket: SyntaxBucket) => void): void; // may be partial while parsing
  pending(from: number, to: number): boolean; // true while a background parse still owes this range
  dispose(): void;
}
```

### FR-1.4 — `FoldProvider` seam *(AR-20, AR-06)*
The foldable-range provider (a Lezer-tree provider in RD-02, or the editor's indent-based default
folder in RD-03):
```ts
interface FoldProvider {
  foldableAt(pos: number): { from: number; to: number } | null;               // header line at pos → its fold range
  foldsIn(from: number, to: number, emit: (from: number, to: number) => void): void; // ranges intersecting the viewport
}
```

### FR-1.5 — `LanguageProvider` factory type *(AR-02, AR-20)*
The opt-in entry the editor is handed to enable code-grade features for a document:
```ts
interface LanguageProvider {
  readonly id: string;                                  // e.g. 'json', 'javascript'
  create(doc: DocReader): { tokenizer: Tokenizer; foldProvider: FoldProvider };
}
```
When no `LanguageProvider` is supplied, the editor uses only its zero-dep features (RD-03).

### FR-1.6 — Syntax theme roles *(AR-03, AR-09)*
Eight new roles, one per bucket, added to the core theme role set (byte-resolved through the theme
system like every existing role): `syntaxKeyword`, `syntaxComment`, `syntaxString`, `syntaxNumber`,
`syntaxType`, `syntaxFunction`, `syntaxVariable` (= default fg), `syntaxPunctuation`. Each is defined
in terms of the theme's **semantic palette** (not a literal colour), so **light/dark come free**, and
resolution through `ctx.color(role)` gives **truecolor → 256 → 16 → mono downsampling free**.

### FR-1.7 — Gutter & bracket-match roles *(AR-05, AR-09, AR-01)*
Three more roles: `gutter` (dim line numbers), `gutterActive` (the caret line's number), and
`bracketMatch` (the transient two-cell match highlight). Total new core roles = **~11**.

### FR-1.8 — Additive, zero-dep, exported *(AR-00b, AR-09)*
- All symbols are additive: no change to any existing core type or role; `check:deps` stays clean;
  `@jsvision/core` keeps `{}` runtime deps.
- The seam types + `SyntaxBucket` are re-exported from `src/engine/index.ts`; the roles register in
  the theme role set (mind the DOS-16 palette naming trap — no `brightWhite` key; adding a role
  touches ~6 wiring spots + the role-count test oracle).

## Acceptance criteria

- [ ] `SyntaxBucket`, `DocReader`, `Tokenizer`, `FoldProvider`, `LanguageProvider` are exported from `@jsvision/core`'s public entry as **pure type declarations** — no runtime value pulls `@lezer/*` or any dep.
- [ ] `check:deps` passes; `@jsvision/core` `package.json` runtime deps remain `{}`.
- [ ] The 8 syntax roles + `gutter`/`gutterActive`/`bracketMatch` exist in the theme role set, resolve through `ctx.color`, and produce sensible colours in light, dark, 16-colour, and mono (a downsampling spec asserts no crash + distinct-where-possible).
- [ ] The role-count test oracle is updated to the new total; the DOS-16 palette naming is respected (no undefined-role `InvalidThemeError`).
- [ ] A `LanguageProvider`-less editor path type-checks (features simply absent) — the seam is genuinely opt-in.
- [ ] Public symbols carry JSDoc with an `@example`; `check:docs` passes.

## Out of scope
The Lezer implementation of the seam (RD-02); the editor's use of it — draw, gutter, folding UX
(RD-03); the actual colour *values* per role in each preset (theme-preset authoring, done alongside
but pinned at plan GATE-1).

## Traceability
AR-00b, AR-01, AR-02, AR-03, AR-04, AR-05, AR-06, AR-09, AR-20.
