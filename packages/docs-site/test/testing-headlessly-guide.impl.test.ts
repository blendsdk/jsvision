import { readFileSync } from 'node:fs';

import { Group, View, createEventLoop } from '@jsvision/ui';
import { createLogger, resolveCapabilities } from '@jsvision/core';
import type { DrawContext } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import {
  HEADLESS_SAVE_COMMAND,
  createHeadlessApplicationFixture,
  renderHeadlessFailureEvidence,
} from '../src/example-fixtures/testing-headlessly/application-fixture.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const artifactSource = readFileSync(new URL('./testing-headlessly-example.spec.test.ts', import.meta.url), 'utf8');
const fixtureSource = readFileSync(
  new URL('../src/example-fixtures/testing-headlessly/application-fixture.ts', import.meta.url),
  'utf8',
);

/**
 * Simulates a resource producer whose callback may be retained beyond mounted ownership.
 *
 * Publishing is allowed only while mounted. This makes post-disposal state, scheduling, and
 * diagnostic effects independently observable instead of treating an unmount count as proof.
 */
class RetainedProducerView extends View {
  /** Number of values accepted while the producer owns its mounted scope. */
  public publications = 0;

  /** Whether this view still owns permission to publish and invalidate. */
  protected active = false;

  /** Bind and release producer ownership with the view lifecycle. */
  public constructor() {
    super();
    this.onMount(() => {
      this.active = true;
      this.onCleanup(() => {
        this.active = false;
      });
    });
  }

  /** Publish one value only while the mounted owner is active. */
  public publish(): void {
    if (!this.active) return;
    this.publications += 1;
    this.invalidate();
  }

  /** Paint stable evidence without introducing another reactive dependency. */
  public override draw(ctx: DrawContext): void {
    ctx.fill('P', ctx.color('staticText'));
  }
}

describe('Testing headlessly fixture hardening', () => {
  test('should isolate state, focus, commands, and cleanup between fixture generations', () => {
    const first = createHeadlessApplicationFixture();
    const second = createHeadlessApplicationFixture();
    first.app.loop.dispatch({ type: 'key', key: 'x', ctrl: false, alt: false, shift: false });
    first.app.loop.emitCommand(HEADLESS_SAVE_COMMAND);

    expect(first.panel.routedActions).toBe(1);
    expect(first.panel.commandActions).toBe(1);
    expect(second.panel.routedActions).toBe(0);
    expect(second.panel.commandActions).toBe(0);
    expect(first.app.loop.getFocused()).toBe(first.panel.actionView);
    expect(second.app.loop.getFocused()).toBe(second.panel.actionView);

    first.dispose();
    second.dispose();
    expect(first.panel.cleanupCount).toBe(1);
    expect(second.panel.cleanupCount).toBe(1);
  });

  test('should keep unowned input and disabled commands visibly inert', () => {
    const fixture = createHeadlessApplicationFixture();
    try {
      const before = fixture.frameLines();
      fixture.app.loop.dispatch({ type: 'key', key: 'z', ctrl: false, alt: false, shift: false });
      fixture.app.loop.enableCommand(HEADLESS_SAVE_COMMAND, false);
      fixture.app.loop.dispatch({ type: 'key', key: 's', ctrl: true, alt: false, shift: false });

      expect(fixture.panel.routedActions).toBe(0);
      expect(fixture.panel.commandActions).toBe(0);
      expect(fixture.frameLines()).toEqual(before);
    } finally {
      fixture.dispose();
    }
  });

  test('should preserve exact anchors through constrained and expanded viewports', () => {
    const fixture = createHeadlessApplicationFixture({ viewport: { width: 18, height: 5 } });
    try {
      expect(fixture.app.loop.renderRoot.buffer().get(2, 1)?.char).toBe('>');
      expect(fixture.frameLines()[3]?.slice(2, 11)).toBe('Command:0');
      fixture.app.loop.resize({ width: 40, height: 10 });
      expect(fixture.panel.bounds).toMatchObject({ width: 40, height: 10 });
      expect(fixture.app.loop.renderRoot.buffer().get(2, 1)?.char).toBe('>');
      expect(fixture.frameLines()[3]?.slice(2, 11)).toBe('Command:0');
    } finally {
      fixture.dispose();
    }
  });

  test('should suppress a queued repaint and settle pending modal work on disposal', async () => {
    const pending: Array<() => void> = [];
    const logger = createLogger({ sink: 'ring', size: 4 });
    let frames = 0;
    let scheduledCallbacks = 0;
    const producer = new RetainedProducerView();
    const root = new Group();
    root.add(producer);
    const loop = createEventLoop(
      { width: 12, height: 3 },
      {
        caps,
        logger,
        scheduleMicrotask: (flush) => {
          scheduledCallbacks += 1;
          pending.push(flush);
        },
      },
    );
    loop.onFrame = () => {
      frames += 1;
    };
    loop.mount(root);
    const modal = new Group();
    root.add(modal);
    const result = loop.execView<string>(modal);
    producer.invalidate();
    const beforeDispose = frames;
    const diagnosticsBefore = logger.entries();
    loop.dispose();
    loop.dispose();
    const schedulesAfterDispose = scheduledCallbacks;
    producer.publish();
    expect(scheduledCallbacks).toBe(schedulesAfterDispose);
    pending.splice(0).forEach((flush) => flush());

    await expect(result).resolves.toBeUndefined();
    expect(frames).toBe(beforeDispose);
    expect(producer.publications).toBe(0);
    expect(producer.mounted).toBe(false);
    expect(pending).toHaveLength(0);
    expect(logger.entries()).toEqual(diagnosticsBefore);
  });

  test('should keep the authentic artifact bound to its strongest observable evidence', () => {
    expect(fixtureSource).toContain("redacted: !JSON.stringify(entries).includes('fixture-secret-payload')");
    expect(artifactSource).toContain('expect(modalActions).toBe(1)');
    expect(artifactSource).toContain('expect(fixture.panel.routedActions).toBe(backgroundActions)');
    expect(artifactSource).toContain('fg: defaultTheme.buttonFocused.fg');
    expect(artifactSource).toContain('bg: defaultTheme.buttonFocused.bg');
    expect(artifactSource).toContain('attrs: defaultTheme.buttonFocused.attrs ?? Attr.none');
  });

  test('should keep repeated draw failures bounded, redacted, and independently observable', () => {
    const first = renderHeadlessFailureEvidence();
    const second = renderHeadlessFailureEvidence();
    expect(first).toEqual({ frame: '   GGG', diagnostics: 1, redacted: true });
    expect(second).toEqual(first);
  });
});
