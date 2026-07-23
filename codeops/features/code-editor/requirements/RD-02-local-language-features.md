# RD-02: Local Language Features

> **Document**: RD-02-local-language-features.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: JSVision Code Editor
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

The code editor must remain useful without a language server. This requirement defines the open
language-adapter contract and the local, parser-backed features that improve code comprehension and
navigation: syntax highlighting, line numbers, folding, bracket matching, indentation, comment
toggle, language selection, and safe rendering of invisible controls.

PostgreSQL SQL, JavaScript, and TypeScript are the launch languages. An adapter may provide parsing
without LSP intelligence or LSP intelligence without parsing; neither capability is a prerequisite
for plain editing. Invalid and incomplete source is normal while typing and must produce the best
available partial presentation rather than disabling language features. (AR-03, AR-07, AR-10,
AR-22)

---

## Functional Requirements

### Must Have

#### FR-2.1 — Open language-adapter contract *(Complexity: L; AR-10)*

- [ ] Define a versioned `LanguageAdapter` contract identified by a stable language ID.
- [ ] Keep parsing/highlighting, fold discovery, indentation, comment metadata, bracket metadata,
      and LSP/session integration as independently optional capabilities.
- [ ] Allow hosts to register adapter objects explicitly; do not discover packages, dynamically
      import paths, or install language support.
- [ ] Ignore unknown additive adapter fields safely and reject unsupported incompatible contract
      versions with a descriptive configuration error.
- [ ] Enable commands only when the active adapter exposes the capability they require.

#### FR-2.2 — Language selection and switching *(Complexity: M; AR-03, AR-10)*

- [ ] Prefer the host's explicit language ID when supplied.
- [ ] Otherwise select from the document filename using case-insensitive extension matching:
      `.sql` and `.pgsql` select PostgreSQL SQL; `.js`, `.mjs`, `.cjs`, and `.jsx` select
      JavaScript; `.ts`, `.mts`, `.cts`, and `.tsx` select TypeScript.
- [ ] An unknown extension, absent filename, missing adapter, or unsupported explicit language ID
      selects plain mode and exposes that state without blocking editing.
- [ ] Allow the host or user to change the active language while the document remains open.
- [ ] Switching language cancels prior adapter work, clears prior language-derived presentation,
      and rebuilds it for the unchanged text/revision without changing selection, scroll, modified
      state, or undo history.

#### FR-2.3 — Incremental syntax presentation *(Complexity: L; AR-07, AR-09, AR-22)*

- [ ] Parse document text incrementally and schedule bounded work without blocking keyboard input.
- [ ] Query and paint syntax styles for visible text without allocating an unbounded
      whole-document span list.
- [ ] Support at least these semantic style categories at launch: keyword, comment, string, number,
      operator, punctuation, variable, property, function, type, namespace, and invalid/error.
- [ ] Resolve categories through named JSVision theme roles; adapters emit semantic categories, not
      terminal colors.
- [ ] Selection, active diagnostics, and bracket-match presentation have deterministic precedence
      over base syntax styles.
- [ ] Incomplete or syntactically invalid source uses the parser's best available partial
      structure. Ordinary syntax errors never switch the editor to degraded mode.
- [ ] Adapter exceptions, invalid ranges, non-progressing parser work, or resource-limit violations
      stop that adapter, report `degraded`, and preserve plain editing.

#### FR-2.4 — Line-number gutter *(Complexity: M; AR-02, AR-11)*

- [ ] Display one-based logical line numbers aligned with visible document rows.
- [ ] Keep the gutter fixed while text scrolls horizontally and scroll it with document rows
      vertically.
- [ ] Size the number field for the document's highest line number, with a fold-marker column when
      folding is available.
- [ ] Distinguish the caret line through both style and a non-color cue where terminal capability
      permits.
- [ ] Map mouse and keyboard positions through the gutter so text column zero always maps to
      document visual column zero.
- [ ] Hide the gutter only under the narrow-window reduction rule in RD-01.

#### FR-2.5 — Structural folding *(Complexity: L; AR-16, AR-21)*

- [ ] Obtain foldable ranges from the active language adapter; no parser-independent indentation
      heuristic is required.
- [ ] Provide fold, unfold, fold-all, and unfold-all commands plus gutter markers.
- [ ] Collapsing a range removes its interior rows from visible-row navigation without changing
      document text or undo history.
- [ ] When a collapsed range contains the caret or any selection, move the caret to the fold header,
      clear the hidden selection, and then collapse.
- [ ] Preserve folds whose mapped structural identity remains valid after an edit; unfold and remove
      only folds touched or invalidated by that edit.
- [ ] Never retain a fold whose adapter identity or mapped range is stale, outside the document, or
      no longer spans more than its header row.
- [ ] Use Unicode fold markers where available and ASCII fallbacks otherwise.

#### FR-2.6 — Bracket matching *(Complexity: M; AR-02, AR-11)*

- [ ] Highlight both members of the matching `()`, `[]`, or `{}` pair when the caret is on or
      immediately beside one member.
- [ ] Use adapter syntax context where available so bracket characters inside strings and comments
      do not match code brackets.
- [ ] Fall back to a bounded local scan when the adapter has no bracket capability.
- [ ] Show no match when the counterpart is absent, beyond the scan bound, or structurally
      ineligible.
- [ ] Distinguish matched cells without relying on color alone.

#### FR-2.7 — Language-aware indentation *(Complexity: M; AR-02, AR-10)*

- [ ] Support configurable tab or space indentation and a positive indent width.
- [ ] Tab indents every selected logical line; Shift+Tab dedents without removing non-indent text.
- [ ] With no multi-line selection, Tab inserts or advances by the configured indentation unit.
- [ ] On newline, use adapter-provided indentation when available and otherwise preserve the current
      line's leading indentation.
- [ ] In read-only mode, indentation commands are disabled and create no edit.

#### FR-2.8 — Comment toggle *(Complexity: M; AR-02, AR-10)*

- [ ] PostgreSQL SQL uses `--` for line comments and `/* … */` for block comments.
- [ ] JavaScript and TypeScript use `//` for line comments and `/* … */` for block comments.
- [ ] Toggle line comments across all selected logical lines, or the caret line when no selection
      exists.
- [ ] If every non-blank target line is already line-commented after its indentation, uncomment all
      target lines; otherwise comment all target lines at their shared minimum indentation.
- [ ] Expose block-comment commands separately; do not guess between line and block forms.
- [ ] Disable comment commands when the active adapter provides no applicable comment metadata or
      the document is read-only.

#### FR-2.9 — Security-sensitive invisible characters *(Complexity: M; AR-08, AR-11)*

- [ ] Preserve all document code units exactly.
- [ ] Render a visible warning cell or placeholder for bidi controls and other
      security-sensitive zero-width format controls.
- [ ] Expose the underlying code point through a details command without copying terminal control
      bytes to the output stream.
- [ ] Keep tabs, combining marks, grapheme clusters, wide characters, UTF-16 offsets, protocol
      positions, and visual columns as distinct representations with tested conversions.

### Should Have

- [ ] Hosts may override semantic style roles and language-to-extension mappings without changing
      adapter parser output.

### Won't Have (Out of Scope)

- Bash language support — explicitly excluded (AR-03).
- Multiple carets, word wrapping, and semantic-token overlays — post-v1 capabilities (AR-02).
- Autocomplete, hover, signatures, diagnostics, go-to navigation, and formatting — RD-03.
- Automatic bracket insertion, pair deletion, or surround-selection behavior — not part of the
  confirmed v1 bracket-matching scope.
- A mandated parser implementation — selected during planning after evaluating headless options.

---

## Technical Requirements

### Adapter result invariants

Every adapter-produced range:

- refers to the exact document lineage and revision requested;
- uses typed UTF-16 document offsets;
- is finite, integral, ordered, and bounded by document length;
- makes forward progress during iteration; and
- is ignored and reported when invalid rather than clamped into a different semantic range.

### Style precedence

From highest to lowest presentation priority:

1. active selection;
2. active diagnostic emphasis;
3. bracket match;
4. syntax category;
5. normal editor text.

Terminal capability downsampling may make styles visually equal, so every functional state also has
a non-color path such as a marker or details command.

### Incremental invalidation

- Text edits invalidate only adapter results affected by the changed range or declared parser
  dependency.
- Results tagged with another lineage or revision never enter current presentation state.
- Parse work is cancellable on document replacement, language change, adapter disposal, or
  superseding edits.
- The scheduling mechanism is selected during planning; the observable work bounds live in RD-04.

---

## Integration Points

### With RD-01 (Editor Surface and Document Lifecycle)

Consumes document snapshots, revision notifications, typed positions, commands, status, themes,
read-only state, visible ranges, and repaint scheduling.

### With RD-03 (Language Server Intelligence)

Shares language identity and metadata but does not depend on LSP availability. RD-03 may add
diagnostic or completion presentation without replacing local syntax parsing.

### With RD-04 (Quality, Security, and Performance)

RD-04 defines scheduling budgets, large-document degradation, hostile-input cases, adapter
resource bounds, terminal-capability coverage, and launch-language conformance tests.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| Launch languages | PostgreSQL SQL / JavaScript / TypeScript / Bash | PostgreSQL SQL, JavaScript, TypeScript | Confirmed developer use cases; Bash removed | AR-03 |
| Extension model | Closed built-ins / open adapters | Open versioned adapters | Allows future languages without coupling product behavior to one parser | AR-10 |
| Parser failure | Disable editing / independent degradation | Degrade syntax capability only | Plain editing must remain reliable | AR-07 |
| Invalid source | Disable styles / partial recovery | Best available partial structure | Source is routinely incomplete while typing | AR-22 |
| Fold invalidation | Clear all / preserve valid mapped folds | Preserve only structurally valid folds | Retains useful state without hiding stale ranges | AR-16 |
| Active fold | Refuse / move caret and collapse | Move caret, clear hidden selection, collapse | Active state remains visible | AR-21 |
| Terminal presentation | Color/Unicode only / redundant fallbacks | Non-color and ASCII fallbacks | Maintains behavior across terminal capabilities | AR-11 |

---

## Security Considerations

- **Data sensitivity**: Source text and schema identifiers may be confidential. Local adapters
  receive document text only through the editor's explicit document contract.
- **Input validation**: Validate every adapter ID, capability, range, style category, fold identity,
  indent value, comment delimiter, code point, and document revision.
- **Authentication and authorization**: No authentication is owned here. Hosts authorize adapter
  construction; adapters receive no implicit file, network, database, or process authority.
- **Injection risks**: Parser output is data, never executable code. No adapter-provided HTML,
  escape sequence, module path, shell command, SQL connection, or dynamic import is executed.
- **Encryption needs**: This RD performs no persistence or transport. Hosts protect source text
  outside process memory.
- **Rate limiting**: Parsing, result iteration, and repaint updates are bounded and coalesced under
  RD-04.
- **Infrastructure**: Launch adapters must not require a DOM, browser global, native executable,
  network listener, credential, or database connection for local features.

---

## Acceptance Criteria

1. [ ] Explicit language IDs override filename detection; the confirmed extensions map to
       PostgreSQL SQL, JavaScript, or TypeScript; unknown/missing adapters produce plain mode with
       editing still enabled.
2. [ ] Switching a 100-line document from JavaScript to TypeScript leaves text, document revision,
       selection, scroll, modified state, and undo depth unchanged while all JavaScript-derived
       spans/folds are removed before TypeScript-derived results appear.
3. [ ] Each launch adapter highlights valid samples across all categories it emits, and a shared
       conformance sample verifies keyword, comment, string, number, operator, punctuation,
       variable, function, and type categories without emitting terminal colors.
4. [ ] An incomplete JavaScript function, incomplete TypeScript type declaration, and incomplete
       PostgreSQL statement retain valid partial highlighting and plain editing; none changes
       service state to `degraded`.
5. [ ] An adapter that throws, emits an out-of-document range, repeats a non-progressing result, or
       exceeds its configured result bound is stopped and reported as degraded without changing
       document text or preventing plain editing.
6. [ ] Line-number width grows correctly across 9→10, 99→100, 999→1000, and 9999→10000 lines; a
       click on the first text cell maps to visual column zero regardless of gutter width.
7. [ ] Folding a nested launch-language structure removes only its interior visible rows; unfolding
       restores them; document text, revision, modified state, and undo depth remain unchanged.
8. [ ] Folding a range containing a selection moves the caret to its header and clears the hidden
       selection; an unrelated edit preserves that fold, while an edit invalidating its structural
       identity removes it.
9. [ ] Brackets in code match for `()`, `[]`, and `{}`; brackets inside launch-language strings and
       comments do not match code brackets when syntax context is available; an unmatched bracket
       paints no counterpart.
10. [ ] Tab and Shift+Tab indent/dedent selected lines for tab and space configurations; dedent
        never removes the first non-indent code unit; read-only mode leaves text and revision
        unchanged.
11. [ ] Line-comment toggle comments and restores mixed-indentation PostgreSQL, JavaScript, and
        TypeScript samples exactly according to FR-2.8; blank-only selections and read-only
        documents do not corrupt text.
12. [ ] Bidi controls and security-sensitive zero-width controls remain in the returned document
        text but produce visible warning presentation; serialized terminal output contains no raw
        C0, CSI, OSC, or bidi control from document or adapter content.
13. [ ] Property-based conversion tests cover empty text, tabs, combining sequences, surrogate
        pairs, wide graphemes, lone surrogates, every line ending, and out-of-range inputs across
        document offsets, line/character positions, and visual columns.
14. [ ] Local syntax, line numbers, folding, matching, indentation, and comment commands operate
        with no LSP session and no browser/DOM global.

---

## Techdocs Update

When implemented, document the language-adapter contract, position representations, parse
invalidation model, style precedence, fold identity rules, launch-language extension mappings, and
terminal-safe invisible-character policy. Record the chosen parser architecture in an ADR during
planning or implementation.
