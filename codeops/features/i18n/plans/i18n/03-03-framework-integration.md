# Component specification: framework integration

## Application injection

`ApplicationOptions` gains `readonly i18n?: I18n`. `createApplication` uses the supplied exact
instance, or one private English service containing framework English catalogs. `Application`
exposes `readonly i18n: I18n`.

No-config applications preserve current bytes, ISO DatePicker behavior, search behavior, and
explicit labels. Explicit i18n enables locale conventions and localized defaults only at the seam
that owns the text.

```typescript
const i18n = createI18n({
  locale: 'nl-NL',
  catalogs: [uiNl, formsNl, filesNl, datagridNl, appNl],
});

const app = createApplication({ caps, i18n });
```

## Dependency and host rules

UI, Forms, Files, and Datagrid declare direct `@jsvision/i18n` dependencies. Core remains unchanged.
`ModalDialogHost` and other narrow hosts that construct package-owned strings gain readonly `i18n`.
Event-loop, rendering, reactive, and input primitives do not.

Standalone constructors/helpers accept optional explicit `i18n`; package English catalogs supply
their defaults. Caller-supplied label/value options always win. Passing only `{ loop, desktop }` to a
localized helper is no longer sufficient when that helper mints localized package text; the host
type makes the missing service visible.

## Catalog ownership

Each package owns a stable key namespace:

- `ui.*` for standard buttons, message/editor dialogs, calendar, and switch defaults;
- `forms.*` for form-dialog defaults;
- `files.*` for dialogs, file metadata, and package errors;
- `datagrid.*` for filters, empty states, personalization, and boolean defaults.

Application catalogs are appended after framework catalogs. Locale fallback is evaluated before
layer precedence, so an English application override cannot suppress an available Dutch framework
translation.

## UI behavior

- Calendar month/week-day headings and Today use the explicit service locale.
- Explicit `firstDayOfWeek` wins. Locale week convention is consulted only with explicit i18n.
- DatePicker's value representation remains ISO by default.
- Switch renders localized On/Off only when its label option is absent.
- Standard dialog labels and package-owned message/editor text use catalog defaults.
- Accelerator parsing remains the existing `~X~` syntax; official catalog scope manifests prevent
  collisions among simultaneously visible actions.

## Forms, Files, and Datagrid

- FormDialog localizes its default OK action; explicit labels remain byte-identical.
- File dialogs localize package-owned metadata, action labels, and errors, while paths, filenames,
  extensions, and filesystem data remain untouched.
- Datagrid localizes package-owned filter/personalization/empty text and default boolean labels.
  Column identifiers, titles supplied by callers, cell values, and serialized variants remain data.
- Explicit i18n uses service collation and NFC+locale casing for framework search/sort affordances.
  No-config flows retain existing comparisons.

## Literal inventory and layout

A checked manifest lists each candidate source literal with package, key or non-localized
classification, owner, and optional accelerator scope. A conservative scanner fails on unclassified
new candidates without rewriting code.

All official catalogs render representative dialogs at 80×24. Measurements use terminal display
cells, not JavaScript string length. Layout tests ensure translated labels remain reachable and do
not overlap, truncate accelerator markers, or move required controls outside the viewport.
