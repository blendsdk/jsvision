/**
 * Specification test (immutable oracle) — jsvision-ui/RD-09 core `fileInfo` theme role (ST-15, PA-6).
 *
 * GATE-1 decode (Phase 1). `TFileInfoPane::getColor(1)` resolves fully through the palette chain:
 *   • `TFileInfoPane` palette `cpInfoPane = "\x1E"` (`stddlg.cpp:67`) ⇒ `getColor(1) → 0x1E`;
 *   • owner `TFileDialog` is a gray dialog (`TDialog palette = dpGrayDialog`, `tdialog.cpp:31`):
 *     `cpGrayDialog[0x1E=30] = 0x3D` (`dialogs.h:80`);
 *   • the desktop has an empty palette (`TView::getPalette` length 0 ⇒ passthrough, `mapcolor.cpp:31`);
 *   • `TProgram` maps `cpAppColor[0x3D=61] = 0x13` (`app.h:142`).
 * Final attribute = **`0x13` cyan-on-blue** — TV's blue info strip under the gray dialog.
 *
 * PA-6 (GATE-1 branch, user-decided 2026-07-05): `0x13` exists in the shipped theme only via
 * `scrollBarPage`/`scrollBarControls`/`progressTrack` (all domain-alien to a file-info pane), and the
 * gray-dialog body roles (`staticText`/`label`) are `0x70`, not `0x13`. So the single additive
 * `fileInfo` role is added (byte-frozen here), mirroring the RD-21 `colorMarker` precedent. This oracle
 * owns the byte guard: `fileInfo = { fg: cyan, bg: blue }`. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import type { ColorDepth } from '@jsvision/core';
import { defaultTheme, encode } from '@jsvision/core';

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

/** The DOS-16 palette hex values (matching core PALETTE; inlined so this oracle is self-contained). */
const P = {
  black: '#000000',
  blue: '#0000aa',
  green: '#00aa00',
  cyan: '#00aaaa',
  yellow: '#ffff55',
  white: '#ffffff',
  brightCyan: '#55ffff',
  lightGray: '#aaaaaa',
} as const;

// ST-15 — the additive `fileInfo` role exists with the GATE-1-decoded byte 0x13 (cyan-on-blue).
test('ST-15: the fileInfo role exists with the PA-6 byte 0x13 (cyan-on-blue, fg/bg pinned)', () => {
  const role = defaultTheme.fileInfo;
  expect(role, 'fileInfo exists').toBeTruthy();
  expect({ fg: role.fg, bg: role.bg }, 'fileInfo bytes 0x13').toStrictEqual({ fg: P.cyan, bg: P.blue });
});

// ST-15 — encode() of the new role never throws at any colour depth (downsample-safe, AC-15).
test('ST-15: encode() of the fileInfo role does not throw at any colour depth', () => {
  const role = defaultTheme.fileInfo;
  for (const depth of ALL_DEPTHS) {
    expect(() => encode(role.fg, 'fg', depth), `fileInfo.fg @ ${depth}`).not.toThrow();
    expect(() => encode(role.bg, 'bg', depth), `fileInfo.bg @ ${depth}`).not.toThrow();
  }
});

// ST-15 — the reused gray-dialog / list / input / button / staticText roles the files package composes
// with are byte-for-byte unchanged (the additive edit perturbed no shipped decode).
test('ST-15: the reused roles are byte-for-byte unchanged (additive-only surface)', () => {
  const REUSED_UNCHANGED: Record<string, unknown> = {
    dialog: { fg: P.black, bg: P.lightGray },
    staticText: { fg: P.black, bg: P.lightGray },
    label: { fg: P.black, bg: P.lightGray },
    inputNormal: { fg: P.white, bg: P.blue },
    button: { fg: P.black, bg: P.green },
    buttonDefault: { fg: P.brightCyan, bg: P.green },
    listNormal: { fg: P.black, bg: P.cyan },
    listFocused: { fg: P.white, bg: P.green },
    listSelected: { fg: P.yellow, bg: P.cyan },
    listDivider: { fg: P.blue, bg: P.cyan },
    scrollBarPage: { fg: P.cyan, bg: P.blue },
    scrollBarControls: { fg: P.cyan, bg: P.blue },
  };
  // Read through maps rather than an index signature: the theme's roles are individually typed (some
  // carry extra required fields), so it is not a `Record<string, …>` and cannot be treated as one.
  const roles = new Map<string, object>(Object.entries(defaultTheme));
  for (const [name, value] of Object.entries(REUSED_UNCHANGED)) {
    const role = roles.get(name);
    expect(role, `${name} exists`).toBeTruthy();
    // Compare only the keys the oracle pins (roles may carry extra keys like border/title/icon).
    const fields = new Map<string, unknown>(Object.entries(role ?? {}));
    const pinned = Object.fromEntries(Object.keys(value as object).map((k) => [k, fields.get(k)]));
    expect(pinned, `${name} unchanged`).toStrictEqual(value);
  }
});
