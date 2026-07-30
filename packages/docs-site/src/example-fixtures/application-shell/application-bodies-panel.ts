import type { CapabilityProfile } from '@jsvision/core';
import { Commands, Desktop, Group, Text, View, Window, at, createApplication, signal } from '@jsvision/ui';
import type { DesktopApplication, DispatchEvent, DrawContext, RouterApplication } from '@jsvision/ui';

/** Body mode compared by the laboratory. */
export type ApplicationBodyMode = 'Desktop' | 'Custom content';

/** A focusable custom body that proves unowned window commands reach application content. */
class CustomCommandBody extends View {
  /** Commands observed after the application shell declines to handle them. */
  public readonly seen: string[] = [];

  /** Make the custom body a real command-routing target. */
  public constructor() {
    super();
    this.focusable = true;
  }

  /** Paint a small body marker into its private headless application. */
  public override draw(context: DrawContext): void {
    context.text(0, 0, 'custom body');
  }

  /** Record commands that the custom-content shell leaves to its body. */
  public override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'command') {
      this.seen.push(event.event.command);
      event.handled = true;
    }
  }
}

/**
 * Compares real default-Desktop and custom-content application objects while the outer lab stays open.
 */
export class ApplicationBodiesPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Application bodies';

  /** Currently displayed application body contract. */
  public bodyMode: ApplicationBodyMode = 'Desktop';

  /** Number of non-terminating quit requests observed. */
  public quitRequests = 0;

  /** Number of real window-command comparisons performed. */
  public windowCommandRuns = 0;

  /** Number of separately mounted nested applications released by panel cleanup. */
  public nestedCleanupCount = 0;

  /** Roots of the two nested applications, exposed for exact teardown evidence. */
  public readonly nestedRoots: readonly View[];

  /** Real, visible Desktop preview whose windows mirror the Desktop application comparison. */
  public readonly previewDesktop = new Desktop();

  /** Real default-Desktop application used by the command comparison. */
  protected readonly desktopApp: DesktopApplication;

  /** Real custom-content application used by the command comparison. */
  protected readonly customApp: RouterApplication;

  /** Custom body that receives window commands not owned by its shell. */
  protected readonly customBody = new CustomCommandBody();

  /** Reactive mirror used by the status rows. */
  protected readonly mode = signal<ApplicationBodyMode>('Desktop');

  /** Last real command outcome. */
  protected readonly commandOutcome = signal('ready');

  /** Keyboard or mouse source for the most recent action. */
  protected readonly actionSource = signal<'ready' | 'keyboard' | 'mouse'>('ready');

  /** Whether quit was requested without closing the lesson. */
  protected readonly quitRequested = signal(false);

  /**
   * Build both application shapes through the public API and release their view trees with this panel.
   *
   * @param caps Concrete capabilities shared with the documentation host.
   */
  public constructor(caps: CapabilityProfile) {
    super();
    this.desktopApp = createApplication({ caps, viewport: { width: 20, height: 6 } });
    this.customApp = createApplication({
      caps,
      viewport: { width: 20, height: 6 },
      content: this.customBody,
    });
    const first = new Window('First');
    first.setLayout({ rect: { x: 0, y: 0, width: 10, height: 3 } });
    const second = new Window('Second');
    second.setLayout({ rect: { x: 8, y: 1, width: 10, height: 3 } });
    this.desktopApp.desktop.addWindow(first);
    this.desktopApp.desktop.addWindow(second);
    const previewFirst = new Window('First');
    previewFirst.closable = false;
    previewFirst.setLayout({ rect: { x: 0, y: 0, width: 12, height: 4 } });
    const previewSecond = new Window('Second');
    previewSecond.closable = false;
    previewSecond.setLayout({ rect: { x: 8, y: 0, width: 12, height: 4 } });
    this.previewDesktop.addWindow(previewFirst);
    this.previewDesktop.addWindow(previewSecond);
    this.desktopApp.loop.renderRoot.flush();
    this.customApp.loop.focusView(this.customBody);

    const desktopRoot = this.desktopApp.desktop.parent;
    const customRoot = this.customBody.parent;
    if (desktopRoot === null || customRoot === null) {
      throw new Error('nested application roots must be mounted');
    }
    this.nestedRoots = [desktopRoot, customRoot];
    this.onMount(() => {
      this.onCleanup(() => {
        this.desktopApp.loop.dispose();
        this.nestedCleanupCount += 1;
        this.customApp.loop.dispose();
        this.nestedCleanupCount += 1;
      });
    });

    this.add(at(new Text('Desktop: window manager'), 0, 0, 40, 1));
    this.add(at(new Text('overlap, z-order, commands'), 0, 1, 40, 1));
    this.add(at(new Text('Custom content: full-screen body'), 0, 2, 40, 1));
    this.add(at(this.previewDesktop, 42, 0, 20, 4));
    this.add(
      at(
        new Text(() =>
          this.mode() === 'Desktop'
            ? 'Mode: Desktop · Window commands: enabled'
            : 'Mode: Custom content · Window commands: not registered',
        ),
        0,
        3,
        62,
        1,
      ),
    );
    this.add(at(new Text(() => `Command outcome: ${this.commandOutcome()}`), 0, 4, 62, 1));
    this.add(at(new Text('Routing depth: Screens & routing is the next course'), 0, 5, 62, 1));
    this.add(
      at(
        new Text(
          () =>
            `Quit requested: ${this.quitRequested() ? 'yes' : 'no'} · lesson alive · ` +
            `Action source: ${this.actionSource()}`,
        ),
        0,
        6,
        62,
        1,
      ),
    );
  }

  /** Whether both nested application roots remain mounted. */
  public get nestedApplicationsMounted(): boolean {
    return this.nestedRoots.every((root) => root.mounted);
  }

  /** Toggle between the two real application body contracts. */
  public switchBody(source: 'keyboard' | 'mouse'): void {
    this.bodyMode = this.bodyMode === 'Desktop' ? 'Custom content' : 'Desktop';
    this.mode.set(this.bodyMode);
    this.actionSource.set(source);
  }

  /** Emit the same window command into each real application and report which object owns it. */
  public runWindowCommand(source: 'keyboard' | 'mouse'): void {
    this.windowCommandRuns += 1;
    if (this.bodyMode === 'Desktop') {
      const before = this.desktopApp.desktop.children.length;
      this.desktopApp.loop.emitCommand(Commands.close);
      const after = this.desktopApp.desktop.children.length;
      const previewWindow = this.previewDesktop.activeWindow();
      if (previewWindow !== null) this.previewDesktop.removeWindow(previewWindow);
      this.commandOutcome.set(`Desktop close: removed window (${before} -> ${after})`);
    } else {
      const before = this.customBody.seen.length;
      this.customApp.loop.emitCommand(Commands.close);
      const handled = this.customBody.seen.length === before + 1;
      this.commandOutcome.set(handled ? 'Custom body received: Close window command' : 'Custom body missed: Close');
    }
    this.actionSource.set(source);
  }

  /** Record quit as a host-visible request without disposing the embedded lesson. */
  public requestQuit(source: 'keyboard' | 'mouse'): void {
    this.quitRequests += 1;
    this.quitRequested.set(true);
    this.actionSource.set(source);
  }
}
