# Recipe: runtime theme designer

Generate a complete semantic theme from one source color, preview it while the user moves through a
compact chooser, commit on OK/Enter, and restore the previous theme on Cancel/Esc.

- [Build the source-color factory](#build-the-source-color-factory)
- [Open a responsive live-preview dialog](#open-a-responsive-live-preview-dialog)
- [Wire menus from one registry](#wire-menus-from-one-registry)
- [Verify the lifecycle](#verify-the-lifecycle)

## Build the source-color factory

Keep source values strongly typed. The swatches below are familiar Material hue sources; Material 3
derives semantic tonal roles from a source rather than requiring a fixed swatch list. Generate first,
then repair contextual shortcut roles whose containers use the primary color.

```ts
import { createTheme, type Theme } from '@jsvision/core';

type HexColor = `#${string}`;
type Choice = { readonly name: string; readonly color: HexColor };

const choices: readonly Choice[] = [
  { name: 'Red', color: '#F44336' },
  { name: 'Purple', color: '#9C27B0' },
  { name: 'Blue', color: '#2196F3' },
  { name: 'Teal', color: '#009688' },
  { name: 'Green', color: '#4CAF50' },
  { name: 'Amber', color: '#FFC107' },
  { name: 'Orange', color: '#FF9800' },
  { name: 'Blue Gray', color: '#607D8B' },
];

function fromSource(accent: HexColor): Theme {
  const generated = createTheme({ mode: 'light', accent });
  return {
    ...generated,
    menuSelected: { ...generated.menuSelected, hotkey: generated.menuSelected.fg },
    buttonFocused: { ...generated.buttonFocused, hotkey: generated.buttonFocused.fg },
    buttonShortcut: { ...generated.buttonShortcut, fg: generated.button.fg },
    tabActive: { ...generated.tabActive, hotkey: generated.tabActive.fg },
    tabInactive: { ...generated.tabInactive, hotkey: generated.tabInactive.fg },
    statusSelected: { ...generated.statusSelected, hotkey: generated.statusSelected.fg },
    shadow: { fg: '#26332E', bg: '#18211D' },
  };
}
```

## Open a responsive live-preview dialog

Use a two-column `ListBox` rather than a tall `RadioGroup`; it scrolls at constrained heights and
supports arrows, type-ahead, mouse, and Enter. Size the modal against the desktop's usable bounds.
Use `okButton()` for standard OK semantics; if product copy must literally say “Apply,” use a public
`Button` that emits `Commands.ok` so the same modal termination path remains intact.

```ts
import {
  Commands,
  Dialog,
  ListBox,
  Text,
  cancelButton,
  col,
  createRoot,
  effect,
  fixed,
  grow,
  okButton,
  row,
  signal,
  type Application,
} from '@jsvision/ui';

export async function designTheme(app: Application, previous: Theme): Promise<Theme | null> {
  if (app.desktop === undefined) throw new Error('Theme designer requires a desktop app');

  const focused = signal(3); // Teal
  const labels = signal(choices.map(({ name }) => name));
  let preview = fromSource(choices[focused()]!.color);
  const list = new ListBox({
    items: labels,
    focused,
    selected: focused,
    command: Commands.ok,
    numCols: 2,
    typeAhead: true,
  });
  const summary = new Text(() => {
    const choice = choices[focused()] ?? choices[0]!;
    return `Source: ${choice.name} ${choice.color}\nArrows preview • Enter applies`;
  });
  const buttons = row({ gap: 2, justify: 'center' }, fixed(okButton(), 10), fixed(cancelButton(), 12));
  const dialog = new Dialog({
    title: 'Material Theme',
    width: Math.min(46, Math.max(1, app.desktop.bounds.width - 2)),
    height: Math.min(14, app.desktop.bounds.height),
  });
  dialog.add(col({ gap: 1, fill: true }, fixed(summary, 2), grow(list), fixed(buttons, 2)));

  const disposePreview = createRoot((dispose) => {
    effect(() => {
      const choice = choices[focused()] ?? choices[0]!;
      preview = fromSource(choice.color);
      app.setTheme(preview);
    });
    return dispose;
  });

  app.desktop.addWindow(dialog);
  try {
    const result = await app.loop.execView<string>(dialog);
    if (result === Commands.ok) return preview;
    app.setTheme(previous);
    return null;
  } finally {
    disposePreview();
    app.desktop.removeWindow(dialog);
  }
}
```

## Wire menus from one registry

Keep the committed theme outside the preview so Cancel has a reliable rollback target. Build preset
menu items and command handlers from the same registry.

```ts
let activeTheme: Theme = initialTheme;

for (const entry of themes) {
  app.onCommand(entry.command, () => {
    activeTheme = entry.theme;
    app.setTheme(entry.theme);
  });
}

app.onCommand('theme.designer', () => {
  void designTheme(app, activeTheme).then((theme) => {
    if (theme !== null) activeTheme = theme;
  });
});
```

## Verify the lifecycle

Test all source colors for key contrast pairs. Interactively test arrow preview, Enter/OK commit,
Esc/Cancel rollback, dialog removal, focus restoration, and repeat opening. Render the dialog at both
normal and minimum viewport sizes, and assert a known composed accent cell after commit.
