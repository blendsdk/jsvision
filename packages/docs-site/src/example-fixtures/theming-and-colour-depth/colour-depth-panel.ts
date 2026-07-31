import {
  ANSI16_ORDER,
  Attr,
  contrastRatio,
  encodeStyle,
  fallbackGlyph,
  nearest16,
  nearest256,
  resolveCapabilities,
  rgb256,
  toRgb,
} from '@jsvision/core';
import type { Color, ColorDepth, Rgb } from '@jsvision/core';
import { Group, Text, View, at, signal } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';

const ACCENT: Color = '#3b82f6';

/** Resolve a fixture color once and fail fast if its authored value is invalid. */
function requiredRgb(color: Color): Rgb {
  const rgb = toRgb(color);
  if (rgb === null) throw new Error('The depth laboratory accent must resolve to RGB');
  return rgb;
}

const ACCENT_RGB = requiredRgb(ACCENT);

const DEPTHS: readonly ColorDepth[] = ['truecolor', '256', '16', 'mono'];

/** Convert a resolved RGB value to a concrete six-digit hex color. */
function hexOf(rgb: Rgb): Color {
  const channel = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

/** Choose black or white text for a fixed preview background. */
function foregroundOn(background: Color): Color {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#000000') ? '#ffffff' : '#000000';
}

/** Resolve a labelled stand-in color for one public encoder depth. */
function previewStyle(depth: ColorDepth): { readonly fg: Color; readonly bg: Color; readonly attrs?: number } {
  if (depth === 'mono') return { fg: 'default', bg: 'default', attrs: Attr.reverse };
  const background =
    depth === 'truecolor'
      ? ACCENT
      : depth === '256'
        ? hexOf(rgb256(nearest256(ACCENT_RGB)))
        : ANSI16_ORDER[nearest16(ACCENT_RGB)];
  return { fg: foregroundOn(background), bg: background };
}

/** Four side-by-side stand-ins derived from the same public downsampling primitives as the encoder. */
class DepthPreviewStrip extends View {
  protected readonly currentDepth: () => ColorDepth;

  /**
   * @param currentDepth Getter for the currently selected evidence row.
   */
  public constructor(currentDepth: () => ColorDepth) {
    super();
    this.currentDepth = currentDepth;
  }

  /** Paint all depth stand-ins together so palette collapse is visually comparable. */
  public override draw(ctx: DrawContext): void {
    const baseWidth = Math.floor(ctx.size.width / DEPTHS.length);
    for (const [index, depth] of DEPTHS.entries()) {
      const x = index * baseWidth;
      const width = index === DEPTHS.length - 1 ? ctx.size.width - x : baseWidth;
      const style = previewStyle(depth);
      const marker = depth === this.currentDepth() ? '>' : ' ';
      ctx.fillRect(x, 0, width, 1, ' ', style);
      ctx.text(x, 0, `${marker}${depth}`.slice(0, width), style);
    }
  }
}

/**
 * Demonstrates capability-owned colour encoding, monochrome attributes, and glyph fallbacks.
 *
 * The mounted docs terminal keeps its immutable host profile. This panel instead compares explicit,
 * deterministic profiles through public encoder and fallback APIs, so it never claims to mutate the
 * visitor's terminal capabilities.
 */
export class ColourDepthPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Colour depth degradation';

  /** Number of depth-selection changes. */
  public depthChanges = 0;

  /** Number of times monochrome evidence was reached. */
  public monochromeChecks = 0;

  /** Number of ASCII fallback checks. */
  public asciiChecks = 0;

  /** Number of completed panel cleanups. */
  public cleanupCount = 0;

  /** Current depth index in the documented degradation order. */
  protected depthIndex = 0;

  /** Current depth label. */
  protected readonly depth = signal<ColorDepth>('truecolor');

  /** Latest encoder evidence. */
  protected readonly encoderResult = signal(this.encoderEvidence('truecolor'));

  /** Current Unicode or ASCII-safe glyph evidence. */
  protected readonly asciiResult = signal('off · glyphs: ┌─█ · meaning retained');

  /** Latest monochrome evidence. */
  protected readonly monochromeResult = signal('not reached');

  /** Latest input path. */
  protected readonly actionSource = signal('ready');

  /** Visual comparison strip invalidated when the selected depth changes. */
  protected readonly preview = new DepthPreviewStrip(() => this.depth());

  /** Build the bounded depth and fallback evidence rows. */
  public constructor() {
    super();
    this.add(at(new Text(() => `Depth: ${this.depth()} · authored accent: ${ACCENT}`), 0, 0, 56, 1));
    this.add(at(this.preview, 0, 1, 56, 1));
    this.add(at(new Text(() => `Encoder: ${this.encoderResult()}`), 0, 2, 56, 1));
    this.add(at(new Text('State cue: > marks selected depth · labels preserve meaning'), 0, 3, 56, 1));
    this.add(at(new Text(() => `ASCII: ${this.asciiResult()}`), 0, 4, 56, 1));
    this.add(at(new Text(() => `Monochrome: ${this.monochromeResult()}`), 0, 5, 56, 1));
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 6, 56, 1));
    this.add(at(new Text('Host caps stay immutable; these are explicit profile results.'), 0, 7, 56, 1));
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }

  /** Depth whose exact public encoder evidence is currently displayed. */
  public get currentDepth(): ColorDepth {
    return this.depth();
  }

  /** Exact SGR parameter evidence currently displayed by the lesson. */
  public get currentEncoderEvidence(): string {
    return this.encoderResult();
  }

  /** Advance through truecolor, 256, 16, and mono evidence profiles. */
  public nextDepth(source: 'keyboard' | 'mouse'): void {
    this.depthIndex = (this.depthIndex + 1) % DEPTHS.length;
    const next = DEPTHS[this.depthIndex] ?? 'truecolor';
    this.depth.set(next);
    this.encoderResult.set(this.encoderEvidence(next));
    this.depthChanges += 1;
    if (next === 'mono') {
      this.monochromeChecks += 1;
      this.monochromeResult.set('attributes active · no colour codes · meaning PASS');
    }
    this.actionSource.set(source);
    this.preview.invalidate();
  }

  /** Toggle between Unicode teaching glyphs and their public ASCII fallbacks. */
  public checkAscii(source: 'keyboard' | 'mouse'): void {
    const ascii = this.asciiChecks % 2 === 0;
    this.asciiChecks += 1;
    if (ascii) {
      const caps = resolveCapabilities({
        env: {},
        platform: 'linux',
        override: {
          unicode: { utf8: false },
          glyphs: { boxDrawing: false, halfBlocks: false, ambiguousWide: true },
        },
      }).profile;
      const glyphs = [fallbackGlyph('┌', caps), fallbackGlyph('─', caps), fallbackGlyph('█', caps)].join('');
      this.asciiResult.set(`safe · glyphs: ${glyphs} · meaning PASS`);
    } else {
      this.asciiResult.set('off · glyphs: ┌─█ · meaning retained');
    }
    this.actionSource.set(source);
  }

  /** Produce bounded, printable evidence from the exact public style encoder. */
  protected encoderEvidence(depth: ColorDepth): string {
    const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: depth } }).profile;
    const output = encodeStyle(ACCENT, '#101827', Attr.reverse, caps);
    const params = output.replace('\u001b[', '').replace('m', '');
    return params === '' ? 'none' : params;
  }
}
