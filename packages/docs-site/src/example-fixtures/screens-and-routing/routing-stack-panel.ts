import { Group, Text, at, createRouter, item, menuBar, signal, statusItem, statusLine, subMenu } from '@jsvision/ui';

type LessonRoutes = {
  home: void;
  detail: { id: number };
  settings: void;
};

/**
 * Runs the public Router stack and chrome-host seam behind deterministic route readouts.
 *
 * The panel keeps history operations observable without using browser history or external state.
 */
export class RoutingStackPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Typed routes, history, and shared chrome';

  /** Number of successful push exercises. */
  public pushRuns = 0;

  /** Number of successful back exercises. */
  public backRuns = 0;

  /** Number of replace exercises. */
  public replaceRuns = 0;

  /** Number of reset exercises. */
  public resetRuns = 0;

  /** Number of Back attempts rejected at the root. */
  public rootBackRuns = 0;

  /** Number of completed panel cleanups. */
  public cleanupCount = 0;

  /** Last parameter delivered to the Detail route. */
  protected readonly currentDetailId = signal<number | null>(null);

  /** Active shared-chrome contribution. */
  protected readonly chrome = signal<'base' | 'detail' | 'settings'>('base');

  /** Visible operation evidence. */
  protected readonly status = signal('Home root ready · cannot go back');

  /** Real visible shared menu surface driven through the Router chrome host. */
  protected readonly sharedMenu = menuBar([subMenu('Home', [item('Refresh', 'home.refresh')])]);

  /** Real visible shared status surface driven through the Router chrome host. */
  protected readonly sharedStatus = statusLine([statusItem('Home base', 'home.base')]);

  /** Real typed Router used by every action. */
  protected readonly router = createRouter<LessonRoutes>({
    initial: { name: 'home' },
    routes: {
      home: { build: () => ({ view: new Text('HOME · shared application state') }) },
      detail: {
        build: ({ params }) => ({
          view: new Text(`DETAIL · record ${params.id}`),
          status: [statusItem('Detail', 'route.detail')],
          menu: [subMenu('Record', [item('Edit', 'record.edit')])],
        }),
      },
      settings: {
        build: () => ({
          view: new Text('SETTINGS · replacement frame'),
          status: [statusItem('Settings', 'route.settings')],
          menu: [subMenu('Preferences', [item('Apply', 'settings.apply')])],
        }),
      },
    },
  });

  /** Build the bounded screen viewport and non-colour evidence rows. */
  public constructor() {
    super();
    this.router.attachChromeHost({
      setMenu: (items) => this.sharedMenu.setItems(items ?? [subMenu('Home', [item('Refresh', 'home.refresh')])]),
      setStatus: (items) => {
        this.sharedStatus.setItems(items ?? [statusItem('Home base', 'home.base')]);
        const command = items?.find((view) => 'command' in view)?.command;
        this.chrome.set(command === 'route.detail' ? 'detail' : command === 'route.settings' ? 'settings' : 'base');
      },
    });
    this.add(at(this.sharedMenu, 0, 0, 60, 1));
    this.add(at(this.router, 0, 1, 60, 2));
    this.add(at(this.sharedStatus, 0, 3, 60, 1));
    this.add(at(new Text(() => `Route: ${String(this.router.location().name)}`), 0, 5, 28, 1));
    this.add(at(new Text(() => `Detail id: ${this.currentDetailId() ?? 'none'}`), 30, 5, 30, 1));
    this.add(at(new Text(() => `Shared chrome: ${this.chrome()}`), 0, 6, 60, 1));
    this.add(at(new Text(() => `History: ${this.router.canGoBack() ? 'back available' : 'root'}`), 0, 7, 60, 1));
    this.add(at(new Text(() => `Status: ${this.status()}`), 0, 8, 60, 1));
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }

  /** Current typed route name. */
  public get routeName(): keyof LessonRoutes {
    return this.router.location().name;
  }

  /** Current Detail parameter, or `null` outside Detail. */
  public get detailId(): number | null {
    return this.currentDetailId();
  }

  /** Push parameterized Detail. */
  public pushDetail(source: 'keyboard' | 'mouse'): void {
    this.currentDetailId.set(42);
    this.router.push('detail', { id: 42 });
    this.pushRuns += 1;
    this.status.set(`push Detail 42 via ${source}`);
  }

  /** Pop one frame, or expose the explicit root policy. */
  public back(source: 'keyboard' | 'mouse'): void {
    if (this.router.back()) {
      this.backRuns += 1;
      this.currentDetailId.set(null);
      this.status.set(`back to ${String(this.router.location().name)} via ${source}`);
      return;
    }
    this.rootBackRuns += 1;
    this.status.set(`cannot go back: Home root policy via ${source}`);
  }

  /** Replace the current frame with Settings without changing depth. */
  public replaceSettings(source: 'keyboard' | 'mouse'): void {
    this.currentDetailId.set(null);
    this.router.replace('settings');
    this.replaceRuns += 1;
    this.status.set(`replace with Settings via ${source}`);
  }

  /** Collapse all history to Home. */
  public resetHome(source: 'keyboard' | 'mouse'): void {
    this.currentDetailId.set(null);
    this.router.reset('home');
    this.resetRuns += 1;
    this.status.set(`reset Home · shared chrome base via ${source}`);
  }
}
