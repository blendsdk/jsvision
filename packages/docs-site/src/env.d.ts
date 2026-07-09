/**
 * Ambient build-time constants injected by Vite `define` (see the VitePress and
 * vitest configs). Declared here so `tsc --noEmit` and the example/src modules
 * resolve the globals.
 */

/** The monorepo root package.json version, injected at build time. */
declare const __JSVISION_VERSION__: string;
