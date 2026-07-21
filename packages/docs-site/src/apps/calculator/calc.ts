/**
 * The calculator engine and its LCD display view, faithful to the classic Turbo Vision calculator:
 * an immediate-execution state machine (fresh entry → valid → error) behind a right-aligned display
 * that shows a sign glyph immediately to the left of the number, white on a blue field.
 *
 * The engine keeps its state private and publishes only what the display needs through a signal, so
 * the display view repaints reactively as keys arrive.
 */
import { View, signal } from '@jsvision/ui';
import type { DrawContext, DispatchEvent, Signal } from '@jsvision/ui';

/** The display's white-on-blue LCD colours (the classic calculator look). */
const LCD_FG: `#${string}` = '#ffffff';
const LCD_BG: `#${string}` = '#0000aa';

/** Largest visible display length before the result overflows to "Error". */
const MAX_LEN = 15;

/** What the display renders: the number text and a one-char sign (`' '` or `'-'`). */
export interface CalcView {
  readonly number: string;
  readonly sign: string;
}

/** Trim floating-point noise the way the original's default formatting does, then stringify. */
function format(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  // Round to 15 significant digits so 0.1 + 0.2 reads "0.3", then drop a trailing exponent-free zero.
  return Number.parseFloat(n.toPrecision(15)).toString();
}

/**
 * The calculator's immediate-execution state machine. Feed it one logical key at a time with
 * {@link CalcEngine.key}; read {@link CalcEngine.view} (a signal) to render the display.
 */
export class CalcEngine {
  private status: 'first' | 'valid' | 'error' = 'first';
  private number = '0';
  private sign = ' ';
  private operate = '=';
  private operand = 0;

  /** The current display state — updated after every key so a bound view repaints. */
  readonly view: Signal<CalcView> = signal<CalcView>({ number: '0', sign: ' ' });

  private display(): number {
    return Number.parseFloat(this.number);
  }

  private signed(): number {
    return this.display() * (this.sign === '-' ? -1 : 1);
  }

  private publish(): void {
    this.view.set({ number: this.number, sign: this.sign });
  }

  private clear(): void {
    this.status = 'first';
    this.number = '0';
    this.sign = ' ';
    this.operate = '=';
    this.operand = 0;
  }

  private error(): void {
    this.status = 'error';
    this.number = 'Error';
    this.sign = ' ';
  }

  /** On the first digit after an operator or clear, start a fresh "0" entry to append onto. */
  private checkFirst(): void {
    if (this.status === 'first') {
      this.status = 'valid';
      this.number = '0';
      this.sign = ' ';
    }
  }

  private setDisplay(r: number): void {
    const text = format(Math.abs(r));
    this.sign = r < 0 ? '-' : ' ';
    if (text.length > MAX_LEN) this.error();
    else this.number = text;
  }

  private applyPending(key: string): void {
    if (this.status === 'valid') {
      this.status = 'first';
      let r = this.signed();
      if (key === '%') r = this.operate === '+' || this.operate === '-' ? (this.operand * r) / 100 : r / 100;
      switch (this.operate) {
        case '+':
          this.setDisplay(this.operand + r);
          break;
        case '-':
          this.setDisplay(this.operand - r);
          break;
        case '*':
          this.setDisplay(this.operand * r);
          break;
        case '/':
          if (r === 0) this.error();
          else this.setDisplay(this.operand / r);
          break;
      }
    }
    this.operate = key;
    this.operand = this.signed();
  }

  /**
   * Apply one logical key. Digits `0`–`9`, `.`, the operators `+ - * / = %`, `C` (clear), `←`
   * (backspace) and `±` (sign toggle) are recognised. In the error state every key but `C` is
   * ignored, exactly as the original.
   *
   * @param key The logical key to apply.
   */
  key(key: string): void {
    if (this.status === 'error' && key !== 'C') {
      this.publish();
      return;
    }
    if (key >= '0' && key <= '9') {
      this.checkFirst();
      if (this.number.length < MAX_LEN) this.number = this.number === '0' ? key : this.number + key;
    } else if (key === '.') {
      this.checkFirst();
      if (!this.number.includes('.')) this.number += '.';
    } else if (key === '←') {
      this.checkFirst();
      this.number = this.number.length === 1 ? '0' : this.number.slice(0, -1);
    } else if (key === '±') {
      this.sign = this.sign === ' ' ? '-' : ' ';
    } else if (key === '+' || key === '-' || key === '*' || key === '/' || key === '=' || key === '%') {
      this.applyPending(key);
    } else if (key === 'C') {
      this.clear();
    }
    this.publish();
  }
}

/** Map a decoded key to a logical calculator key, or `null` to leave the event unconsumed. */
function keyOf(key: string): string | null {
  if (key.length === 1 && '0123456789.+-*/=%'.includes(key)) return key;
  if (key === 'backspace') return '←';
  if (key === 'enter') return '=';
  if (key === 'c' || key === 'C') return 'C';
  if (key === '_') return '±'; // the original's keyboard shortcut for the sign toggle
  return null;
}

/**
 * The calculator's LCD: a selectable single line that fills its width with the blue field and draws
 * the number right-aligned, with the sign glyph in the cell immediately to its left (a two-cell
 * right margin), exactly as the original lays it out. Like the original's display, it is the view
 * that consumes the keyboard, so digits and operators typed anywhere in the dialog reach the engine.
 */
export class CalcDisplay extends View {
  override focusable = true;
  private lcd: CalcView;

  /**
   * @param engine The calculator engine to render and to drive from the keyboard.
   */
  constructor(private readonly engine: CalcEngine) {
    super();
    this.lcd = engine.view();
    this.onMount(() => {
      this.bind(
        () => this.engine.view(),
        (v) => {
          this.lcd = v;
        },
      );
    });
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'key') return;
    const key = keyOf(inner.key);
    if (key !== null) {
      this.engine.key(key);
      ev.handled = true;
    }
  }

  override draw(ctx: DrawContext): void {
    const style = { fg: LCD_FG, bg: LCD_BG };
    ctx.fill(' ', style);
    const { number, sign } = this.lcd;
    const i = Math.max(0, ctx.size.width - number.length - 2);
    ctx.text(i, 0, sign, style);
    ctx.text(i + 1, 0, number, style);
  }
}
