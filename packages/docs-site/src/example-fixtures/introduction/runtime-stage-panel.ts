import { View } from '@jsvision/ui';
import type { DrawContext, Size2D } from '@jsvision/ui';

/**
 * One stage in the Introduction course's application-to-frame pipeline.
 *
 * Every stage remains visible so the learner can compare responsibilities. The active stage uses a
 * semantic focused-list surface and also paints the word `CURRENT`, preserving the distinction in
 * monochrome and other reduced-color environments.
 */
export class RuntimeStagePanel extends View {
  /** Short layer name shown on the first row. */
  public readonly stageName: string;

  /** Concise responsibility shown beneath the layer name. */
  public readonly detail: string;

  /** Reactive accessor that identifies the currently explained layer. */
  public readonly active: () => boolean;

  /**
   * @param stageName Short application, host, or frame label.
   * @param detail One-line responsibility owned by the stage.
   * @param active Reactive current-stage accessor.
   */
  public constructor(stageName: string, detail: string, active: () => boolean) {
    super();
    this.stageName = stageName;
    this.detail = detail;
    this.active = active;
    this.onMount(() => this.bind(active));
  }

  /**
   * Report enough room for the longest authored line and the non-color current marker.
   *
   * @returns Natural width and three fixed teaching rows.
   */
  public override measure(): Size2D {
    return {
      width: Math.max(this.stageName.length, this.detail.length, 'CURRENT'.length),
      height: 3,
    };
  }

  /** Paint the stage name, responsibility, and an explicit current-state marker. */
  public override draw(ctx: DrawContext): void {
    const current = this.active();
    const style = ctx.color(current ? 'listFocused' : 'staticText');
    ctx.fill(' ', style);
    ctx.text(0, 0, this.stageName, style);
    if (ctx.size.height > 1) ctx.text(0, 1, this.detail, style);
    if (current && ctx.size.height > 2) ctx.text(0, 2, 'CURRENT', style);
  }
}
