/**
 * `matrixTheme` — an all-green-on-black theme for the `demo:matrix` showcase, so the window frames,
 * menu bar, and status line read as part of the same "digital rain" world as the falling code
 * inside the windows.
 *
 * It is generated with `createTheme`: a few dark-green/black seed colors expand into the full role
 * set, and a handful of alias overrides pin the desktop to pure black and the frames and text to
 * green. Hotkey accents stay a slightly brighter lime so they still pop against the body green.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 *
 * @example
 * import { createApplication } from '@jsvision/ui';
 * import { matrixTheme } from './theme.js';
 *
 * const app = createApplication({ theme: matrixTheme });
 */
import { createTheme } from '@jsvision/core';

/** A dark-green-on-black theme evoking *The Matrix* digital rain. */
export const matrixTheme = createTheme({
  mode: 'dark',
  accent: '#00e64d', // focus/selection fills — bright matrix green
  neutral: '#0b160b', // near-black green-tinted neutral ramp for surfaces
  success: '#00ff41',
  info: '#00cc33',
  warning: '#ccff66',
  danger: '#aaff55', // keep hotkey accents in the green family rather than red
  overrides: {
    background: '#000000', // the desktop field behind the windows
    backgroundRaised: '#04120a', // window/menu interiors
    backgroundSunken: '#020a06',
    backgroundSelected: '#0a3318',
    foreground: '#33ff77', // body text
    foregroundMuted: '#1f9a4a',
    foregroundDisabled: '#0f5228',
    foregroundOnAccent: '#001206', // text on a bright-green fill
    border: '#00b33a', // active window frames
    borderMuted: '#0a5a24', // inactive frames / dividers
    accent: '#00e64d',
    accentMuted: '#0a7a2e',
  },
});
