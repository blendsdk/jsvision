import { degradeCapsFully, fallbackGlyph, isAsciiSafe, resolveCapabilities } from '@jsvision/core';
import type { CapabilityProfile } from '@jsvision/core';
import { View } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';

const UTF8_CAPS = resolveCapabilities({
  env: { TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
  platform: 'linux',
  override: {
    unicode: { utf8: true, widthMode: 'wcwidth', emoji: 'wide' },
    glyphs: { boxDrawing: true, halfBlocks: true, ambiguousWide: false },
  },
}).profile;

interface FallbackProfile {
  /** Name shown to the learner and exposed to focused tests. */
  readonly name: string;
  /** Immutable capability profile used by the public fallback helper. */
  readonly caps: CapabilityProfile;
}

const PROFILES: readonly FallbackProfile[] = [
  { name: 'UTF-8', caps: UTF8_CAPS },
  {
    name: 'Adapted chrome',
    caps: {
      ...UTF8_CAPS,
      glyphs: { ...UTF8_CAPS.glyphs, ambiguousWide: true },
    },
  },
  { name: 'ASCII-safe', caps: degradeCapsFully(UTF8_CAPS) },
];

/**
 * Deterministic capability and glyph-fallback evidence for the Unicode course.
 *
 * It never probes the visitor host. Every state is an explicit immutable profile passed through
 * the same public fallback functions used by the renderer.
 */
export class GlyphFallbackPanel extends View {
  /** Stable teaching label used by the focused course specification. */
  public readonly lessonName = 'Glyph fallback';

  protected profileIndex = 0;
  protected utf8Off = false;
  protected actionSource = 'ready';

  /** Current profile name, independent of the optional UTF-8-off overlay. */
  public get profileName(): string {
    return (PROFILES[this.profileIndex] ?? PROFILES[0]).name;
  }

  /** Advance through Unicode, adapted-chrome, and fully degraded chrome profiles. */
  public cycleProfile(source: 'keyboard' | 'mouse'): void {
    this.profileIndex = (this.profileIndex + 1) % PROFILES.length;
    this.utf8Off = false;
    this.actionSource = source;
    this.invalidate();
  }

  /** Toggle the distinct UTF-8 availability boundary for the selected chrome profile. */
  public toggleUtf8(source: 'keyboard' | 'mouse'): void {
    this.utf8Off = !this.utf8Off;
    this.actionSource = source;
    this.invalidate();
  }

  /** Return the immutable teaching profile after applying the UTF-8 availability state. */
  protected effectiveCaps(): CapabilityProfile {
    const caps = (PROFILES[this.profileIndex] ?? PROFILES[0]).caps;
    if (!this.utf8Off) return caps;
    return { ...caps, unicode: { ...caps.unicode, utf8: false } };
  }

  /** Paint exact public fallback results with persistent text labels and status. */
  public override draw(ctx: DrawContext): void {
    const style = ctx.color('staticText');
    const caps = this.effectiveCaps();
    const box = `${fallbackGlyph('┌', caps)}${fallbackGlyph('─', caps)}${fallbackGlyph('┐', caps)}`;

    ctx.fill(' ', style);
    ctx.text(0, 0, `Profile: ${this.profileName}`, style);
    ctx.text(0, 1, `Box: ${box}`, style);
    ctx.text(0, 2, `Arrow: ${fallbackGlyph('▲', caps)}`, style);
    ctx.text(0, 3, `Block: ${fallbackGlyph('█', caps)}`, style);
    ctx.text(0, 4, `isAsciiSafe: ${isAsciiSafe(caps) ? 'yes' : 'no'}`, style);
    ctx.text(0, 5, `UTF-8: ${caps.unicode.utf8 ? 'yes' : 'no'}`, style);
    ctx.text(0, 6, `Text: ${fallbackGlyph('é', caps)}`, style);
    ctx.text(0, 7, `READY · decomposed e + mark: ${fallbackGlyph('e\u0301', caps)}`, style);
    ctx.text(0, 8, `Action source: ${this.actionSource}`, style);
  }
}
