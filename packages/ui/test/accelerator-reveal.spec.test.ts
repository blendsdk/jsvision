/**
 * Specification tests (immutable oracles) — accelerator-overlay reveal seam + underline emphasis.
 *
 * Source: accelerator-overlay/07-testing-strategy.md — ST-1 (reveal underlines the hot glyph on a
 * Button + a Label; off ⇒ none), ST-6 (a disabled hotkey is not underlined), and the ST-4-reveal
 * scope leg (a background view outside the reveal scope does not underline). Realizes FR-1/FR-6/FR-4
 * (AR-2/AR-8/AR-5).
 *
 * NOT TV-derived (no fidelity gate): the underline emphasis extends Turbo Vision. Uses a real
 * `View`/`RenderRoot` over fixed caps; buffers are read pre-serialize — a hot glyph's `cell.attrs`
 * carries the `Attr.underline` bit while reveal is on, and no cell carries it while reveal is off.
 * Expectations derive from the FRs/ARs, never from the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, Attr } from '@jsvision/core';
import type { Cell, ScreenBuffer } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import { Button, Label } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** The first cell (row-major) whose glyph is `ch`, or `undefined`. Robust to exact column math. */
function findChar(buf: ScreenBuffer, ch: string): Cell | undefined {
  for (let y = 0; y < buf.height; y += 1) {
    for (let x = 0; x < buf.width; x += 1) {
      const cell = buf.get(x, y);
      if (cell?.char === ch) return cell;
    }
  }
  return undefined;
}

/** Whether a cell exists and carries the underline attribute bit. */
function underlined(cell: Cell | undefined): boolean {
  return cell !== undefined && (cell.attrs & Attr.underline) !== 0;
}

// ST-1 / FR-1 / AR-2 — reveal underlines the hot glyph on a Button (`O` of `Open`) and a Label (`N`
// of `Name`); the base runs never underline; toggling reveal off leaves no residual underline.
test('ST-1: reveal underlines the hot glyph on Button + Label; off ⇒ none', () => {
  const btn = new Button('~O~pen');
  const label = new Label('~N~ame', btn);
  const root = new Group();
  root.layout = { direction: 'col' };
  btn.layout = { size: { kind: 'fixed', cells: 2 } };
  label.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(btn);
  root.add(label);
  const rr = createRenderRoot({ width: 12, height: 3 }, { caps });
  rr.mount(root);

  // Off by default — no underline anywhere.
  expect(underlined(findChar(rr.buffer(), 'O'))).toBe(false);
  expect(underlined(findChar(rr.buffer(), 'N'))).toBe(false);

  // Reveal on — the hot glyphs gain Attr.underline; base glyphs do not.
  rr.setRevealAccelerators(true);
  rr.flush();
  expect(underlined(findChar(rr.buffer(), 'O'))).toBe(true); // Button hot glyph
  expect(underlined(findChar(rr.buffer(), 'N'))).toBe(true); // Label hot glyph
  expect(underlined(findChar(rr.buffer(), 'p'))).toBe(false); // Button base run ("pen")
  expect(underlined(findChar(rr.buffer(), 'a'))).toBe(false); // Label base run ("ame")

  // Reveal off — no residual underline (FR-5).
  rr.setRevealAccelerators(false);
  rr.flush();
  expect(underlined(findChar(rr.buffer(), 'O'))).toBe(false);
  expect(underlined(findChar(rr.buffer(), 'N'))).toBe(false);
});

// ST-6 / FR-6 / AR-8 — a disabled widget's accelerator does not light up (its hot run collapses to
// the face role, never the bright shortcut accent, so no underline is applied).
test('ST-6: a disabled Button hotkey is not underlined even when reveal is on', () => {
  const btn = new Button('~O~pen', { disabled: true });
  const rr = createRenderRoot({ width: 12, height: 2 }, { caps });
  rr.mount(btn);
  rr.setRevealAccelerators(true);
  rr.flush();
  expect(underlined(findChar(rr.buffer(), 'O'))).toBe(false);
});

// ST-4-reveal / FR-4 / AR-5 — reveal is clamped to the active dispatch scope: with a scope subtree
// supplied, only views at/below it underline; a background view outside the scope does not.
test('ST-4-reveal: only the in-scope subtree underlines; a background view does not', () => {
  const fg = new Button('~O~pen'); // in-scope ("modal")
  const bg = new Button('~C~lose'); // background (out of scope)
  const root = new Group();
  root.layout = { direction: 'col' };
  bg.layout = { size: { kind: 'fixed', cells: 2 } };
  fg.layout = { size: { kind: 'fixed', cells: 2 } };
  root.add(bg); // painted first (behind)
  root.add(fg); // the scope subtree
  const rr = createRenderRoot({ width: 12, height: 4 }, { caps });
  rr.mount(root);

  rr.setRevealAccelerators(true, fg); // scope = the fg subtree
  rr.flush();
  expect(underlined(findChar(rr.buffer(), 'O'))).toBe(true); // in-scope hot glyph
  expect(underlined(findChar(rr.buffer(), 'C'))).toBe(false); // out-of-scope background hot glyph
});
