import { Attr, classicTheme, contrastRatio, createTheme } from '@jsvision/core';
import type { Theme } from '@jsvision/core';
import { Group, Text, View, at, signal } from '@jsvision/ui';
import type { DrawContext, ThemeRoleName } from '@jsvision/ui';

const authoredTheme = createTheme({
  mode: 'dark',
  accent: '#3b82f6',
  neutral: '#64748b',
});

/** A labelled strip that paints four component states through their exact semantic roles. */
class RoleStateStrip extends View {
  /** Paint normal, focused, selected, and disabled states from the active application theme. */
  public override draw(ctx: DrawContext): void {
    const states: readonly { readonly label: string; readonly role: ThemeRoleName }[] = [
      { label: 'normal', role: 'button' },
      { label: 'focused', role: 'buttonFocused' },
      { label: 'selected', role: 'listSelected' },
      { label: 'disabled', role: 'buttonDisabled' },
    ];
    const baseWidth = Math.floor(ctx.size.width / states.length);
    for (const [index, state] of states.entries()) {
      const x = index * baseWidth;
      const width = index === states.length - 1 ? ctx.size.width - x : baseWidth;
      const style = ctx.color(state.role);
      ctx.fillRect(x, 0, width, 1, ' ', style);
      ctx.text(x + 1, 0, state.label.slice(0, Math.max(0, width - 2)), style);
    }
  }
}

/**
 * Demonstrates semantic state roles, generated themes, application switching, and contrast checks.
 *
 * The panel owns only lesson state. Its callback uses the real application `setTheme` seam, so a
 * switch repaints the complete retained shell without rebuilding this panel or its counters.
 */
export class ThemeRoleStatesPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Semantic theme roles and states';

  /** Number of completed application theme switches. */
  public themeSwitches = 0;

  /** Number of semantic-role relationship checks. */
  public roleChecks = 0;

  /** Number of concrete contrast audits. */
  public contrastChecks = 0;

  /** Number of completed panel cleanups. */
  public cleanupCount = 0;

  /** Applies a theme through the owning application. */
  protected readonly applyTheme: (theme: Theme) => void;

  /** Active theme data used by the role and contrast checks. */
  protected activeTheme: Theme = classicTheme;

  /** Learner-facing name of the active theme. */
  protected readonly themeName = signal('Classic');

  /** Latest role-check evidence. */
  protected readonly roleResult = signal('not run');

  /** Latest concrete contrast evidence. */
  protected readonly contrastResult = signal('not run');

  /** Latest input path. */
  protected readonly actionSource = signal('ready');

  /**
   * Build the semantic-role teaching surface.
   *
   * @param applyTheme Callback that forwards a selected theme to the application.
   */
  public constructor(applyTheme: (theme: Theme) => void) {
    super();
    this.applyTheme = applyTheme;
    this.add(at(new Text(() => `Theme: ${this.themeName()} · retained switches: ${this.themeSwitches}`), 0, 0, 56, 1));
    this.add(at(new RoleStateStrip(), 0, 1, 56, 1));
    this.add(at(new Text('Roles: button · buttonFocused · listSelected · buttonDisabled'), 0, 2, 56, 1));
    this.add(at(new Text(() => `Role check: ${this.roleResult()}`), 0, 3, 56, 1));
    this.add(at(new Text(() => `Contrast: ${this.contrastResult()}`), 0, 4, 56, 1));
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 5, 56, 1));
    this.add(at(new Text('Theme swaps repaint; lesson state and counters stay mounted.'), 0, 6, 56, 1));
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }

  /** Complete theme currently used by the lesson's role and contrast evidence. */
  public get currentTheme(): Theme {
    return this.activeTheme;
  }

  /** Learner-facing name synchronized with both lesson controls and the shared Theme menu. */
  public get currentThemeName(): string {
    return this.themeName();
  }

  /** Switch between the Classic preset and one generated dark theme. */
  public switchTheme(source: 'keyboard' | 'mouse'): void {
    const nextIsAuthored = this.themeName() === 'Classic';
    const theme = nextIsAuthored ? authoredTheme : classicTheme;
    const name = nextIsAuthored ? 'Authored blue' : 'Classic';
    this.adoptTheme(theme, name, source);
    this.applyTheme(theme);
  }

  /**
   * Synchronize lesson evidence after the shared shell chooses a preset.
   *
   * @param theme Complete preset applied by the shell.
   * @param name Preset label shown in the shared menu.
   * @param source Interaction path that selected the theme.
   */
  public adoptTheme(theme: Theme, name: string, source: 'keyboard' | 'mouse' | 'menu'): void {
    this.activeTheme = theme;
    this.themeName.set(name);
    this.themeSwitches += 1;
    this.actionSource.set(source);
  }

  /** Check that the four displayed states resolve through distinct semantic role values. */
  public checkRoles(source: 'keyboard' | 'mouse'): void {
    const normal = this.activeTheme.button;
    const focused = this.activeTheme.buttonFocused;
    const selected = this.activeTheme.listSelected;
    const disabled = this.activeTheme.buttonDisabled;
    const differs = (left: typeof normal, right: typeof normal): boolean =>
      left.fg !== right.fg || left.bg !== right.bg || (left.attrs ?? Attr.none) !== (right.attrs ?? Attr.none);
    const passed =
      differs(normal, focused) && differs(this.activeTheme.listNormal, selected) && differs(normal, disabled);
    this.roleChecks += 1;
    this.roleResult.set(passed ? 'pass · every state has distinct evidence' : 'FAIL · roles collapse');
    this.actionSource.set(source);
  }

  /** Measure a concrete, resolvable foreground/background pair from the active theme. */
  public auditContrast(source: 'keyboard' | 'mouse'): void {
    const role = this.activeTheme.staticText;
    const ratio = contrastRatio(role.fg, role.bg);
    this.contrastChecks += 1;
    this.contrastResult.set(
      Number.isFinite(ratio) ? `ratio ${ratio.toFixed(2)} · ${ratio >= 4.5 ? 'pass' : 'FAIL'}` : 'cannot verify',
    );
    this.actionSource.set(source);
  }
}
