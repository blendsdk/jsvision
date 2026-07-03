/**
 * Story: `TabView` (RD-17) — a self-contained folder-tab container (a documented new component; TV
 * had no tab class, AR-172).
 *
 * Four titled pages in one framed region, one visible at a time: `~G~eneral`, a closeable `~D~isplay`
 * (its `×` removes it), `~N~etwork`, and a disabled `~A~dvanced` (greyed, unactivatable). `~X~` marks
 * each Alt-hotkey. Ctrl+PageUp/Down cycle enabled tabs from anywhere inside; `←`/`→` cycle when the
 * strip holds focus; a click activates / closes / scrolls. A live echo shows the active tab index +
 * title and the last-closed tab.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, TabView, signal } from '@jsvision/ui';
import type { Tab } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** Build a page as a `Group` with a title line + body lines, positioned within the content interior. */
function page(lines: string[]): Group {
  const g = new Group();
  g.background = 'staticText'; // the neutral gray content field (the frame chrome colour)
  lines.forEach((line, i) => g.add(at(new Text(line), 1, i, Math.max(1, line.length), 1)));
  return g;
}

export const tabsStory: Story = {
  id: 'containers/tabs',
  category: 'Containers',
  title: 'Tabs',
  rd: 'RD-17',
  blurb: 'TabView: Ctrl+PgUp/PgDn cycle · Alt+letter jumps · ←/→ on the strip · click tab / × / ◄►.',
  build(ctx: StoryContext) {
    const tabs = signal<Tab[]>([
      { title: '~G~eneral', content: page(['General settings', 'Name, theme, language.']) },
      {
        title: '~D~isplay',
        content: page(['Display options', 'Resolution, colours.', '(closeable — click ×)']),
        closeable: true,
      },
      { title: '~N~etwork', content: page(['Network', 'Proxy, timeouts, retries.']) },
      { title: '~A~dvanced', content: page(['Advanced (disabled)', 'Not activatable.']), disabled: true },
    ]);
    const active = signal(0);
    const lastClosed = signal('(none)');

    const activeTitle = (): string => {
      const list = tabs();
      const i = active();
      return i >= 0 && i < list.length ? list[i].title.replace(/~/g, '') : '(none)';
    };

    const view = new TabView({
      tabs,
      active,
      onClose: (tab) => lastClosed.set(tab.title.replace(/~/g, '')),
    });

    const g = new Group();
    const tabW = Math.max(30, Math.min(ctx.width - 2, 52));
    const tabH = Math.max(7, Math.min(ctx.height - 4, 9));
    g.add(at(view, 1, 1, tabW, tabH));

    // Live echo + interaction hints below the tab view.
    const echoY = tabH + 2;
    g.add(at(new Text(() => `active: #${active()} — ${activeTitle()}`), 1, echoY, Math.max(10, ctx.width - 2), 1));
    g.add(at(new Text(() => `last closed: ${lastClosed()}`), 1, echoY + 1, Math.max(10, ctx.width - 2), 1));
    g.add(
      at(
        new Text('Ctrl+PgUp/PgDn cycle · Alt+G/D/N jump · ←/→ on strip · click tab/×'),
        1,
        echoY + 2,
        Math.max(10, ctx.width - 2),
        1,
      ),
    );
    return g;
  },
};
