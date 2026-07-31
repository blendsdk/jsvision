import { Group, Text, at, signal } from '@jsvision/ui';

/** Route that delivered the most recent laboratory command, rendered as a non-colour cue. */
export type ChromeActionRoute = 'ready' | 'keymap' | 'menu/status' | 'button';

/**
 * Shows how the four shell regions and the quit intent cooperate without ending the embedded lab.
 */
export class ApplicationChromePanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Application chrome';

  /** Number of quit requests observed while the lesson remains mounted. */
  public quitRequests = 0;

  /** Number of menu-action commands observed through every input route. */
  public menuActionRuns = 0;

  /** Most recent menu outcome. */
  protected readonly menuAction = signal('ready');

  /** Whether the learner has requested quit. */
  protected readonly quitRequested = signal(false);

  /** Command route responsible for the most recent action. */
  protected readonly actionRoute = signal<ChromeActionRoute>('ready');

  /** Build the compact shell anatomy and live feedback rows. */
  public constructor() {
    super();
    this.add(at(new Text('Menu: mounted · Lesson action + Quit request'), 0, 0, 62, 1));
    this.add(at(new Text('Body: workspace content fills remaining rows'), 0, 1, 62, 1));
    this.add(at(new Text('Status: ready · Alt+M Lesson · Alt+Q Request · Alt+X Exit'), 0, 2, 62, 1));
    this.add(at(new Text(() => `Menu action: ${this.menuAction()}`), 0, 4, 62, 1));
    this.add(
      at(
        new Text(
          () =>
            `Quit requested: ${this.quitRequested() ? 'yes' : 'no'} · ` +
            `${this.quitRequested() ? 'showcase stays alive and open' : 'lesson ready'}`,
        ),
        0,
        5,
        62,
        1,
      ),
    );
    this.add(at(new Text(() => `Action route: ${this.actionRoute()}`), 0, 6, 62, 1));
  }

  /** Record a menu command without opening a second modal surface. */
  public invokeMenu(route: Exclude<ChromeActionRoute, 'ready'>): void {
    this.menuActionRuns += 1;
    this.menuAction.set('command selected');
    this.actionRoute.set(route);
  }

  /** Record the standard quit intent while deliberately keeping the embedded lesson alive. */
  public requestQuit(route: Exclude<ChromeActionRoute, 'ready'>): void {
    this.quitRequests += 1;
    this.quitRequested.set(true);
    this.actionRoute.set(route);
  }
}
