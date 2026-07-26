# Specification: multilingual QA harness

> **Status**: Ready for implementation
> **Requirements**: RQ-3; AC-9 through AC-12
> **CodeOps Artifact Schema**: 1

## Architecture

The harness has two layers:

```text
Supervisor: validated locale ID + story ID
    ↓ reconstruct
Catalogs → I18n → Application → story registry → fresh story state/views
    ↓ dispose
No view/reactive/modal/focus state retained
```

The supervisor is not a JSVision `Application` and holds no framework View or Signal. Catalog module
objects may be cached after import, but each construction creates new `I18n`, `Application`, registry
entries, and story-owned state.

## Registry contract

Each story has a stable typed ID, category, title key or framework-owned title, supported viewport
metadata, and a builder receiving the fresh application/I18n context. Builders return their root or
modal lifecycle handle plus a supported close/dispose function when required.

Required categories:

| Category | Minimum stories |
|---|---|
| Standard actions | Single, pair, long group, wrapped group, vertical group |
| UI | Message/confirm/input, find/replace/editor dialogs, dropdowns/popups, Switch, Calendar/DatePicker |
| Forms | Localized OK/Cancel with sync and async form bodies |
| Files | File, change-directory, and error dialogs |
| Datagrid | Filter/value-list and personalization |
| Formatting | Numbers, dates, and plural/parameter examples already supported by i18n |
| Overrides | Long application catalog captions and malformed accelerator fallback |
| Unicode | Wide CJK/emoji and combining-mark labels |
| Code Editor | Search/replace, diagnostics/assistance, status/degradation/invisible warnings |

## Locale transition

1. Validate requested locale against the ten official IDs and story against the registry IDs.
2. Close any active modal/story through its supported path so quit vetoes and async teardown are
   respected.
3. Dispose the old event loop/application tree.
4. Load the five package catalogs for the requested locale.
5. Construct a fresh `I18n` and fresh `Application`.
6. Construct a fresh registry/context and selected story state.
7. Render the validated selected story, falling back to the first registry entry only if the saved
   ID is no longer registered.

No mutable-locale method is added to `I18n` or `Application`.

## Interactive command

`packages/examples/package.json` adds `demo:i18n` using the repository's existing TypeScript demo
runner pattern. The shell presents locale and story selection through terminal-native controls and
documents that changing locale reconstructs the application.

## Headless inspection contract

Tests may use the same registry without starting a TTY. The headless API exposes stable metadata and
construction, not private widget fields. Assertions use real render roots to inspect:

- dialog/overlay bounds inside the viewport;
- button natural width versus assigned bounds;
- hit bounds inside the containing surface;
- Tab reachability and activation order;
- absence of overlap and broken wide-glyph cells;
- fresh identity/disposal across reconstruction;
- registry/story smoke construction.
