/**
 * Story: Global Clipboard — framework-wide `Ctrl+A/C/X/V` across every editable widget.
 *
 * `Ctrl+A` select-all, `Ctrl+C` copy, `Ctrl+X` cut, and `Ctrl+V` paste work in every field without
 * per-widget wiring: the app-shell installs a default keymap that turns those chords into commands
 * the focused editor consumes. Copy/cut fill a shared in-app buffer (and the OS clipboard when the
 * terminal supports it), so you can copy from one `Input`, Tab to another, and paste — or move text
 * between an `Input` and the `Memo`. The classic `Ctrl+Ins` / `Shift+Ins` / `Shift+Del` aliases work
 * too. Selection is by `Shift+←/→` or mouse drag.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, Label, Input, Memo, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const clipboardStory: Story = {
  id: 'controls/clipboard',
  category: 'Controls',
  title: 'Global Clipboard',
  blurb: 'Ctrl+A/C/X/V everywhere — copy across fields and into the Memo; classic Ins/Del aliases too.',
  build(ctx: StoryContext) {
    const source = signal('Select me: Ctrl+A then Ctrl+C, Tab, Ctrl+V.');
    const target = signal('');
    const notes = signal('Cut from a field and paste here — the buffer is shared.');
    const w = Math.max(40, ctx.width - 2);
    const fieldW = Math.max(20, w - 10);
    const memoH = Math.max(3, ctx.height - 9);
    const g = new Group();

    const sourceInput = new Input({ value: source });
    const targetInput = new Input({ value: target });
    const memo = new Memo({ value: notes });

    g.add(at(new Label('~S~ource', sourceInput), 1, 0, 8, 1));
    g.add(at(sourceInput, 10, 0, fieldW, 1));
    g.add(at(new Label('~T~arget', targetInput), 1, 2, 8, 1));
    g.add(at(targetInput, 10, 2, fieldW, 1));

    g.add(at(new Text('Notes (Memo):'), 1, 4, w, 1));
    g.add(at(memo, 1, 5, w, memoH));

    // Live bound-state echo — proves copy/cut/paste actually move text between the bound signals.
    g.add(at(new Text(() => `source="${source()}"  target="${target()}"`.slice(0, w)), 1, ctx.height - 3, w, 1));
    g.add(at(new Text('Ctrl+A/C/X/V = select/copy/cut/paste. Shift+←/→ or drag selects.'), 1, ctx.height - 2, w, 1));
    g.add(
      at(new Text('Tab moves focus. Classic Ctrl+Ins / Shift+Ins / Shift+Del also work.'), 1, ctx.height - 1, w, 1),
    );
    return g;
  },
};
