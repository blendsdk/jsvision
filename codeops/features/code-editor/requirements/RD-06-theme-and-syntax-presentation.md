# RD-06: Theme and Syntax Presentation

> **Document**: RD-06-theme-and-syntax-presentation.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: JSVision Code Editor
> **Depends On**: RD-01, RD-02, RD-03, RD-04
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

The code editor must present source structure and interactive state through a coherent,
customizable theme without coupling parsers to colors. By default, a dedicated
`CodeEditorTheme` is derived from the active JSVision application `Theme`. A host may override
individual editor roles or supply an independent editor palette per application or editor.

Theme changes affect presentation only: they must not reparse source, restart language services,
change document state, or disturb interaction. Terminal capability downsampling, contrast,
monochrome attributes, and non-color cues preserve comprehension across supported terminals.
(AR-25)

---

## Functional Requirements

### Must Have

#### FR-6.1 — Dedicated editor-theme contract *(Complexity: L; AR-25)*

- [ ] Define a public, versioned `CodeEditorTheme` contract separate from the global JSVision
      `Theme`.
- [ ] Organize it into typed editor-surface, syntax-token, structural-decoration, diagnostic, and
      assistance role families.
- [ ] Represent every role as terminal-renderable foreground, background, and optional attribute
      information compatible with JSVision's color/capability pipeline.
- [ ] Require complete resolved themes internally while accepting validated partial overrides at
      public configuration boundaries.
- [ ] Ignore unknown additive role fields for compatible contract versions and reject incompatible
      major versions with an actionable configuration error.
- [ ] Export the contract, resolver, default derivation function, and category types through the
      owning package's public entry point.

#### FR-6.2 — Hybrid resolution and override precedence *(Complexity: L; AR-25)*

- [ ] Derive a complete default `CodeEditorTheme` from the active JSVision `Theme`.
- [ ] Allow an application-level partial or complete editor-theme override.
- [ ] Allow an editor-instance partial or complete override.
- [ ] Resolve precedence deterministically as editor override → application override → derived
      editor theme → documented safe defaults.
- [ ] Deep-merge at role-field level so overriding one foreground, background, or attribute does
      not erase the remaining resolved role fields.
- [ ] Validate colors, attributes, role names, object depth, and override size before use; invalid
      overrides fail closed to the last valid or derived value and expose a sanitized configuration
      error.
- [ ] Permit an override to define an independent editor color scheme while application chrome
      continues using the active JSVision `Theme`.

#### FR-6.3 — Editor-surface roles *(Complexity: M; AR-25)*

- [ ] Define roles for normal text/background, gutter, active gutter line, active line, selection,
      inactive selection, caret-adjacent status, read-only state, and disabled/degraded text.
- [ ] Keep the editor background visually continuous: syntax roles change foreground and
      attributes by default and inherit the resolved editor background unless explicitly overridden.
- [ ] Ensure line-number, active-line, selection, and read-only/degraded presentation remain
      distinguishable without relying on syntax colors.
- [ ] Ensure active selection remains the highest-priority text-range presentation and cannot be
      hidden by token, diagnostic, bracket, or snippet styling.

#### FR-6.4 — Stable syntax-category palette *(Complexity: L; AR-25)*

- [ ] Define stable categories for `text`, `keyword`, `comment`, `string`, `number`, `operator`,
      `punctuation`, `variable`, `property`, `function`, `type`, `namespace`, `constant`,
      `parameter`, and `invalid`.
- [ ] Require local language adapters to emit category identifiers and ranges only, never terminal
      colors, escape sequences, or theme objects.
- [ ] Use the same category meanings across PostgreSQL SQL, JavaScript, and TypeScript; each
      adapter maps language constructs to the closest stable category.
- [ ] Resolve unknown or unavailable categories through a documented fallback chain ending at
      `text`; unknown categories never disable highlighting or editing.
- [ ] Allow hosts to override categories globally but do not support language-specific token
      palettes in version 1.
- [ ] Do not require TextMate scopes, VS Code theme files, or language-server semantic tokens in
      version 1.

#### FR-6.5 — Structural and assistance roles *(Complexity: L; AR-25)*

- [ ] Define roles for bracket match, bracket mismatch, fold marker, indent guide, whitespace,
      security-sensitive invisible warning, search match, and active search match.
- [ ] Define roles for completion selection, completion match, completion detail, deprecated
      completion, hover code, snippet placeholder, and active snippet placeholder.
- [ ] Use existing terminal-safe popup layout and focus behavior; theme data changes style only and
      cannot inject content, dimensions, commands, or terminal controls.
- [ ] Distinguish bracket mismatch, invisible warnings, and the active snippet placeholder through
      attributes or glyph cues when colors collapse.

#### FR-6.6 — Diagnostic palette and precedence *(Complexity: L; AR-25)*

- [ ] Define `error`, `warning`, `info`, and `hint` diagnostic roles for range emphasis, gutter
      markers, and detail presentation.
- [ ] Derive diagnostic colors from the application's danger, warning, information, and muted
      semantics where available, with contrast-safe fallbacks.
- [ ] Preserve severity through gutter glyph/ASCII marker and detail text when terminal depth makes
      colors indistinguishable.
- [ ] Apply text-range presentation from highest to lowest priority:
      active selection → active diagnostic → active snippet placeholder → bracket match/mismatch →
      diagnostic range → syntax token → normal text.
- [ ] Compose compatible foreground/background/attribute fields according to that precedence rather
      than allowing a lower layer to replace the complete higher-priority style.

#### FR-6.7 — Live theme changes *(Complexity: M; AR-25)*

- [ ] Observe application-theme and editor-override changes through the established reactive/theme
      seam.
- [ ] Re-resolve the editor palette and repaint affected visible cells without reparsing source,
      requesting LSP data, replacing decorations, or rebuilding document text.
- [ ] Preserve text, revision, modified state, undo/redo, selections, caret, scroll, folds, search,
      diagnostics, snippets, completion state, and service state across a theme change.
- [ ] Coalesce rapid theme updates and keep repaint work within RD-04's viewport-bounded scheduling
      constraints.
- [ ] Recover from an invalid live override by retaining the last valid resolved palette or falling
      back to derivation without blanking the editor.

#### FR-6.8 — Contrast and terminal capability adaptation *(Complexity: XL; AR-25)*

- [ ] Resolve and validate every role against its effective background before rendering.
- [ ] Require at least 4.5:1 contrast for source text and token foregrounds against their effective
      background, and at least 3:1 for non-text state markers and boundaries; when a requested role
      misses its target, apply a deterministic safe fallback and expose the adjustment to
      theme-inspection tooling.
- [ ] Downsample colors through JSVision's existing truecolor, 256-color, ANSI-16, and monochrome
      capability pipeline.
- [ ] Use supported bold, dim, italic, underline, and reverse attributes as optional distinctions;
      never require a terminal to support any one attribute for correctness.
- [ ] Ensure monochrome and ANSI-16 mappings retain normal text readability and non-color
      differentiation for selection, diagnostics, bracket mismatch, active snippet placeholder,
      invisible warnings, and read-only/degraded state.
- [ ] Sanitize theme labels and validation errors, and reject any value that could emit an active
      terminal control.

#### FR-6.9 — Theme inspection and kitchen-sink coverage *(Complexity: L; AR-25)*

- [ ] Extend the standalone Code Editor kitchen-sink with live switching among application-derived
      themes and at least one explicit independent editor palette.
- [ ] Show all syntax categories using representative PostgreSQL SQL, JavaScript, and TypeScript
      fixtures.
- [ ] Provide live normal, active-line, selected, read-only, folded, bracket, search, snippet,
      completion, hover, and four-severity diagnostic samples.
- [ ] Provide truecolor, 256-color, ANSI-16, monochrome, and ASCII preview modes using the same
      capability-resolution path as production.
- [ ] Show the resolved role values, fallback source, contrast adjustment, and active override layer
      without exposing unsafe raw configuration.
- [ ] Demonstrate that changing the application theme and editor override repaints immediately
      while revision, undo depth, parser work count, and LSP request count remain unchanged.

### Should Have

#### FR-6.10 — Reusable built-in editor palettes *(Complexity: M; AR-25)*

- [ ] Ship at least three named, documented editor-palette presets: one light, one dark, and one
      classic terminal palette.
- [ ] Implement presets as ordinary `CodeEditorTheme` data or overrides; selecting one uses the same
      resolution and validation path as a host-provided scheme.

### Won't Have (Version 1)

- [ ] TextMate scope matching or import of VS Code/TextMate theme files.
- [ ] Per-language color palettes.
- [ ] User-authored theme files loaded directly by `CodeEditor`.
- [ ] LSP semantic-token styling.
- [ ] Animation, gradients, transparency, or graphical-only effects.

---

## Constraints

- `CodeEditorTheme` supplements rather than replaces the application's global JSVision `Theme`.
- The global `Theme` remains authoritative for surrounding windows, menus, dialogs, status bars,
  and other application chrome.
- Adapter and protocol data cannot introduce new trusted colors or executable style behavior.
- Theme resolution and repaint remain browser/DOM-independent and safe under hostile configuration.
- The initial preset colors must be evidence-backed during planning and satisfy the stated contrast
  and terminal-capability requirements.

---

## Acceptance Criteria

1. [ ] With no editor override, every built-in JSVision theme resolves a complete
       `CodeEditorTheme`; editor background/chrome are visually coherent with the application and
       all roles contain valid terminal-renderable values.
2. [ ] Application and editor partial overrides merge at role-field granularity with deterministic
       editor → application → derived → safe-default precedence.
3. [ ] A complete independent editor palette changes the editor surface and syntax while the
       containing JSVision window and application chrome retain the application theme.
4. [ ] PostgreSQL SQL, JavaScript, and TypeScript fixtures map equivalent constructs to the same
       stable categories and display every category required by FR-6.4 without adapter-emitted
       colors.
5. [ ] Unknown categories and missing partial roles follow their documented fallback chains to
       readable `text`; malformed or hostile categories/overrides cannot disable editing or emit
       terminal controls.
6. [ ] Golden frames verify surface, syntax, structural, assistance, and four-severity diagnostic
       roles plus the complete precedence order for overlapping selection, diagnostic, snippet,
       bracket, and syntax ranges.
7. [ ] Changing the application theme, application override, and editor override repaints visible
       content but leaves document text/revision, modified state, undo depth, selection, caret,
       scroll, folds, parser invocation count, LSP request count, and retained results unchanged.
8. [ ] Invalid live overrides retain the last valid or derived palette, expose a sanitized
       configuration error, and never blank the editor or escape the UI loop.
9. [ ] Contrast tests cover all effective role/background pairs; failing custom colors produce
       deterministic documented adjustments that inspection tooling reports.
10. [ ] Truecolor, 256-color, ANSI-16, and monochrome golden frames remain readable; selection,
        severity, bracket mismatch, active snippet placeholder, invisible warning, and
        read-only/degraded state remain distinguishable without color alone.
11. [ ] Theme-resolution fuzz tests reject excessive depth/size, invalid role names, invalid colors
        and attributes, prototypes, getters, control text, and other hostile configuration without
        unbounded work or unsafe output.
12. [ ] The standalone kitchen-sink exposes derived and independent palettes, all category/state
        samples, capability previews, resolved-role inspection, fallback/contrast information, and
        proves theme switching causes no parse or LSP work.
13. [ ] Public packaging tests import `CodeEditorTheme`, its category types, resolver, and
        derivation API through the supported package entry point with no browser or DOM global.

---

## Techdocs Update

When implemented, document the `CodeEditorTheme` schema, role families, derivation inputs, override
precedence, merge semantics, syntax-category meanings and fallback chains, presentation precedence,
contrast policy, capability downsampling, monochrome cues, live-update behavior, built-in palettes,
inspection output, and safe customization examples. Record the choice to layer editor theming over
the global JSVision `Theme` in an ADR.
