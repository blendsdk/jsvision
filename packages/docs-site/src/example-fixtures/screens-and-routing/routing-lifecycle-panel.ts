import { Group, Input, Text, View, at, createRouter, signal } from '@jsvision/ui';
import type { FocusHost, Router, Signal } from '@jsvision/ui';

type Policy = 'dispose' | 'keep-alive';
type LessonRoutes = { list: void; detail: void };

/**
 * Compares disposable and kept-alive screen ownership through the same real navigation sequence.
 */
export class RoutingLifecyclePanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Screen state, focus, and cleanup';

  /** Number of completed push/back round trips. */
  public navigationRuns = 0;

  /** Number of List screen constructions across both policies. */
  public listBuilds = 0;

  /** Number of released List screen owners. */
  public listCleanups = 0;

  /** Stable key of the focus target restored after the latest trip. */
  public restoredFocus = 'not run';

  /** Whether the latest round trip returned to the exact same List instance. */
  public sameInstance = false;

  /** Number of completed panel cleanups. */
  public cleanupCount = 0;

  /** Active retention policy. */
  protected readonly currentPolicy = signal<Policy>('dispose');

  /** Latest ownership evidence. */
  protected readonly status = signal('dispose policy: List will rebuild');

  /** Stable identities for focus restoration across rebuilt controls. */
  protected readonly focusKeys = new WeakMap<View, string>();

  /** Application focus seam used by the nested teaching Router. */
  protected readonly focusHost: FocusHost;

  /** Current Router, reconstructed when the policy changes. */
  protected router: Router<LessonRoutes>;

  /** Current List target that should regain focus. */
  protected currentFilter: Input | undefined;

  /** Current List screen identity. */
  protected currentList: Group | undefined;

  /** Current screen-local value owner. */
  protected currentLocalValue: Signal<string> | undefined;

  /** Build evidence rows and the first disposable Router. */
  public constructor(focusHost: FocusHost) {
    super();
    this.focusHost = focusHost;
    this.router = this.buildRouter('dispose');
    this.add(at(this.router, 0, 0, 60, 3));
    this.add(at(new Text(() => `Policy: ${this.currentPolicy()}`), 0, 4, 60, 1));
    this.add(at(new Text(() => `Builds: ${this.listBuilds} · cleanups: ${this.listCleanups}`), 0, 5, 60, 1));
    this.add(at(new Text(() => `Generation: ${this.listBuilds} · local value: ${this.localValue}`), 0, 6, 60, 1));
    this.add(at(new Text(() => `Restored focus: ${this.restoredFocus}`), 0, 7, 60, 1));
    this.add(at(new Text(() => `Status: ${this.status()}`), 0, 8, 60, 1));
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }

  /** Current policy exposed as readonly behavior evidence. */
  public get policy(): Policy {
    return this.currentPolicy();
  }

  /** Current screen-owned value exposed as readonly evidence. */
  public get localValue(): string {
    return this.currentLocalValue?.() ?? 'none';
  }

  /** Mutate the real screen-local signal before a navigation round trip. */
  public mutateLocal(source: 'keyboard' | 'mouse'): void {
    const value = `edited-g${this.listBuilds}`;
    this.currentLocalValue?.set(value);
    this.status.set(`local value changed to ${value} via ${source}`);
  }

  /** Push Detail and immediately return, exposing rebuild/retention and restored focus. */
  public roundTrip(source: 'keyboard' | 'mouse'): void {
    const target = this.currentFilter;
    const beforeScreen = this.currentList;
    const beforeValue = this.localValue;
    if (target !== undefined) this.focusHost.focusView(target);
    this.router.push('detail');
    this.router.back();
    this.navigationRuns += 1;
    this.sameInstance = this.currentList === beforeScreen;
    const focused = this.focusHost.getFocused();
    this.restoredFocus = focused === null ? 'none' : (this.focusKeys.get(focused) ?? 'fallback');
    this.status.set(
      `${this.sameInstance ? 'same instance preserved' : 'new instance'} via ${source} · value ${beforeValue} → ${this.localValue} · focus ${this.restoredFocus}`,
    );
  }

  /** Reconstruct the bounded lesson with the alternate static route policy. */
  public togglePolicy(source: 'keyboard' | 'mouse'): void {
    const next: Policy = this.currentPolicy() === 'dispose' ? 'keep-alive' : 'dispose';
    const previous = this.router;
    this.remove(previous);
    this.router = this.buildRouter(next);
    this.add(at(this.router, 0, 0, 60, 3));
    this.currentPolicy.set(next);
    this.status.set(`${next} policy selected via ${source}`);
  }

  /** Build one Router whose List retention policy remains fixed for its lifetime. */
  protected buildRouter(policy: Policy): Router<LessonRoutes> {
    const router = createRouter<LessonRoutes>({
      initial: { name: 'list' },
      routes: {
        list: {
          keepAlive: policy === 'keep-alive',
          focusKey: (view) => this.focusKeys.get(view) ?? 'screen',
          build: () => {
            this.listBuilds += 1;
            const screen = new Group();
            const localValue = signal('filter');
            const filter = new Input({ value: localValue });
            this.focusKeys.set(filter, 'filter field');
            this.currentList = screen;
            this.currentFilter = filter;
            this.currentLocalValue = localValue;
            screen.add(at(new Text('LIST · local filter owner'), 0, 0, 28, 1));
            screen.add(at(filter, 30, 0, 20, 1));
            screen.onMount(() =>
              screen.onCleanup(() => {
                this.listCleanups += 1;
              }),
            );
            return { view: screen };
          },
        },
        detail: { build: () => ({ view: new Input({ value: signal('detail') }) }) },
      },
    });
    router.attachFocusHost(this.focusHost);
    return router;
  }
}
