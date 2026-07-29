---
title: Combo Box
description: Combine editable filtering or select-only choice with a typed ComboBox field, anchored popup, and synchronized value and text signals.
---

# Combo Box

`ComboBox<T>` composes an [`Input`](/components/controls/input), a three-cell dropdown button, and
an anchored [`ListView`](/components/containers/list-view). It keeps typed `value` and displayed
`text` signals explicit, supporting both free-text filtering and strict selection.

The application shell supplies the popup overlay host. Without one, open gestures are safe no-ops.

## Usage

```ts
import { ComboBox, signal } from '@jsvision/ui';

const colors = signal(['Red', 'Green', 'Blue']);
const value = signal<string | null>(null);
const text = signal('');
const combo = new ComboBox({
  items: colors,
  getText: (color) => color,
  value,
  text,
});
```

## Live example

<PlayExample id="dropdown/combo-box" title="Editable picker laboratory" blurb="Type “gr” to narrow five typed candidates, open the anchored popup, and commit Green while value and field text synchronize." />

The filtered count comes from `combo.filtered()`, not a duplicate filter in the laboratory.

## Props and public state

`ComboBox<T>` accepts `ComboBoxOptions<T>`:

| Prop                   | Type                      | Default                    | Purpose                               |
| ---------------------- | ------------------------- | -------------------------- | ------------------------------------- |
| `items`                | `Signal<T[]>`             | —                          | Reactive candidates.                  |
| `getText`              | `(item: T) => string`     | —                          | Field/list representation.            |
| `value`                | `Signal<T \| null>`       | —                          | Typed selected value.                 |
| `text`                 | `Signal<string>`          | internal `''`              | Field text.                           |
| `editable`             | `boolean`                 | `true`                     | Free text/filter or select-only mode. |
| `filter`               | `(item, text) => boolean` | case-insensitive substring | Editable candidate filter.            |
| `placeholder`          | `string`                  | —                          | Empty editable-field hint.            |
| `onSelect` / `command` | callback / string         | —                          | Pick outputs.                         |
| `maxRows`              | `number`                  | `6`                        | Visible popup rows.                   |

Public `items`, `value`, `text`, `input`, and `filtered()` expose the composed state and focus target.
The public `input` member is the actual composed `Input`, not a mirrored field facade.

## Size and Layout

ComboBox is one row: the input flexes and the dropdown button reserves three cells. Give it enough
width for representative values and place it where the anchored popup has useful space. Popup
placement stays inside the overlay host and uses up to `maxRows`.

Focus `combo.input`, not the outer group. Down opens while that field is focused; Alt+Down opens
from the wider control scope.

## Editable and select-only modes

Editable mode accepts free text and filters candidates. `value` tracks the item whose `getText`
exactly equals `text`; unmatched free text intentionally yields `null`.

Select-only mode rejects field edits and mirrors `getText(value)` into text. Its open list enables
type-ahead so users can jump without changing the read-only field.

```ts
import { ComboBox } from '@jsvision/ui';

const language = new ComboBox({
  items: languages,
  getText: (item) => item.label,
  value: selectedLanguage,
  editable: false,
});
```

## Popup and selection

Down, Alt+Down, or the `▐↓▌` button opens a popup anchored to the control. Editable mode snapshots
the current filtered candidates; select-only mode observes the live items signal. Enter, Space, or
a row click commits the typed item and closes the popup.

Editable picks write text and let the binding derive value. Select-only picks write value and let
the binding derive text. This one-way-per-mode design avoids feedback loops.

## Best Practices

- Use select-only mode when arbitrary text would be invalid domain data.
- Preserve a separate text signal when drafts or unmatched searches matter.
- Make `getText` stable and unique when exact text-to-value matching is required.
- Keep popup candidates bounded and searchable; use another component for huge remote datasets.
- Focus the public input and provide a visible field label.

## Theming

The field uses `inputNormal`, `inputSelected`, `inputSelection`, and `inputPlaceholder`.
`historyButtonArrow` and `historyButtonSides` paint the dropdown glyph. Popup rows use
`listNormal`, `listFocused`, and `listSelected`. Check field, button, and popup contrast together
because they cross several roles.

## Related

- [History](/components/dropdown/history) — recall prior free-text values.
- [List View](/components/containers/list-view) — popup’s typed row model.
- [Input](/components/controls/input) — editable field behavior.
- [ComboBox API](/api/ui/classes/ComboBox) — generated options and public signals.
