import { describe, expect, it, vi } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

/** Creates a standalone editor for implementation-boundary search checks. */
function createEditor(text: string) {
  const controller = createCodeEditorController({
    document: createDocumentModel({ text, uri: 'file:///search-implementation.txt' }),
  });
  return { controller, editor: new CodeEditor({ controller }) };
}

describe('search session implementation boundaries', () => {
  it('should bound retained query state and erase one complete Unicode code point', () => {
    const { editor } = createEditor('😀 value');
    editor.execute('search.open');
    editor.routeKey({ key: '😀', text: '😀' });
    expect(editor.searchState.query).toBe('😀');

    editor.routeKey({ key: 'Backspace' });
    expect(editor.searchState.query).toBe('');

    editor.setSearchQuery('x'.repeat(10_000));
    expect(editor.searchState.query).toHaveLength(4_096);
    editor.setSearchQuery(`${'x'.repeat(4_095)}😀tail`);
    expect(editor.searchState.query).toBe(`${'x'.repeat(4_095)}😀`);
    expect(Object.isFrozen(editor.searchState)).toBe(true);
  });

  it('should refresh cached matches after an unrelated controller mutation', () => {
    const { controller, editor } = createEditor('one one');
    editor.setSearchQuery('one');
    expect(editor.searchState.total).toBe(2);

    expect(
      controller.applyMutation({
        base: controller.document.identity,
        edits: [{ range: { from: 0, to: 3 }, text: 'two' }],
        origin: 'external',
      }),
    ).toMatchObject({ accepted: true });

    expect(editor.searchState.total).toBe(1);
  });

  it('should keep replacement controls inert after dismissal', () => {
    const { controller, editor } = createEditor('value');
    editor.execute('search.replaceOpen');
    editor.setSearchQuery('value');
    editor.setReplacementText('changed');
    editor.execute('search.dismiss');

    expect(editor.searchState.open).toBe(false);
    expect(editor.routeKey({ key: '!', text: '!' })).toEqual({ handled: true, owner: 'text' });
    expect(controller.document.text).toBe('!value');
  });

  it('should replace only a result selected by search navigation', () => {
    const { controller, editor } = createEditor('one one');
    editor.execute('search.replaceOpen');
    editor.setSearchQuery('one');
    editor.setReplacementText('two');
    controller.document.setSelection({ anchor: 0, head: 3 });

    editor.execute('search.replaceCurrent');
    expect(controller.document.text).toBe('one one');

    editor.execute('search.next');
    editor.execute('search.replaceCurrent');
    expect(controller.document.text).toBe('one two');
  });

  it('should revoke search ownership after an ordinary caret movement', () => {
    const { controller, editor } = createEditor('one one');
    editor.execute('search.replaceOpen');
    editor.setSearchQuery('one');
    editor.setReplacementText('two');
    editor.execute('search.next');
    editor.routeKey({ key: 'ArrowRight' });
    controller.document.setSelection({ anchor: 4, head: 7 });

    editor.execute('search.replaceCurrent');

    expect(controller.document.text).toBe('one one');
  });

  it('should cap retained matches at the renderer decoration ceiling', () => {
    const { editor } = createEditor('x '.repeat(6_000));
    editor.setSearchQuery('x');

    expect(editor.searchState.total).toBe(5_000);
  });

  it('should reject non-string runtime field values without invoking properties', () => {
    const { editor } = createEditor('value');
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'slice', {
      get() {
        throw new Error('must not execute');
      },
    });

    expect(() => editor.setSearchQuery(hostile as never)).not.toThrow();
    expect(() => editor.setReplacementText(hostile as never)).not.toThrow();
    expect(editor.searchState.query).toBe('');
    expect(editor.searchState.replacement).toBe('');
  });

  it('should scan bounded-mode documents across cancellable event-loop turns', async () => {
    const { editor } = createEditor(`${'A'.repeat(2 * 1_048_576)}needle`);
    const started = performance.now();

    editor.setSearchQuery('NEEDLE');

    expect(performance.now() - started).toBeLessThan(50);
    expect(editor.searchState.total).toBe(0);
    await vi.waitFor(() => expect(editor.searchState.total).toBe(1), { timeout: 2_000 });
    editor.dispose();
  });
});
