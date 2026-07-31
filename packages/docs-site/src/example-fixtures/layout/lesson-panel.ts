import { View } from '@jsvision/ui';
import type { DrawContext, Size2D, ThemeRoleName } from '@jsvision/ui';

/**
 * A labelled colored region used by the Layout guide to make solved rectangles visible.
 *
 * The panel deliberately owns no layout behavior. Its parent decides its bounds, which lets the
 * live lessons expose the real result of `row`, `col`, `grow`, and overlay placement.
 */
export class LayoutLessonPanel extends View {
  /** Stable teaching label used both on screen and by the focused guide specifications. */
  public readonly lessonName: string;

  /** Optional second line explaining the panel's sizing or placement role. */
  public readonly detail: string;

  /** Semantic theme role used to distinguish adjacent layout regions. */
  public readonly role: ThemeRoleName;

  /**
   * @param lessonName Short name painted on the first row.
   * @param detail Optional explanation painted on the second row when space permits.
   * @param role Theme role used for the complete panel surface.
   */
  public constructor(lessonName: string, detail = '', role: ThemeRoleName = 'window') {
    super();
    this.lessonName = lessonName;
    this.detail = detail;
    this.role = role;
  }

  /**
   * Report a compact natural size for demonstrations that use `auto` or non-stretch alignment.
   *
   * @returns The label width plus horizontal breathing room, and one or two text rows.
   */
  public override measure(): Size2D {
    return {
      width: Math.max(this.lessonName.length, this.detail.length) + 2,
      height: this.detail === '' ? 1 : 2,
    };
  }

  /** Paint the entire solved rectangle so its size remains obvious after every reflow. */
  public override draw(ctx: DrawContext): void {
    const style = ctx.color(this.role);
    ctx.fill(' ', style);
    if (ctx.size.width > 2 && ctx.size.height > 0) ctx.text(1, 0, this.lessonName, style);
    if (this.detail !== '' && ctx.size.width > 2 && ctx.size.height > 1) ctx.text(1, 1, this.detail, style);
  }
}
