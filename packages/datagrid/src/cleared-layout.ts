/**
 * The layout reset shared by this package's two erasure seams (the cell overlay and the cell editor).
 * Internal — not on the package barrel.
 */
import type { LayoutProps } from '@jsvision/ui';

/**
 * Every {@link LayoutProps} prop set to `undefined` — the reset a seam spreads when it means "clear
 * everything, then set these".
 *
 * `setLayout` merges, so omitting a prop **keeps** it. A seam that must govern a view's layout no
 * matter what the view arrived with therefore has to name the props it discards, and an explicit
 * `undefined` is the documented way to clear one back to its default. Both users here mount a
 * caller-supplied view — a `filterPopup` result and a `createCellEditor` result — so "whatever the
 * view arrived with" is arbitrary by design.
 *
 * The mapped type over `Required<LayoutProps>` is the point: adding a prop to `LayoutProps` upstream
 * makes this literal fail to compile, instead of silently flipping both seams from *discard* to
 * *inherit*. Declared per package on purpose — `@jsvision/ui` keeps an equivalent copy internal
 * rather than widening its public surface, and either copy catches the same upstream change.
 */
export const CLEARED_LAYOUT: { [K in keyof Required<LayoutProps>]: undefined } = {
  direction: undefined,
  size: undefined,
  justify: undefined,
  align: undefined,
  gap: undefined,
  padding: undefined,
  position: undefined,
  rect: undefined,
};
