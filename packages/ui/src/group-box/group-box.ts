import { sanitize } from '@jsvision/core';
import type { Padding } from '../layout/index.js';
import type { Owner } from '../reactive/index.js';
import { clipCellText, stringWidth } from '../controls/measure.js';
import { Group } from '../view/index.js';
import type { DrawContext, ThemeRoleName, ViewHost } from '../view/index.js';

/** Horizontal placement of a {@link GroupBox} caption within its top border. */
export type GroupBoxTitleAlignment = 'start' | 'center' | 'end';

/** Construction options for a {@link GroupBox}. */
export interface GroupBoxOptions {
  /** A fixed caption, or a reactive getter whose signal dependencies repaint the box. */
  readonly title?: string | (() => string);
  /** Caption placement within the top-border interior. Defaults to `'start'`. */
  readonly titleAlignment?: GroupBoxTitleAlignment;
  /** Initial content inset in terminal cells. A number applies to every side. Defaults to `1`. */
  readonly padding?: number | Padding;
  /** Theme role used for the border, caption, and opaque interior. Defaults to `'staticText'`. */
  readonly role?: ThemeRoleName;
  /** Whether the renderer adds its standard drop shadow. Defaults to `false`. */
  readonly shadow?: boolean;
}

/**
 * Convert untrusted caption input into the single line used for both geometry and painting.
 *
 * The shared sanitizer intentionally retains tabs and newlines for general text output. A frame
 * caption cannot span rows, so those two separators become ordinary spaces before width math.
 */
function captionDisplayText(title: string): string {
  return sanitize(title).replace(/[\t\n]/g, ' ');
}

/**
 * A passive framed container for visually grouping related views.
 *
 * `GroupBox` participates in ordinary `Group` layout and focus traversal but never receives focus
 * or handles input itself. Its configured padding is only the initial layout value; later
 * {@link GroupBox.setLayout} calls remain authoritative.
 *
 * @example
 * import { GroupBox, Text, col, grow } from '@jsvision/ui';
 *
 * const details = new GroupBox({ title: 'Application', padding: 1 });
 * details.add(grow(col({}, new Text('Name: Customer Portal'), new Text('Status: Active'))));
 */
export class GroupBox extends Group {
  private readonly title: string | (() => string);
  private readonly titleAlignment: GroupBoxTitleAlignment;
  private readonly role: ThemeRoleName;

  /**
   * Create a passive framed group.
   *
   * @param options Optional caption, alignment, padding, theme role, and shadow configuration.
   */
  constructor(options: GroupBoxOptions = {}) {
    super();
    this.title = options.title ?? '';
    this.titleAlignment = options.titleAlignment ?? 'start';
    this.role = options.role ?? 'staticText';
    this.castsShadow = options.shadow ?? false;
    this.setLayout({ padding: options.padding ?? 1 });
  }

  /**
   * Mount the group and establish a getter-title subscription in the new view scope.
   *
   * A view receives a fresh reactive scope after removal and re-addition. Binding on every mount
   * keeps the same GroupBox instance reactive across that lifecycle while inherited unmount cleanup
   * disposes the previous subscription.
   *
   * @param host Render-root services used for repaint and reflow requests.
   * @param parentScope Reactive owner that contains this view's scope.
   * @internal
   */
  override mount(host: ViewHost | null, parentScope: Owner | null): void {
    super.mount(host, parentScope);
    if (typeof this.title === 'function') this.bind(this.title);
  }

  /**
   * Paint the opaque frame and optional caption inside the view's clipped bounds.
   *
   * @param ctx The view-local drawing context supplied by the renderer.
   */
  override draw(ctx: DrawContext): void {
    const style = ctx.color(this.role);
    const { width, height } = ctx.size;
    ctx.fill(' ', style);

    if (width < 2 || height < 2) return;
    ctx.box(0, 0, width, height, style);

    const rawTitle = typeof this.title === 'function' ? this.title() : this.title;
    const title = captionDisplayText(rawTitle);
    const interiorWidth = width - 2;
    if (title === '' || interiorWidth <= 0) return;

    const caption = stringWidth(title) + 2 <= interiorWidth ? ` ${title} ` : clipCellText(title, interiorWidth);
    const captionWidth = stringWidth(caption);
    if (captionWidth <= 0) return;

    let offset = 0;
    if (this.titleAlignment === 'center') offset = Math.floor((interiorWidth - captionWidth) / 2);
    else if (this.titleAlignment === 'end') offset = interiorWidth - captionWidth;

    ctx.text(1 + offset, 0, caption, style);
  }
}
