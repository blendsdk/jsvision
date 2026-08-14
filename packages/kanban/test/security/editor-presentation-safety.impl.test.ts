import { createI18n } from '@jsvision/i18n';
import { describe, expect, it } from 'vitest';

import { resolveKanbanEditorMessage } from '../../src/editor/presentation-text.js';

describe('Kanban editor presentation safety', () => {
  it('should sanitize and bound translated terminal text', () => {
    const base = createI18n();
    const hostile = new Proxy(base, {
      get(target, property, receiver) {
        if (property === 't') return () => `\u001b[31m${'x'.repeat(1_000)}\nunsafe`;
        return Reflect.get(target, property, receiver);
      },
    });

    const resolved = resolveKanbanEditorMessage(hostile, 'kanban.editor.title', 'Safe title');

    expect(resolved).not.toContain('\u001b');
    expect(resolved).not.toContain('\n');
    expect(resolved.length).toBeLessThanOrEqual(512);
  });

  it('should contain translation failures and use the sanitized fallback', () => {
    const base = createI18n();
    const failing = new Proxy(base, {
      get(target, property, receiver) {
        if (property === 't')
          return () => {
            throw new Error('translation unavailable');
          };
        return Reflect.get(target, property, receiver);
      },
    });

    expect(resolveKanbanEditorMessage(failing, 'kanban.editor.title', '\u001b[32mCard\neditor')).toBe('Card editor');
  });
});
