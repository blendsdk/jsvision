// Fixture: `@example` tags on class and interface members. A bare member name is
// not file-unique by construction, so members are qualified by their owner.

export class Widget {
  /**
   * Draw the widget.
   *
   * @example
   * const w = new Widget();
   * w.draw();
   */
  draw(): void {}
}

export interface Drawable {
  /**
   * Draw whatever implements this.
   *
   * @example
   * declare const d: Drawable;
   * d.draw();
   */
  draw(): void;
}
