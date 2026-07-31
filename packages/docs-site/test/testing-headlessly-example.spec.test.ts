/**
 * Authentic runnable artifact for the Testing headlessly course.
 *
 * These tests use real application, renderer, focus, event, command, modal, resize, failure, and
 * disposal seams while replacing only the absent terminal with a deterministic in-memory buffer.
 */
import { Attr, defaultTheme } from '@jsvision/core';
import { Group, signal } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import {
  HeadlessActionView,
  createHeadlessApplicationFixture,
  renderHeadlessFailureEvidence,
} from '../src/example-fixtures/testing-headlessly/application-fixture.js';

describe('Testing headlessly authentic artifact', () => {
  test('should inspect exact cells after routed key, mouse, and command input', () => {
    const fixture = createHeadlessApplicationFixture();
    try {
      const initial = fixture.app.loop.renderRoot.buffer();
      expect(initial.get(2, 1)?.char).toBe('>');
      expect(initial.get(4, 1)?.char).toBe('C');
      expect(initial.get(2, 1)).toMatchObject({
        fg: defaultTheme.buttonFocused.fg,
        bg: defaultTheme.buttonFocused.bg,
        attrs: defaultTheme.buttonFocused.attrs ?? Attr.none,
      });

      fixture.app.loop.dispatch({ type: 'key', key: 'x', ctrl: false, alt: false, shift: false });
      fixture.app.loop.dispatch({
        type: 'mouse',
        kind: 'down',
        button: 0,
        x: 3,
        y: 2,
      });
      fixture.app.loop.dispatch({ type: 'key', key: 's', ctrl: true, alt: false, shift: false });

      expect(fixture.panel.routedActions).toBe(2);
      expect(fixture.panel.lastRoute).toBe('mouse:0,0');
      expect(fixture.panel.commandActions).toBe(1);
      expect(fixture.frameLines()[1]?.slice(2, 11)).toBe('> Count:2');
      expect(fixture.frameLines()[2]?.slice(2, 17)).toBe('Route:mouse:0,0');
      expect(fixture.frameLines()[3]?.slice(2, 11)).toBe('Command:1');
    } finally {
      fixture.dispose();
    }
  });

  test('should settle modal work and restore the previous focus deterministically', async () => {
    const fixture = createHeadlessApplicationFixture();
    const modal = new Group();
    let modalActions = 0;
    const modalLeaf = new HeadlessActionView(signal(0), () => {
      modalActions += 1;
    });
    modal.add(modalLeaf);
    fixture.panel.add(modal);
    try {
      const before = fixture.app.loop.getFocused();
      const backgroundActions = fixture.panel.routedActions;
      const result = fixture.app.loop.execView<string>(modal);
      expect(fixture.app.loop.getFocused()).toBe(modalLeaf);
      fixture.app.loop.dispatch({ type: 'key', key: 'x', ctrl: false, alt: false, shift: false });
      expect(modalActions).toBe(1);
      expect(fixture.panel.routedActions).toBe(backgroundActions);
      fixture.app.loop.endModal('accepted');
      await expect(result).resolves.toBe('accepted');
      expect(fixture.app.loop.getFocused()).toBe(before);
      fixture.app.loop.dispatch({ type: 'key', key: 'x', ctrl: false, alt: false, shift: false });
      expect(fixture.panel.routedActions).toBe(backgroundActions + 1);
    } finally {
      fixture.panel.remove(modal);
      fixture.dispose();
    }
  });

  test('should resize the real application and release mounted ownership exactly once', () => {
    const fixture = createHeadlessApplicationFixture();
    fixture.app.loop.resize({ width: 32, height: 8 });
    expect(fixture.app.loop.renderRoot.buffer().width).toBe(32);
    expect(fixture.app.loop.renderRoot.buffer().height).toBe(8);
    expect(fixture.panel.bounds).toMatchObject({ width: 32, height: 8 });
    fixture.dispose();
    fixture.dispose();
    expect(fixture.panel.cleanupCount).toBe(1);
    expect(fixture.panel.mounted).toBe(false);
  });

  test('should isolate draw failure, preserve the sibling frame, and redact the payload', () => {
    const evidence = renderHeadlessFailureEvidence();
    expect(evidence.frame).toBe('   GGG');
    expect(evidence.diagnostics).toBe(1);
    expect(evidence.redacted).toBe(true);
  });
});
