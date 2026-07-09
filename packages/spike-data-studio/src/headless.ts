/**
 * Headless render helpers for the spike — compose a view tree into an off-screen `ScreenBuffer` and
 * read it back as text, with no TTY. Mirrors the theme-designer walkthrough idiom so every probe's
 * visual evidence is deterministic and log-capturable.
 */
import { createRenderRoot, createRoot } from '@jsvision/ui';
import type { View, RenderRoot } from '@jsvision/ui';
import { resolveCapabilities } from '@jsvision/core';
import type { CapabilityProfile } from '@jsvision/core';

/** A truecolor, UTF-8 capability profile — the spike renders headless so caps are fixed. */
export function caps(): CapabilityProfile {
  return resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: 'truecolor', unicode: { utf8: true } },
  }).profile;
}

/** Compose `view` at `size` into an off-screen buffer and return its rows as plain text lines. */
export function composeToLines(view: View, size: { width: number; height: number }): string[] {
  return createRoot((dispose) => {
    // Merge (don't clobber) so a `direction:'col'`/padding set by the caller survives.
    view.layout = {
      ...view.layout,
      position: 'absolute',
      rect: { x: 0, y: 0, width: size.width, height: size.height },
    };
    const rr = createRenderRoot(size, { caps: caps() });
    rr.mount(view);
    const lines = rr
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''));
    dispose();
    return lines;
  });
}

/** Print a bordered ASCII frame under a title (for probe evidence logs). */
export function printFrame(title: string, lines: string[]): void {
  const width = lines[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const line of lines) console.log(`|${line}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

/**
 * Keep a mounted render root live across several interactions (for probes that mutate signals and
 * re-read the composed buffer). Returns the root plus a `text()` reader and a `dispose()`.
 */
export function liveRoot(
  build: () => View,
  size: { width: number; height: number },
): { root: RenderRoot; text: () => string[]; dispose: () => void; view: View } {
  let view!: View;
  let root!: RenderRoot;
  const dispose = createRoot((d) => {
    view = build();
    // Merge (don't clobber) so a `direction:'col'`/padding set by `build()` survives.
    view.layout = {
      ...view.layout,
      position: 'absolute',
      rect: { x: 0, y: 0, width: size.width, height: size.height },
    };
    root = createRenderRoot(size, { caps: caps() });
    root.mount(view);
    return d;
  });
  return {
    root,
    view,
    text: () =>
      root
        .buffer()
        .rows()
        .map((row) => row.map((cell) => cell.char).join('')),
    dispose,
  };
}
