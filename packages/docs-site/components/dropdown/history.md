---
title: History
description: Recall bounded recent Input values with a History dropdown backed by a shared ID store or an app-owned reactive list.
---

# History

`History` is a three-cell `▐↓▌` control linked to an [`Input`](/components/controls/input). Opening
records the field’s current text, presents older values in an anchored popup, and lets a choice
replace and select the field text.

Storage can be global by numeric ID or local through an app-owned signal. The local form is ideal
for deterministic examples, tests, and application persistence.

## Usage

```ts
import { History, Input, signal } from '@jsvision/ui';

const value = signal('/workspace/current');
const entries = signal(['/tmp', '/var/log']);
const input = new Input({ value });
const history = new History({ link: input, history: entries, maxRows: 5 });
```

## Live example

<PlayExample id="dropdown/history" title="App-owned MRU laboratory" blurb="Open a deterministic recent-path list, record the current field value, and recall an older path into the linked Input." />

Alt+Down opens from anywhere in the laboratory. The second-oldest entry starts focused when several
entries exist, making a common recent value one Enter away.

## Props and public state

`History` accepts `HistoryOptions`:

| Prop        | Type               | Default | Purpose                                        |
| ----------- | ------------------ | ------- | ---------------------------------------------- |
| `link`      | `Input`            | —       | Field whose text is recorded and replaced.     |
| `historyId` | `number`           | `0`     | Key in the process-global store.               |
| `history`   | `Signal<string[]>` | —       | App-owned store used instead of the global ID. |
| `maxRows`   | `number`           | `6`     | Visible popup rows.                            |

Global helpers include `historyAdd`, `historyEntries`, `historyStr`, `historyCount`, and
`clearHistory`. `HISTORY_MAX_ENTRIES` bounds each global list at 16 values.

## Size and Layout

History paints exactly three cells and is normally placed flush against the linked field’s right
edge. The popup anchors to the Input rectangle rather than the button, giving recalled values the
full field width. The shell’s overlay host keeps it above surrounding content.

The linked field remains the focus target. Down opens only while it is focused; Alt+Down can open
from elsewhere. A disabled field consumes the trigger without opening a popup it cannot focus.

## MRU ownership

Opening skips empty text, removes an existing duplicate, appends the current value as newest, and
evicts the oldest entry when the bound is exceeded. Global ID storage lets several fields share a
history; a passed signal keeps data scoped to the application.

```ts
import { History, signal } from '@jsvision/ui';

const recentFiles = signal(loadRecentFiles());
const picker = new History({ link: pathInput, history: recentFiles });
```

Persist the signal from application code. Avoid using the global store when instance isolation,
server rendering, or deterministic reset matters.

## Recall workflow

Click, Down on the linked field, or Alt+Down records and opens. The popup lists oldest to newest and
focuses index `1` when possible. Arrow keys navigate; Enter or a click writes the chosen value,
clamped to the Input’s maximum length, selects all text, and dismisses.

Escape or an outside click dismisses without replacing the field. Because recording happens before
the popup opens, the current value remains available in future recalls even when this popup is
cancelled.

## Best Practices

- Prefer an app-owned history signal when values need persistence or test isolation.
- Use a shared `historyId` only when controls intentionally share one MRU vocabulary.
- Clear global history between isolated tests.
- Keep recalled values safe to display; History does not turn secret data into an appropriate UI.
- Place the button immediately beside its linked field so their relationship is obvious.

## Theming

`historyButtonArrow` and `historyButtonSides` paint the `▐↓▌` control. `historyWindow` paints the
popup frame, while `historyViewer` and `historyViewerFocused` paint its rows. Verify the focused row
against both the popup surface and the surrounding dialog.

## Related

- [Combo Box](/components/dropdown/combo-box) — typed candidates and optional free text.
- [Input](/components/controls/input) — linked field and maximum-length behavior.
- [List View](/components/containers/list-view) — popup row interaction.
- [History API](/api/ui/classes/History) — generated options and store helpers.
