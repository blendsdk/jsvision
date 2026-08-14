import type { ScreenBuffer } from '@jsvision/core';
import { createApplication, resolveCapabilities } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import { KanbanViewBar, createKanbanViewController } from '../src/index.js';
import type { KanbanViewBarControlInspection } from '../src/index.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const applications: Application[] = [];

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
});

/** Renders one standard bar at the requested terminal geometry. */
function mount(width: number, height = 3) {
  const controller = createKanbanViewController({
    debounceMs: 0,
    initial: { search: 'alpha', density: 'comfortable' },
  });
  const bar = new KanbanViewBar({ controller });
  bar.setLayout({ position: 'fill' });
  const application = createApplication({ content: bar, viewport: { width, height }, caps: CAPS });
  application.loop.renderRoot.flush();
  applications.push(application);
  return { application, bar, controller };
}

/** Flattens a terminal frame without ANSI serialization. */
function frameText(buffer: ScreenBuffer): string {
  return buffer
    .rows()
    .map((row) => row.map(({ char }) => char).join(''))
    .join('\n');
}

/** Returns one semantic control from the bounded chrome inspection. */
function control(
  controls: readonly KanbanViewBarControlInspection[],
  id: KanbanViewBarControlInspection['id'],
): KanbanViewBarControlInspection {
  const found = controls.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Expected Kanban view-bar control ${id}.`);
  return found;
}

describe('Kanban standard view chrome specification', () => {
  it('shows the everyday view workflow together at 80 columns', () => {
    const { application, bar, controller } = mount(80);
    const inspection = bar.inspection();
    const text = frameText(application.loop.renderRoot.buffer());

    expect(inspection.mode).toBe('wide');
    expect(inspection.searchDraft).toBe('alpha');
    expect(text).toContain('Search');
    expect(text).toContain('Sort');
    expect(text).toContain('Views');
    expect(text).toContain('Clear');
    expect(control(inspection.controls, 'search').visible).toBe(true);
    expect(control(inspection.controls, 'quick-filters').visible).toBe(true);
    expect(control(inspection.controls, 'sort').visible).toBe(true);
    expect(control(inspection.controls, 'saved-views').visible).toBe(true);
    expect(control(inspection.controls, 'clear').visible).toBe(true);
    controller.dispose();
  });

  it('collapses secondary controls into one reachable overflow without clipping', () => {
    const { application, bar, controller } = mount(34, 3);
    const inspection = bar.inspection();

    expect(inspection.mode).toBe('narrow');
    expect(control(inspection.controls, 'search').visible).toBe(true);
    expect(control(inspection.controls, 'clear').visible).toBe(true);
    expect(control(inspection.controls, 'overflow').visible).toBe(true);
    expect(inspection.overflowActionIds).toEqual(
      expect.arrayContaining(['jsvision.kanban.quick-filters', 'jsvision.kanban.sort', 'jsvision.kanban.saved-views']),
    );
    for (const item of inspection.controls.filter(({ visible }) => visible)) {
      expect(item.bounds.x).toBeGreaterThanOrEqual(0);
      expect(item.bounds.y).toBeGreaterThanOrEqual(0);
      expect(item.bounds.x + item.bounds.width).toBeLessThanOrEqual(34);
      expect(item.bounds.y + item.bounds.height).toBeLessThanOrEqual(3);
    }
    expect(frameText(application.loop.renderRoot.buffer())).not.toContain('\u001b');
    controller.dispose();
  });

  it('keeps every visible and overflowed action reachable by keyboard and mouse', () => {
    const { bar, controller } = mount(40, 3);
    const inspection = bar.inspection();

    for (const item of inspection.controls.filter(({ visible }) => visible)) {
      expect(item.keyboardReachable, `${item.id} keyboard`).toBe(true);
      expect(item.mouseTarget?.width ?? 0, `${item.id} mouse width`).toBeGreaterThan(0);
      expect(item.mouseTarget?.height ?? 0, `${item.id} mouse height`).toBeGreaterThan(0);
    }
    expect(inspection.overflowEntries.every(({ keyboardReachable }) => keyboardReachable)).toBe(true);
    expect(inspection.overflowEntries.every(({ mouseReachable }) => mouseReachable)).toBe(true);
    controller.dispose();
  });

  it('reflows wide→narrow→wide while preserving search draft and focus identity', () => {
    const { application, bar, controller } = mount(80, 3);
    bar.focusSearch();
    expect(bar.inspection().focusedControlId).toBe('search');

    application.loop.resize({ width: 34, height: 3 });
    expect(bar.inspection()).toMatchObject({ mode: 'narrow', searchDraft: 'alpha', focusedControlId: 'search' });
    application.loop.resize({ width: 80, height: 3 });
    expect(bar.inspection()).toMatchObject({ mode: 'wide', searchDraft: 'alpha', focusedControlId: 'search' });
    controller.dispose();
  });
});
