/**
 * Story: `createRouter` (GH #26) — a **drill-down browser** (the tig/lazygit/k9s shape).
 *
 * The router is the whole canvas: a `list` screen of repositories drills into a `detail` screen on
 * Enter/click, and Back/Esc returns. The list is kept **warm** (`keepAlive`), so its scroll and
 * selection survive the round-trip — pick a row far down, open it, come back, and you land on the
 * same row. A live line above the router echoes `location()` + whether `back()` is available.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, Button, ListView, createRouter, signal } from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** The route map: a `list` of repos and a `detail` view keyed by the chosen list index. */
type Routes = { list: void; detail: { index: number } };

/** The detail screen: a repository read-out with a Back button; `Esc` also returns to the list. */
class DetailScreen extends Group {
  /** See `Esc` before the focused view does, so Back works from anywhere on the screen. */
  override preProcess = true;

  constructor(
    repo: string,
    private readonly onBack: () => void,
  ) {
    super();
    this.layout = { direction: 'col', padding: 1, gap: 1 };
    this.background = 'window';
    const title = new Text(`Repository: ${repo}`);
    title.layout = { size: { kind: 'fixed', cells: 1 } };
    const meta = new Text('Branch: main · 128 commits · MIT');
    meta.layout = { size: { kind: 'fixed', cells: 1 } };
    const back = new Button('~B~ack', { onClick: onBack });
    back.layout = { size: { kind: 'fixed', cells: 2 } };
    this.add(title);
    this.add(meta);
    this.add(back);
  }

  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'key' && ev.event.key === 'escape') {
      this.onBack();
      ev.handled = true;
    }
  }
}

export const drillDownStory: Story = {
  id: 'navigation/drill-down',
  category: 'Navigation',
  title: 'Router — Drill-down',
  blurb:
    'createRouter: a screen stack — Enter/click a repo to push a detail screen, Back/Esc to pop. The list is keepAlive, so its scroll survives the round-trip.',
  build(ctx: StoryContext) {
    const g = new Group();
    const repos = signal(Array.from({ length: 20 }, (_, i) => `repo-${String(i + 1).padStart(2, '0')}`));
    const listFocused = signal(0);

    // The route closures call back into `router` — deferred, so they run only after it exists.
    const router = createRouter<Routes>({
      initial: { name: 'list' },
      routes: {
        list: {
          keepAlive: true,
          build: () => {
            const screen = new Group();
            screen.layout = { direction: 'col' };
            screen.background = 'window';
            const list = new ListView<string>({
              items: repos,
              getText: (r) => r,
              focused: listFocused,
              onSelect: (index) => router.push('detail', { index }),
            });
            list.layout = { size: { kind: 'fr', weight: 1 } };
            screen.add(list);
            return { view: screen };
          },
        },
        detail: { build: (c) => ({ view: new DetailScreen(repos()[c.params.index], () => router.back()) }) },
      },
    });

    g.add(
      at(
        new Text(() => `screen: ${router.location().name}${router.canGoBack() ? '   ·   Back available (Esc)' : ''}`),
        1,
        0,
        ctx.width - 2,
        1,
      ),
    );
    g.add(at(router, 1, 2, ctx.width - 2, ctx.height - 3));
    return g;
  },
};
