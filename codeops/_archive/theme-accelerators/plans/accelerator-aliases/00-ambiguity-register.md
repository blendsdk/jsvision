# Ambiguity Register: Accelerator Aliases

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED
> **Last Updated**: 2026-07-13 12:09

All items resolved with the user's explicit decision. Zero deferred. The user confirmed the
complete register before any plan document was written.

## Register

| #  | Category | Ambiguity / Question | Options | Resolution (user decision) | Status |
|----|----------|----------------------|---------|----------------------------|--------|
| AR-01 | Scope | How many dedicated accelerator (hotkey) aliases? | (a) one unified, (b) one menu/status only, (c) two | **Two** — one for in-dialog controls, one for global chrome | ✅ Resolved |
| AR-02 | Behavior | Which role references each new alias drives | — | `accelerator` → `buttonFocused.hotkey`, `tabActive.hotkey`, `tabInactive.hotkey`, `labelShortcut.fg`, `buttonShortcut.fg`, `clusterShortcut.fg`; `menuAccelerator` → `menuBar.hotkey`, `menuSelected.hotkey`, `statusBar.hotkey`, `statusSelected.hotkey` | ✅ Resolved |
| AR-03 | Scope | Fate of `danger` / `warning` after decoupling | (a) delete/rename, (b) keep as app-reserved | **Keep** — remain in the vocabulary as app-author status tokens; drive **no** built-in role | ✅ Resolved |
| AR-04 | Compatibility | Visual result for existing presets | — | **Byte-identical** for every shipped preset by default (hard requirement) | ✅ Resolved |
| AR-05 | Naming / structure | Which CodeOps feature hosts this plan | jsvision-ui / jsvision-ui-enhancements / new feature | **New feature `theme-accelerators`**, plan folder `accelerator-aliases` | ✅ Resolved |
| AR-06 | Naming | Names of the two new alias tokens | accelerator+menuAccelerator / +barAccelerator / +chromeAccelerator / shortcut+menuShortcut | **`accelerator` + `menuAccelerator`** | ✅ Resolved |
| AR-07 | Technical / contract | How strongly to decouple; field optionality | full decouple (required fields) / soft decouple (optional + warning/danger fallback) | **Full decouple** — `accelerator`/`menuAccelerator` are **required** `ThemeColors` fields with independent defaults; editing `warning`/`danger` retints **no** built-in hotkey | ✅ Resolved |
| AR-08 | Technical | Preset byte-parity mechanism | derive-from-warning-unless-set / explicit per-preset pin | **Explicit** — add `accelerator`/`menuAccelerator` to each generated preset's `overrides`, mirroring that preset's `warning`/`danger`; `slate` needs none (relies on defaults) | ✅ Resolved |
| AR-09 | UX | Theme-designer treatment of the now-inert `danger`/`warning` | annotate "(reserved)" / no change | **Annotate** — mark `danger`/`warning` rail rows "(reserved)"; the two new alias rows auto-appear | ✅ Resolved |
| AR-10 | Compatibility | Accept the generated-theme behavior change | — | **Accepted** — `createTheme({ overrides: { warning \| danger } })` no longer retints hotkeys; documented in `CHANGELOG`. Acceptable at v0.2.0 (pre-1.0) | ✅ Resolved |
| AR-11 | API surface | Add optional `accelerator?` / `menuAccelerator?` seed params to `ThemeOptions` | yes / no | **Yes** — symmetry with `danger?`/`warning?`; default `#f59e0b` / `#ef4444` | ✅ Resolved |
| AR-12 | Tooling | Verify command | — | **`yarn verify`** (from project CLAUDE.md) | ✅ Resolved |
| AR-13 | Scope boundary | Serialization changes | — | **None** — `serializeTheme`/`parseTheme` are roles-based and byte-stable; the `hotkey` field name is unchanged (only its source alias changes) | ✅ Resolved |
| AR-14 | Scope boundary | Add a theme ROLE or change the role count | — | **No** — role count stays 63; no new `ThemeRole`; the two literal presets (`classicTheme`, `monochromeTheme`) are role-literals and stay byte-unchanged | ✅ Resolved |
| AR-15 | Docs / accuracy | JSDoc + doc updates | — | Update "16 aliases" → "18" in `aliases.ts`/`roles.ts`/`create-theme.ts`/`index.ts`/`preset-seeds.ts`; rewrite `danger`/`warning` field docs (no longer "the hotkey accent"); document the two new fields; update the `rolesFromAliases` `@example` literal (+2 fields); add a `CHANGELOG` entry. `CLAUDE.md`'s "16 aliases" mentions are auto-generated — left to `/analyze_project`, not hand-edited (preflight PF-003) | ✅ Resolved |
| AR-16 | Testing | The `create-theme.spec.test.ts` ST-7 "exactly 16" oracle | — | Requirement-driven spec change: update to **18** and add the two tokens to `SAMPLE`; add new ST oracles for the repoint + decouple. `presets.impl.test.ts` round-trip stays **unchanged** — but it guards *serialization losslessness* (a self round-trip, each preset compared to itself), **not** byte-parity; the byte-parity oracle is the **data-driven ST-6** over every curated preset (corrected per preflight PF-005) | ✅ Resolved |
| AR-17 | Kitchen-sink | Story obligation | — | An alias is a **non-visual** capability; the existing `theming/presets` story covers it — no new story. Update its "16 aliases" copy → "18" | ✅ Resolved |
| AR-18 | Security | New input path / injection surface | — | **None** — color-data only; serialize/parse (the only untrusted-input boundary) is unchanged and already injection-safe | ✅ Resolved |

## Notes

- AR-01…AR-04 were pre-resolved during the design conversation in this session and are imported as
  resolved context; AR-05…AR-09 were confirmed via a structured decision prompt; AR-10…AR-18 are the
  low-stakes items resolved by recommendation and confirmed by the user's acceptance of the four
  headline decisions.
