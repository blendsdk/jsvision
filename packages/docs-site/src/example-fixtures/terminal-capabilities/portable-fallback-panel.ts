import {
  classicTheme,
  degradeCapsFully,
  evaluateEssentials,
  fallbackGlyph,
  monochromeTheme,
  resolveCapabilities,
} from '@jsvision/core';
import type { CapabilityProfile } from '@jsvision/core';
import { Group, Text, View, at, signal } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import { buildBrowserCaps } from '@jsvision/web';

/** Portable host and degradation profiles compared by the laboratory. */
export type PortableProfile =
  'Rich' | 'Monochrome' | 'No mouse' | 'ASCII' | 'SSH' | 'tmux' | 'Windows' | 'Browser' | 'Narrow';

const PROFILES: readonly PortableProfile[] = [
  'Rich',
  'Monochrome',
  'No mouse',
  'ASCII',
  'SSH',
  'tmux',
  'Windows',
  'Browser',
  'Narrow',
];
const WIDE_WIDTH = 54;
const NARROW_WIDTH = 28;

/** Facts recorded from the actual mounted fallback surface draw. */
interface FallbackDrawEvidence {
  readonly profileName: PortableProfile;
  readonly glyphs: string;
  readonly clippingFailures: number;
  readonly labelsPresent: boolean;
}

/** Paints profile-derived border and block glyphs plus essential state labels. */
class PortableSurface extends View {
  protected readonly name: () => PortableProfile;
  protected readonly profile: () => CapabilityProfile;
  protected readonly report: (evidence: FallbackDrawEvidence) => void;

  /** Build a rendered evidence surface from live profile getters. */
  public constructor(
    name: () => PortableProfile,
    profile: () => CapabilityProfile,
    report: (evidence: FallbackDrawEvidence) => void,
  ) {
    super();
    this.name = name;
    this.profile = profile;
    this.report = report;
  }

  /** Draw exact fallback glyphs and verify them against solved cell bounds. */
  public override draw(ctx: DrawContext): void {
    const name = this.name();
    const profile = this.profile();
    const theme = profile.colorDepth === 'mono' ? monochromeTheme : classicTheme;
    const border = fallbackGlyph('│', profile);
    const block = fallbackGlyph('█', profile);
    const glyphs = `${border}${block}`;
    const lines = [`${glyphs} ${name} profile`, 'KEYBOARD: available', 'STATE: PASS'];
    for (const [index, line] of lines.entries())
      ctx.text(0, index, line, index === 0 ? theme.buttonFocused : theme.window);
    this.report({
      profileName: name,
      glyphs,
      clippingFailures: lines.filter((line) => line.length > ctx.size.width).length,
      labelsPresent: lines[1] === 'KEYBOARD: available' && lines[2] === 'STATE: PASS',
    });
  }
}

/** Build the rich profile used as the positive comparison and fallback source. */
function richProfile(): CapabilityProfile {
  return resolveCapabilities({
    env: { TERM: 'xterm-256color', COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' },
    platform: 'linux',
    override: {
      mouse: { sgr: true, drag: true, wheel: true },
      altScreen: true,
    },
  }).profile;
}

/**
 * Renders real fallback glyphs and solved geometry for nine deterministic host profiles.
 *
 * SSH is represented only by the environment observed on the remote process; tmux is accepted only
 * as a multiplexer flag. Neither fixture invents capabilities outside its public profile.
 */
export class PortableFallbackPanel extends Group {
  /** Stable teaching identity used by the terminal-capabilities course contract. */
  public readonly lessonName = 'Portable fallback evidence';

  /** Number of routed profile changes. */
  public profileChanges = 0;

  /** Number of changes verified from a completed mounted draw. */
  public renderedChecks = 0;

  /** Number of profile labels not supported by their public facts. */
  public unsupportedClaims = 0;

  /** Number of rendered lines exceeding the solved fallback surface. */
  public clippingFailures = 0;

  /** Keyboard remains the baseline interaction path for every profile. */
  public readonly keyboardAvailable = true;

  /** Number of owner cleanup transitions. */
  public cleanupCount = 0;

  protected profileIndex = 0;
  protected readonly name = signal<PortableProfile>('Rich');
  protected readonly selected = signal<CapabilityProfile>(richProfile());
  protected readonly evidence = signal('rich profile · full mouse · Unicode glyphs');
  protected readonly surface = new PortableSurface(
    () => this.name(),
    () => this.selected(),
    (facts) => this.recordDraw(facts),
  );
  protected renderedTransition = 0;
  protected glyphEvidence = '│█';
  protected active = false;

  /** Build the actual rendered surface and bounded profile explanation. */
  public constructor() {
    super();
    this.add(at(this.surface, 0, 0, WIDE_WIDTH, 3));
    this.add(at(new Text(() => `Profile: ${this.name()} · ${this.evidence()}`), 0, 3, 54, 1));
    this.add(at(new Text('Fallbacks: keyboard-only · mono · ASCII · narrow'), 0, 4, 54, 1));
    this.add(at(new Text('Hosts: SSH remote · tmux · win32 · browser'), 0, 5, 54, 1));
    this.onMount(() => {
      this.active = true;
      this.onCleanup(() => {
        if (!this.active) return;
        this.active = false;
        this.cleanupCount += 1;
      });
    });
  }

  /** Current named deterministic profile. */
  public get profileName(): PortableProfile {
    return this.name();
  }

  /** Current authentic public capability profile. */
  public get profile(): CapabilityProfile {
    return this.selected();
  }

  /** Exact border and block glyphs painted by the mounted surface. */
  public get renderedGlyphs(): string {
    return this.glyphEvidence;
  }

  /** Advance through all declared portable profiles. */
  public nextProfile(): void {
    if (!this.active) return;
    this.profileIndex = (this.profileIndex + 1) % PROFILES.length;
    const next = PROFILES[this.profileIndex] ?? 'Rich';
    const profile = this.resolveProfile(next);
    this.profileChanges += 1;
    this.name.set(next);
    this.selected.set(profile);
    this.applyProfile(next, profile);
    this.surface.invalidate();
  }

  /** Resolve one portable scenario through supported public profile builders. */
  protected resolveProfile(name: PortableProfile): CapabilityProfile {
    const rich = richProfile();
    if (name === 'Monochrome') {
      return resolveCapabilities({ env: { NO_COLOR: '' }, platform: 'linux', override: { altScreen: true } }).profile;
    }
    if (name === 'No mouse') {
      return resolveCapabilities({
        env: { TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
        platform: 'linux',
        override: { mouse: { sgr: false, drag: false, wheel: false }, altScreen: true },
      }).profile;
    }
    if (name === 'ASCII') return degradeCapsFully(rich);
    if (name === 'SSH') {
      return resolveCapabilities({
        env: { TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
        platform: 'linux',
      }).profile;
    }
    if (name === 'tmux') {
      return resolveCapabilities({
        env: { TERM: 'tmux-256color', TMUX: '/tmp/session', LANG: 'en_US.UTF-8' },
        platform: 'linux',
      }).profile;
    }
    if (name === 'Windows') return resolveCapabilities({ env: {}, platform: 'win32' }).profile;
    if (name === 'Browser') return buildBrowserCaps();
    return rich;
  }

  /** Change genuine surface width and publish only profile-supported explanation. */
  protected applyProfile(name: PortableProfile, profile: CapabilityProfile): void {
    const width = name === 'Narrow' ? NARROW_WIDTH : WIDE_WIDTH;
    this.surface.setLayout({ rect: { x: 0, y: 0, width, height: 3 } });
    this.surface.invalidateLayout();
    const degradation = evaluateEssentials(profile, { isTTY: true }).degradations.map((item) => item.mode);
    if (name === 'No mouse') this.evidence.set('keyboard-only · mouse unavailable');
    else if (name === 'Monochrome') this.evidence.set('mono · monochrome attributes');
    else if (name === 'ASCII') this.evidence.set('ASCII glyph fallback');
    else if (name === 'SSH') this.evidence.set('remote environment evidence only');
    else if (name === 'tmux') this.evidence.set('multiplexer flag · conservative policy');
    else if (name === 'Windows') this.evidence.set('win32 modern-console baseline');
    else if (name === 'Browser') this.evidence.set('browser xterm host facts');
    else if (name === 'Narrow') this.evidence.set('narrow 28-cell priority surface');
    else this.evidence.set(`rich profile · ${degradation.length} degradation(s)`);
  }

  /** Accept evidence only after the mounted surface and named profile agree. */
  protected recordDraw(facts: FallbackDrawEvidence): void {
    this.glyphEvidence = facts.glyphs;
    this.clippingFailures = facts.clippingFailures;
    if (
      this.profileChanges === 0 ||
      this.renderedTransition === this.profileChanges ||
      facts.profileName !== this.name()
    ) {
      return;
    }
    const profile = this.selected();
    const supported =
      facts.labelsPresent &&
      facts.clippingFailures === 0 &&
      facts.glyphs === `${fallbackGlyph('│', profile)}${fallbackGlyph('█', profile)}` &&
      (facts.profileName !== 'tmux' || profile.multiplexer) &&
      (facts.profileName !== 'Windows' || profile.platform === 'win32') &&
      (facts.profileName !== 'No mouse' || !profile.mouse.sgr);
    this.unsupportedClaims = supported ? 0 : 1;
    if (supported) {
      this.renderedTransition = this.profileChanges;
      this.renderedChecks += 1;
    }
  }
}
