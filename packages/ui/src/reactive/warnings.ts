/**
 * Development-only warning helper (RD-01, 03-02; PA-1).
 *
 * The project keeps `src` free of `console.*` calls so a shipped TUI never writes to the
 * (screen-coupled) console. The reactive core needs to flag two documented footguns —
 * a no-owner computation (AR-14) and a duplicate `For` key (AR-17) — so PA-1 chose raw
 * `console.warn`, **gated on `NODE_ENV !== 'production'`**: surfaced in development, silent
 * in a shipped build. This is distinct from the (ungated) `console.error` used for surplus
 * cascade errors (PA-2), which are real errors rather than dev hints.
 */

/**
 * Emit a development-only warning, prefixed for provenance. Silenced when
 * `process.env.NODE_ENV === 'production'`.
 *
 * @param message The warning text (no secrets/PII — screen-safe discipline).
 */
export function devWarn(message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    // PA-1: prod-gated dev footgun warning (the only sanctioned console use in this subsystem).
    console.warn(`[jsvision/ui reactive] ${message}`);
  }
}
