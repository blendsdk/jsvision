import {
  classicTheme,
  degradeCapsFully,
  fallbackGlyph,
  isAsciiSafe,
  monochromeTheme,
  resolveCapabilities,
} from '@jsvision/core';
import { Group, Text, View, at, signal } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';

/** Presentation profiles compared by the resilient accessibility laboratory. */
export type ResilientProfile = 'Classic' | 'NO_COLOR' | 'Monochrome' | 'ASCII' | 'Narrow';

const PROFILES: readonly ResilientProfile[] = ['Classic', 'NO_COLOR', 'Monochrome', 'ASCII', 'Narrow'];
const WIDE_SURFACE_WIDTH = 54;
const NARROW_SURFACE_WIDTH = 28;
const SURFACE_HEIGHT = 4;

/** Evidence observed while drawing one concrete comparison surface. */
interface RenderedProfileEvidence {
  readonly profile: ResilientProfile;
  readonly width: number;
  readonly semanticLabelsPresent: boolean;
  readonly clippingFailures: number;
  readonly asciiUnsafeGlyphs: number;
  readonly monochromeAttributesPresent: boolean;
}

/**
 * Paints the same semantic states with explicit profile styles, glyphs, and solved geometry.
 *
 * Verification is performed from the exact strings, styles, fallback glyphs, and `DrawContext`
 * dimensions used for the frame. This avoids treating a profile label or pre-incremented counter as
 * evidence.
 */
class ResilienceEvidenceSurface extends View {
  protected readonly profile: () => ResilientProfile;
  protected readonly report: (evidence: RenderedProfileEvidence) => void;

  /**
   * @param profile Getter for the selected explicit profile.
   * @param report Sink that records evidence from the completed draw.
   */
  public constructor(profile: () => ResilientProfile, report: (evidence: RenderedProfileEvidence) => void) {
    super();
    this.profile = profile;
    this.report = report;
  }

  /** Paint semantic state rows and report facts derived from the actual draw inputs. */
  public override draw(ctx: DrawContext): void {
    const profile = this.profile();
    const ascii = profile === 'ASCII' || profile === 'Narrow';
    const caps = ascii
      ? degradeCapsFully(resolveCapabilities({ env: {}, platform: 'linux' }).profile)
      : resolveCapabilities({
          env: profile === 'NO_COLOR' ? { NO_COLOR: '', FORCE_COLOR: '3' } : {},
          platform: 'linux',
        }).profile;
    const theme = profile === 'NO_COLOR' || profile === 'Monochrome' ? monochromeTheme : classicTheme;
    const focusedStyle = theme.buttonFocused;
    const normalStyle = theme.window;
    const horizontal = ascii ? fallbackGlyph('─', caps) : '─';
    const leftCorner = ascii ? fallbackGlyph('┌', caps) : '┌';
    const rightCorner = ascii ? fallbackGlyph('┐', caps) : '┐';
    const chrome = `${leftCorner}${horizontal.repeat(Math.max(0, ctx.size.width - 2))}${rightCorner}`;
    const lines = ['FOCUSED: > Save', 'SELECTED: [x] | DISABLED: !', 'ERROR: retry | PASS'] as const;

    ctx.text(0, 0, chrome, normalStyle);
    ctx.text(0, 1, lines[0], focusedStyle);
    ctx.text(0, 2, lines[1], normalStyle);
    ctx.text(0, 3, lines[2], normalStyle);

    const rendered = [chrome, ...lines];
    const clippingFailures =
      ctx.size.height < SURFACE_HEIGHT ? 1 : rendered.filter((line) => line.length > ctx.size.width).length;
    const asciiUnsafeGlyphs = ascii
      ? Array.from(rendered.join('')).filter((glyph) => !/^[\x20-\x7e]$/u.test(glyph)).length
      : 0;
    const semanticLabelsPresent = ['FOCUSED', 'SELECTED', 'DISABLED', 'ERROR', 'PASS'].every((label) =>
      lines.some((line) => line.includes(label)),
    );
    const monochromeAttributesPresent =
      profile !== 'NO_COLOR' && profile !== 'Monochrome'
        ? true
        : (focusedStyle.attrs ?? 0) !== (normalStyle.attrs ?? 0) &&
          (profile !== 'NO_COLOR' || caps.colorDepth === 'mono');
    this.report({
      profile,
      width: ctx.size.width,
      semanticLabelsPresent,
      clippingFailures,
      asciiUnsafeGlyphs,
      monochromeAttributesPresent,
    });
  }
}

/**
 * Demonstrates that rendered semantic cells survive colour loss, glyph degradation, and narrow
 * geometry.
 *
 * The fixture paints explicit public capability and theme profiles inside the mounted docs
 * application. It does not mutate or make claims about the visitor's real terminal.
 */
export class ResilientPresentationPanel extends Group {
  /** Stable teaching identity used by the accessibility course contract. */
  public readonly lessonName = 'Resilient presentation';

  /** Number of profile transitions. */
  public profileChanges = 0;

  /** Number of transitions verified from a completed rendered surface. */
  public meaningChecks = 0;

  /** Number of rendered lines exceeding the solved evidence-surface bounds. */
  public clippingFailures = 0;

  /** Number of non-ASCII glyphs painted by an ASCII-safe profile. */
  public asciiUnsafeGlyphs = 0;

  /** Number of rendered monochrome profiles with distinct focused attributes. */
  public monochromeAttributeChecks = 0;

  /** Number of owner cleanup transitions. */
  public cleanupCount = 0;

  protected profileIndex = 0;
  protected readonly profile = signal<ResilientProfile>('Classic');
  protected readonly capability = signal('truecolor + Unicode chrome');
  protected readonly geometry = signal('wide 54 cells');
  protected readonly surface = new ResilienceEvidenceSurface(
    () => this.profile(),
    (evidence) => this.recordRenderedEvidence(evidence),
  );
  protected active = false;
  protected verifiedTransition = 0;

  /** Build the mounted rendered surface plus bounded capability and host evidence. */
  public constructor() {
    super();
    this.add(at(this.surface, 0, 0, WIDE_SURFACE_WIDTH, SURFACE_HEIGHT));
    this.add(at(new Text(() => `Profile: ${this.profile()} · ${this.capability()} · ${this.geometry()}`), 0, 4, 54, 1));
    this.add(at(new Text('Browser cells/focus/resize do not prove screen readers'), 0, 5, 54, 1));
    this.onMount(() => {
      this.active = true;
      this.onCleanup(() => {
        if (!this.active) return;
        this.active = false;
        this.cleanupCount += 1;
      });
    });
  }

  /** Current explicit evidence profile. */
  public get profileName(): ResilientProfile {
    return this.profile();
  }

  /** Solved width of the actual rendered comparison surface. */
  public get renderedSurfaceWidth(): number {
    return this.surface.bounds.width;
  }

  /** Advance to the next deterministic profile and request a fresh evidence render. */
  public nextProfile(): void {
    if (!this.active) return;
    this.profileIndex = (this.profileIndex + 1) % PROFILES.length;
    const next = PROFILES[this.profileIndex] ?? 'Classic';
    this.profileChanges += 1;
    this.profile.set(next);
    this.applyProfile(next);
    this.surface.invalidate();
  }

  /** Apply capability text and a genuine solved-width change for the selected profile. */
  protected applyProfile(profile: ResilientProfile): void {
    const width = profile === 'Narrow' ? NARROW_SURFACE_WIDTH : WIDE_SURFACE_WIDTH;
    this.surface.setLayout({ rect: { x: 0, y: 0, width, height: SURFACE_HEIGHT } });
    this.surface.invalidateLayout();
    this.geometry.set(profile === 'Narrow' ? 'narrow 28 cells' : 'wide 54 cells');
    if (profile === 'NO_COLOR') {
      const caps = resolveCapabilities({
        env: { NO_COLOR: '', FORCE_COLOR: '3', TERM: 'xterm-256color' },
        platform: 'linux',
      }).profile;
      this.capability.set(`${caps.colorDepth} from NO_COLOR presence`);
      return;
    }
    if (profile === 'Monochrome') {
      this.capability.set('attrs reverse/underline/bold');
      return;
    }
    if (profile === 'ASCII') {
      const ascii = degradeCapsFully(resolveCapabilities({ env: {}, platform: 'linux' }).profile);
      this.capability.set(isAsciiSafe(ascii) ? 'ASCII-safe rendered chrome' : 'ASCII check failed');
      return;
    }
    if (profile === 'Narrow') {
      this.capability.set('essential states retained');
      return;
    }
    this.capability.set('truecolor + Unicode chrome');
  }

  /** Accept a transition only after its actual rendered styles, glyphs, labels, and bounds pass. */
  protected recordRenderedEvidence(evidence: RenderedProfileEvidence): void {
    this.clippingFailures = evidence.clippingFailures;
    this.asciiUnsafeGlyphs = evidence.asciiUnsafeGlyphs;
    if (
      this.profileChanges === 0 ||
      this.verifiedTransition === this.profileChanges ||
      evidence.profile !== this.profile()
    ) {
      return;
    }
    if (
      evidence.semanticLabelsPresent &&
      evidence.clippingFailures === 0 &&
      evidence.asciiUnsafeGlyphs === 0 &&
      evidence.monochromeAttributesPresent
    ) {
      this.verifiedTransition = this.profileChanges;
      this.meaningChecks += 1;
      if (evidence.profile === 'NO_COLOR' || evidence.profile === 'Monochrome') {
        this.monochromeAttributeChecks += 1;
      }
    }
  }
}
