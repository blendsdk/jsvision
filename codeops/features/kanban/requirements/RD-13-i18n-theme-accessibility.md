# RD-13: Internationalization, Theming, and Accessibility

> **Document**: RD-13-i18n-theme-accessibility.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-03, RD-04, RD-10, RD-12
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Kanban is provided by the JSVision team and must feel native across supported locales, themes, terminal
color depths, keyboard-only workflows, Unicode width behavior, and ASCII-safe hosts. Package-owned text
uses injected i18n with English fallback. Visual state has semantic theme roles and a non-color cue; the
documentation accurately states the limits of terminal accessibility rather than claiming browser DOM or
screen-reader semantics the host cannot supply.

---

## Functional Requirements

### Must Have — Complexity L

- [ ] Route every package-owned visible message, label, reason, help string, confirmation, validation
  message, state, count qualifier, and accelerator through injected `I18n` with English fallback.
- [ ] Ship typed catalogs for `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, and `sv` through
  locale subpaths.
- [ ] Validate catalog parity, placeholder types, accelerator uniqueness/safety, and absence of raw
  package-owned UI strings.
- [ ] Require current digest-bound review evidence for every non-English catalog, recording whether the
  method was proficient-human or AI-assisted without conflating the two.
- [ ] Measure translated controls/headers/dialog actions in terminal display cells and reflow responsively.
- [ ] Expose dedicated semantic theme roles for board, headers, cards, swimlanes, focus/selection,
  pending/rejected/invalid, drag/placeholder/target, WIP, summaries, and state surfaces.
- [ ] Provide safe truecolor, 256-color, 16-color, monochrome, `NO_COLOR`, Unicode, and ASCII fallbacks.
- [ ] Ensure every operation is keyboard reachable with visible focus and help/feedback; mouse remains
  parity/enhancement, not the only route.
- [ ] Ensure status, selection, pending, error, WIP, and valid/invalid drop meaning never depends on color alone.
- [ ] Handle wide glyphs and combining characters consistently in measurement, clipping, wrapping, hit
  testing, and ellipsis; sanitize control/bidi/hostile text at the documented boundary.
- [ ] Document terminal-host accessibility limitations and avoid unsupported screen-reader/WCAG claims.

### Should Have — Complexity M

- [ ] Support application catalogs composed with the package catalog and application-provided field/value
  formatters.
- [ ] Offer ASCII-safe default glyph manifests and a public capability-aware glyph override seam.
- [ ] Provide localized concise help/status variants for compact geometry and complete text in dialogs/docs.

### Won't Have (Out of Scope)

- Right-to-left board mirroring in the initial official locale family, browser ARIA/DOM semantics, speech
  output, font-pixel measurement, or translation of application-owned card data.
- Assuming `NO_COLOR` means no style at all; non-color attributes/glyphs remain capability dependent.

---

## Technical Requirements

### Message/catalog contract — Complexity L

Message IDs are stable package-namespaced strings with typed parameters. Catalog modules are inert until
registered/composed and do not mutate global locale. English provides complete fallback. Missing keys,
placeholder mismatch, duplicate accelerators in one co-visible scope, and invalid accelerator markup fail
catalog tests/build rather than rendering raw IDs silently in release fixtures.

Applications own card/status value localization through field adapters/formatters. Package messages use
plural/number/date formatting through injected i18n/Intl policy; no implicit process-global locale.

### Responsive translated layout — Complexity L

All visible controls are constructed from the active catalog before group measurement. Button sets use
`measureButtonGroup`/responsive group composition. Header/card labels clip by display cells with complete
text available through focus/help. Locale changes rebuild/rebind message-bearing controls as required,
invalidate layout once per surface, preserve stable focus/card identity, and do not preserve stale
accelerator routes.

### Semantic theme contract — Complexity M

Core `Theme` is a closed SDK type, so Kanban owns a package-local `KanbanTheme` and
`KanbanThemeRole` union rather than extending Core theme presets. `createKanbanTheme(coreTheme,
overrides?)` derives a complete immutable palette. Resolution order is application status override →
explicit Kanban override → the role's mapped Core fallback → `listNormal` for ordinary content or
`dangerText` for invalid/error content. Unknown role IDs are rejected and take the same fallback path.

The stable role families are:

| Region/state | Required distinction |
|---|---|
| Board/column/swimlane surfaces | Background, separators, focused header/group |
| Card | Normal, focused, selected, focused+selected, disabled/read-only |
| Operation | Grabbed/source placeholder, ghost, valid/warning/invalid target, pending, rejected |
| Policy/state | WIP warning/error, DoD indicator, loading/partial/empty/error/retry |
| Content | Title, status, metadata, labels, summaries, checklist complete/incomplete/progress |

Card status style resolvers return semantic roles/tokens; the theme resolves terminal attributes. A
`resolveKanbanContrast` uses public Core `toRgb`, `nearest256`, `nearest16`, `rgb256`, and `contrastRatio`.
For truecolor it measures the resolved RGB pair directly. For 256 colors it measures
`rgb256(nearest256(rgb))`; for 16 colors it measures `rgb256(nearest16(rgb))`. The Core nearest-color
helpers use redmean distance and the lower palette index on ties, making quantization deterministic.
Quantized RGB objects are encoded as lowercase six-digit `#rrggbb` values before calling
`contrastRatio`.
Malformed colors reject before resolution. A terminal-default color makes `toRgb` unresolvable and
`contrastRatio` return `NaN`; `NaN` is unsafe and immediately advances the fallback chain.

After quantization, mandatory text requires a ratio of at least 4.5. An unsafe/unresolvable pair tries the
mapped Core role, then `listNormal`; focused/selected content instead tries
`listFocused`/`listSelected`, warnings use `warningText`, and invalid/error content uses `dangerText`. If
the final theme-derived pair is still unsafe or unresolvable, mandatory text uses the emergency canonical
black-on-white pair (`#000000`/`#ffffff`, ratio 21) plus its non-color cue. Monochrome/`NO_COLOR` uses the
mapped Core role plus the mandatory marker/border/attribute cue and does not claim a numeric color ratio.
This is a deterministic readability threshold, not a claim of WCAG conformance.

Fallback mapping groups are exact: surfaces/content → `listNormal`; headers → `tableHeader`; focused →
`listFocused`; selected → `listSelected`; read-only → `buttonDisabled`; separators → `listDivider`;
pending/progress → `progressFill`/`progressTrack`; warning/WIP warning → `warningText`; rejected,
invalid, error, and WIP error → `dangerText`; drag separators → `splitterDragging`; status feedback →
`statusBar`. Every package-local token also carries a non-color marker or attribute rule.

### Non-color and glyph fallback — Complexity M

Each meaningful state has at least one of border/marker/glyph/text/attribute in addition to color. Glyph
manifests provide Unicode and ASCII alternatives with equal one-cell geometry wherever hit/column
alignment depends on width. Wide decorative glyphs are avoided in mandatory chrome. Color-depth changes
reproject visible descriptors without changing semantic state.

### Keyboard and terminal accessibility — Complexity M

- Logical focus is always visible and never hidden behind sticky/overlay regions.
- Commands/help disclose current bindings and disabled reasons.
- All pointer actions have command/menu equivalents; hover-only information has focus/help equivalent.
- Minimum/narrow geometry keeps Cancel/help/recovery routes reachable.
- Focus/selection are distinct and documented.
- Reduced/monochrome/ASCII modes remain fully operable, not merely renderable.
- Documentation states that terminal hosts expose varying accessibility APIs and that the package cannot
  guarantee screen-reader semantic trees.

### Unicode and hostile text — Complexity L

Measure/draw/hit testing use one terminal-cell width policy. Clip/wrap/ellipsis never intentionally split
a wide code point; combining marks stay associated according to current JSVision capability. Tabs/newlines
are normalized per field/region. Raw C0/C1/ESC terminal controls and dangerous bidi controls are removed or
visibly neutralized according to the shared sanitization contract before measurement and diagnostics.

---

## Integration Points

- **RD-03/RD-04** consume cell measurement, theme roles, glyphs, and degradation.
- **RD-10/RD-11** consume catalogs, accelerators, responsive forms, errors, and confirmations.
- **RD-12** binds localized action labels/help separately from stable command IDs.
- **RD-14/RD-15** own complete matrices, docs accuracy, and live demonstrations.
- **Repository integration** registers Kanban locale exports in `tools/i18n-locale-exports.json` and
  validates current review records with `scripts/check-i18n-reviews.mjs`.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Locales | English / injected / reviewed family | Ten catalogs with current review evidence | JSVision-supported component | AR #12 |
| Visuals | Color / non-color parity | Both | Terminal accessibility | AR #23, #28 |
| Width | JS length / display cells | Display cells | Unicode correctness | AR #23, #34, #41 |
| Fallback | Unicode only / ASCII | Capability-aware ASCII | Host compatibility | AR #23 |
| Claims | Broad screen reader / scoped | Scoped terminal boundary | Evidence accuracy | AR #23 |

---

## Security Considerations

- Catalogs and external/application messages are untrusted display inputs: validate placeholders,
  accelerator markup, length, controls, and layout bounds before use.
- Application text is not translated/executed as message syntax unless explicitly supplied through a
  validated catalog API.
- Sanitization precedes measurement/drawing/logging to prevent terminal injection and geometry spoofing.
- Locale/theme/glyph modules have no network/filesystem side effects and cannot load code from saved views.
- Accessibility diagnostics contain message IDs/geometry/state, not card text or personal data.

---

## Acceptance Criteria

1. [ ] Static/catalog tests find zero package-owned visible English literals outside approved message
   catalogs/fixtures and every referenced message ID exists in English.
2. [ ] All ten locale modules export type-compatible catalogs with exactly the required keys/placeholders;
   missing/extra incompatible placeholders fail.
3. [ ] Every non-English locale has a current catalog-digest review record accepted by
   `yarn i18n:reviews:check`; stale/missing evidence fails and AI-assisted review is never labeled
   proficient-human.
4. [ ] Missing active-locale translation falls back to English and never displays an undefined value or
   crashes a dialog.
5. [ ] Co-visible dialog/menu accelerators are unique after each locale is loaded; conflicts fail catalog
   validation with message IDs.
6. [ ] Switching locale while focused on a card preserves its key, rebuilds translated routes/controls,
   and produces one responsive reflow without clipped mandatory actions at 80×24.
7. [ ] Longest official translations render within assigned parent rectangles in compact, resized,
   maximized, and restored fixtures; full clipped header value is reachable via focus/help.
8. [ ] Truecolor, 256, 16, monochrome, and `NO_COLOR` frames preserve the same semantic state codes and
   distinguish focus/selection/pending/error/WIP/drop state without color-only assertions.
9. [ ] ASCII mode replaces every mandatory non-ASCII glyph with geometry-compatible safe text/glyph and
   all keyboard/pointer hit regions remain aligned.
10. [ ] Wide and combining-character fixtures use equal measurement/drawing geometry and ellipsis does not
   leave half a double-width glyph.
11. [ ] ANSI, C0/C1, dangerous bidi, newline, and tab hostile fixtures cannot escape their card/dialog
    region or alter following terminal cells.
12. [ ] Every pointer mutation demonstrated in tests has a reachable command/menu route and hover text has
    a focus/help equivalent.
13. [ ] Focus remains visible after sticky headers, overlays, scroll, resize, and narrow-mode transitions.
14. [ ] For truecolor, 256, and 16-color profiles, fixtures cover safe, below-4.5, lower-index quantizer
    tie, terminal-default/`NaN`, and unknown-role inputs through the exact helper/fallback chain above,
    including canonical black-on-white when theme-derived pairs remain unsafe. Monochrome/`NO_COLOR`
    retains the required non-color cue without a numeric-ratio claim.
15. [ ] Generated/component docs explicitly state terminal accessibility scope and contain no unsupported
    claim of ARIA, WCAG conformance, or universal screen-reader semantics.
16. [ ] Locale/theme/glyph imports perform zero filesystem/network/global registration side effects until
    the application explicitly composes them.
