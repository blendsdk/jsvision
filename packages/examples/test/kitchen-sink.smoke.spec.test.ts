/**
 * Specification test (immutable oracle) — the kitchen-sink showcase registry.
 *
 * Source: the jsvision "kitchen-sink showcase (NON-NEGOTIABLE)" rule (repo `CLAUDE.md` +
 * `codeops/kitchen-sink-gate.md`). Every registered `Story` MUST mount headlessly and draw
 * something — this is the CI guard that keeps stories from rotting and makes "a story exists +
 * renders" mechanically checkable without a TTY. It also enforces the registry hygiene the shell
 * relies on (unique ids, required metadata).
 *
 * Real `@jsvision/ui` `RenderRoot` over fixed caps; each story is built + mounted + composed, then
 * the buffer is asserted non-empty. Expectations derive from the showcase contract, not the stories'
 * internals. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import {
  resolveCapabilities,
  Attr,
  defaultTheme,
  classicTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
  janusTheme,
  warpTheme,
  solsticeTheme,
  platinumTheme,
  workbenchTheme,
  horizonTheme,
  type Theme,
} from '@jsvision/core';
import { createRenderRoot, createRoot, Group, Button, Text } from '@jsvision/ui';
import { STORIES } from '../kitchen-sink/stories/index.js';
import { at } from '../kitchen-sink/story.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const WIDTH = 72;
const HEIGHT = 16;

/** Count cells that were actually painted (a bare frame/empty view leaves only spaces). */
function paintedCells(rows: readonly { char: string }[][]): number {
  let n = 0;
  for (const row of rows) for (const cell of row) if (cell.char !== ' ') n += 1;
  return n;
}

test('the registry is non-empty and every story carries the required metadata', () => {
  expect(STORIES.length).toBeGreaterThan(0);
  for (const story of STORIES) {
    expect(story.id, 'id').toBeTruthy();
    expect(story.category, `${story.id} category`).toBeTruthy();
    expect(story.title, `${story.id} title`).toBeTruthy();
    expect(story.blurb, `${story.id} blurb`).toBeTruthy();
  }
});

test('story ids are unique (the shell uses them as menu command names)', () => {
  const ids = STORIES.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});

// ST-24 (RD-16 AC-12) — the DataGrid showcase story is registered, carries a unique id, and paints
// at least one non-blank cell headlessly.
test('ST-24: the data-grid story is registered and paints', () => {
  const story = STORIES.find((s) => s.id === 'data-grid');
  expect(story, 'a story with id "data-grid" is registered').toBeTruthy();
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    expect(paintedCells(rr.buffer().rows()), 'the data-grid story painted nothing').toBeGreaterThan(0);
    dispose();
  });
});

// ST-35 (RD-17 AC-13) — the Tabs showcase story is registered, carries the required metadata
// (unique id `containers/tabs`, category `Containers`, an `rd`), and paints at least one non-blank
// cell headlessly.
test('ST-35: the containers/tabs story is registered with metadata and paints', () => {
  const story = STORIES.find((s) => s.id === 'containers/tabs');
  expect(story, 'a story with id "containers/tabs" is registered').toBeTruthy();
  expect(story!.category, 'category Containers').toBe('Containers');
  expect(story!.rd, 'provenance RD chip').toBeTruthy();
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    expect(paintedCells(rr.buffer().rows()), 'the tabs story painted nothing').toBeGreaterThan(0);
    dispose();
  });
});

// ST-13 (RD-18 AC-13) — the Feedback showcase stories are registered with the required metadata
// (unique ids `feedback/progress-bar` + `feedback/spinner`, category `Feedback`, an `rd`) and each
// paints at least one non-blank cell headlessly.
for (const id of ['feedback/progress-bar', 'feedback/spinner']) {
  test(`ST-13: the ${id} story is registered with metadata and paints`, () => {
    const story = STORIES.find((s) => s.id === id);
    expect(story, `a story with id "${id}" is registered`).toBeTruthy();
    expect(story!.category, 'category Feedback').toBe('Feedback');
    expect(story!.rd, 'provenance RD chip').toBeTruthy();
    createRoot((dispose) => {
      const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
      rr.mount(view);
      expect(paintedCells(rr.buffer().rows()), `the ${id} story painted nothing`).toBeGreaterThan(0);
      dispose();
    });
  });
}

// ST-16 (RD-20 AC-16) — the Date showcase stories are registered with the required metadata (unique
// ids `date/calendar` + `date/date-picker`, category `Date`, an `rd`) and each paints headlessly.
for (const id of ['date/calendar', 'date/date-picker']) {
  test(`ST-16: the ${id} story is registered with metadata and paints`, () => {
    const story = STORIES.find((s) => s.id === id);
    expect(story, `a story with id "${id}" is registered`).toBeTruthy();
    expect(story!.category, 'category Date').toBe('Date');
    expect(story!.rd, 'provenance RD chip').toBeTruthy();
    createRoot((dispose) => {
      const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
      rr.mount(view);
      expect(paintedCells(rr.buffer().rows()), `the ${id} story painted nothing`).toBeGreaterThan(0);
      dispose();
    });
  });
}

// ST-17 (layout-dsl) — the Layout DSL showcase story is registered with the required metadata
// (unique id `layout/dsl`, category `Foundations`) and paints at least one non-blank cell headlessly.
test('ST-17: the layout/dsl story is registered with metadata and paints', () => {
  const story = STORIES.find((s) => s.id === 'layout/dsl');
  expect(story, 'a story with id "layout/dsl" is registered').toBeTruthy();
  expect(story!.category, 'category Foundations').toBe('Foundations');
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    expect(paintedCells(rr.buffer().rows()), 'the layout/dsl story painted nothing').toBeGreaterThan(0);
    dispose();
  });
});

// ST-26 (split-panes) — the split-panes showcase story is registered with the required metadata
// (unique id `layout/split`, category `Layout`) and paints at least one non-blank cell headlessly.
// No `rd` assertion — the provenance chip is deliberately omitted (this plan implements no RD).
test('ST-26: the layout/split story is registered with metadata and paints', () => {
  const story = STORIES.find((s) => s.id === 'layout/split');
  expect(story, 'a story with id "layout/split" is registered').toBeTruthy();
  expect(story!.category, 'category Layout').toBe('Layout');
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    expect(paintedCells(rr.buffer().rows()), 'the split story painted nothing').toBeGreaterThan(0);
    dispose();
  });
});

// ST-5 (followups) — the layout/split-scroll story is registered (unique id `layout/split-scroll`,
// category `Layout`) and paints a list-item label, proving the ListBox rendered *inside* the SplitView
// pane — not merely that some cell painted (the generic smoke loop below already asserts that).
test('ST-5 (followups): the layout/split-scroll story is registered and paints a list item in its pane', () => {
  const story = STORIES.find((s) => s.id === 'layout/split-scroll');
  expect(story, 'a story with id "layout/split-scroll" is registered').toBeTruthy();
  expect(story!.category, 'category Layout').toBe('Layout');
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    const painted = rr
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''))
      .join('\n');
    expect(painted, 'a list item label paints inside the pane').toMatch(/Item 0/);
    dispose();
  });
});

// ST-17 (navigation-router) — the drill-down router story is registered with the required metadata
// (unique id `navigation/drill-down`, category `Navigation`) and paints at least one non-blank cell
// headlessly. (The wizard story is deferred until @jsvision/forms merges.)
test('ST-17: the navigation/drill-down story is registered with metadata and paints', () => {
  const story = STORIES.find((s) => s.id === 'navigation/drill-down');
  expect(story, 'a story with id "navigation/drill-down" is registered').toBeTruthy();
  expect(story!.category, 'category Navigation').toBe('Navigation');
  expect(story!.title, 'title').toBeTruthy();
  expect(story!.blurb, 'blurb').toBeTruthy();
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    expect(paintedCells(rr.buffer().rows()), 'the drill-down story painted nothing').toBeGreaterThan(0);
    dispose();
  });
});

// AR-11 (accelerator-overlay) — the accelerator-overlay story is registered with metadata, and when
// its RenderRoot arms reveal (`setRevealAccelerators(true)`) at least one hot glyph gains
// `Attr.underline`. This is the showcase's live proof that the F12 overlay lights up hotkeys.
test('the controls/accelerators story reveals underlined hotkeys on arm', () => {
  const story = STORIES.find((s) => s.id === 'controls/accelerators');
  expect(story, 'a story with id "controls/accelerators" is registered').toBeTruthy();
  expect(story!.category, 'category Controls').toBe('Controls');
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    // No underline at rest.
    const anyUnderlined = (): boolean =>
      rr
        .buffer()
        .rows()
        .some((row) => row.some((cell) => (cell.attrs & Attr.underline) !== 0));
    expect(anyUnderlined(), 'no underline before reveal').toBe(false);
    // Arm reveal → at least one hot glyph is underlined.
    rr.setRevealAccelerators(true);
    rr.flush();
    expect(anyUnderlined(), 'a hot glyph underlines on reveal').toBe(true);
    dispose();
  });
});

// ST-35 (RD-22 AC-16) — the Theming showcase story is registered with the required metadata (unique
// id `theming/presets`, category `Theming`, an `rd`) and paints headlessly.
test('ST-35: the theming/presets story is registered with metadata and paints', () => {
  const story = STORIES.find((s) => s.id === 'theming/presets');
  expect(story, 'a story with id "theming/presets" is registered').toBeTruthy();
  expect(story!.category, 'category Theming').toBe('Theming');
  expect(story!.rd, 'provenance RD chip').toBeTruthy();
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    expect(paintedCells(rr.buffer().rows()), 'the theming story painted nothing').toBeGreaterThan(0);
    dispose();
  });
});

// ST-35 (RD-22 AC-16) — every shipped preset renders a representative widget set to a non-empty
// buffer, so a hot-swap to any preset paints (the render root is themed with the preset directly).
test('ST-35: every preset renders a representative widget set to a non-empty buffer', () => {
  const presets: Record<string, Theme> = {
    classicTheme,
    monochromeTheme,
    slateTheme,
    nordTheme,
    draculaTheme,
    solarizedDarkTheme,
    gruvboxDarkTheme,
    janusTheme,
    warpTheme,
    solsticeTheme,
    platinumTheme,
    workbenchTheme,
    horizonTheme,
  };
  for (const [name, theme] of Object.entries(presets)) {
    createRoot((dispose) => {
      const g = new Group();
      g.background = 'window';
      g.add(at(new Text('Themed widgets'), 1, 0, 20, 1));
      g.add(at(new Button('~O~K', { onClick: () => {} }), 1, 2, 8, 2));
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps, theme });
      rr.mount(at(g, 0, 0, WIDTH, HEIGHT));
      expect(paintedCells(rr.buffer().rows()), `${name} painted nothing`).toBeGreaterThan(0);
      dispose();
    });
  }
});

// ST-N1 (RD-04 FR-4.6) — the Forms showcase story is registered with the required metadata (unique
// id `forms/form`, category `Forms`, truthy title/blurb, guarding accidental de-registration) and
// paints its forms-specific `valid · dirty` bound-state echo headlessly — proving the form actually
// wired up, not merely that *some* cell painted (which the generic smoke loop below already asserts
// for every story).
test('ST-N1: the forms/form story is registered with metadata and paints its valid · dirty echo', () => {
  const story = STORIES.find((s) => s.id === 'forms/form');
  expect(story, 'a story with id "forms/form" is registered').toBeTruthy();
  expect(story!.category, 'category Forms').toBe('Forms');
  expect(story!.title, 'title').toBeTruthy();
  expect(story!.blurb, 'blurb').toBeTruthy();
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    // Reconstruct the painted text so we can assert a form-specific signal, not just a non-blank cell.
    const painted = rr
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''))
      .join('\n');
    expect(painted, 'the valid · dirty echo is painted').toMatch(/valid/);
    expect(painted, 'the valid · dirty echo is painted').toMatch(/dirty/);
    dispose();
  });
});

// ST-AS1 (RD-06 AC-14) — the async-validation showcase story is registered with the required metadata
// (unique id `forms/async`, category `Forms`) and paints its characteristic async affordance: the
// `Username` label + the always-painted `checking…` interaction hint (proving the async demo renders
// its distinctive state headlessly, not merely that some cell painted).
test('ST-AS1: the forms/async story is registered with metadata and paints its async affordance', () => {
  const story = STORIES.find((s) => s.id === 'forms/async');
  expect(story, 'a story with id "forms/async" is registered').toBeTruthy();
  expect(story!.category, 'category Forms').toBe('Forms');
  expect(story!.title, 'title').toBeTruthy();
  expect(story!.blurb, 'blurb').toBeTruthy();
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    const painted = rr
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''))
      .join('\n');
    expect(painted, 'the Username label paints').toMatch(/Username/);
    expect(painted, 'the checking… hint paints').toMatch(/checking…/);
    dispose();
  });
});

// ST-S1 (RD-09 AC-8) — the placeholder + severity demos render: the controls/input story paints its
// muted placeholder hint over an empty field, and the theming/presets story paints a severity-coloured
// Text (a glyph cell in the dangerText fg). Read from the painted buffer (an unfocused headless mount
// puts no caret over column 1, so the leading placeholder glyph is not blanked).
test('ST-S1: the placeholder demo paints its hint and the severity demo renders in dangerText', () => {
  const paintedOf = (id: string): { text: string; hasDangerFg: boolean } => {
    const story = STORIES.find((s) => s.id === id);
    expect(story, `a story with id "${id}" is registered`).toBeTruthy();
    let text = '';
    let hasDangerFg = false;
    createRoot((dispose) => {
      const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
      rr.mount(view);
      const rows = rr.buffer().rows();
      text = rows.map((row) => row.map((c) => c.char).join('')).join('\n');
      hasDangerFg = rows.some((row) => row.some((c) => c.char !== ' ' && c.fg === defaultTheme.dangerText.fg));
      dispose();
    });
    return { text, hasDangerFg };
  };
  // The muted placeholder hint is visible over the empty field in the Input story.
  expect(paintedOf('controls/input').text, 'the placeholder hint paints').toContain('Ada Lovelace');
  // A severity-coloured Text renders in the Theming story (a dangerText-fg glyph cell).
  expect(paintedOf('theming/presets').hasDangerFg, 'a severity Text paints in dangerText').toBe(true);
});

// The core smoke oracle: each story builds + mounts + draws without throwing, and paints something.
for (const story of STORIES) {
  test(`story "${story.id}" mounts headlessly and paints`, () => {
    // Build inside a disposable owner (as the shell does) so any story computeds/effects are owned.
    createRoot((dispose) => {
      const view = at(story.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
      expect(() => rr.mount(view)).not.toThrow();
      expect(paintedCells(rr.buffer().rows()), `${story.id} painted nothing`).toBeGreaterThan(0);
      dispose();
    });
  });
}
