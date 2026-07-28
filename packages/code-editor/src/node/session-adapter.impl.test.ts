import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createCodeEditorNodeSession } from './session-adapter.js';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'inert-lsp-server.cjs');

describe('Node LSP session adapter', () => {
  it('should reject relative executables and invalid process arguments', () => {
    expect(() => createCodeEditorNodeSession({ executable: 'server' })).toThrow(TypeError);
    expect(() => createCodeEditorNodeSession({ executable: process.execPath, arguments: ['bad\0argument'] })).toThrow(
      TypeError,
    );
    expect(() => createCodeEditorNodeSession({ executable: process.execPath, cwd: '../workspace' })).toThrow(TypeError);
  });

  it('should initialize and exchange a request with the inert stdio server', async () => {
    const session = createCodeEditorNodeSession({
      executable: process.execPath,
      arguments: [fixture],
    });
    await session.start();
    expect(session.state).toBe('ready');
    expect(session.capabilities).toMatchObject({ hover: true, completion: true, documentFormatting: true });
    const result = await new Promise<unknown>((resolve, reject) => {
      const id = session.reserveRequestId();
      session.request(
        id,
        'textDocument/hover',
        { textDocument: { uri: 'file:///workspace/source.ts' }, position: { line: 0, character: 0 } },
        (value, error) => {
          if (error !== undefined) reject(error);
          else resolve(value);
        },
      );
    });
    expect(result).toEqual({ contents: 'inert hover' });
    await session.stop();
    expect(session.state).toBe('closed');
  });

  it('should bound and sanitize stderr before exposing it to a host', async () => {
    const output: string[] = [];
    const session = createCodeEditorNodeSession({
      executable: process.execPath,
      arguments: ['-e', "process.stderr.write('\\u001b[31msecret');process.exit(1)"],
      stderrLimit: 4,
      onStderr: (text) => output.push(text),
    });
    await expect(session.start()).rejects.toBeDefined();
    expect(output.join('')).toBe('secr');
    expect(output.join('')).not.toContain('\u001B');
  });

  it('should reject oversized protocol frames before JSON parsing', async () => {
    const session = createCodeEditorNodeSession({
      executable: process.execPath,
      arguments: [fixture, '--oversized-frame'],
      messageByteLimit: 1024,
      lifecycleTimeoutMs: 500,
    });
    await expect(session.start()).rejects.toBeDefined();
    expect(session.state).toBe('closed');
  });

  it('should bound initialization when a process never answers', async () => {
    const session = createCodeEditorNodeSession({
      executable: process.execPath,
      arguments: ['-e', 'process.stdin.resume()'],
      lifecycleTimeoutMs: 100,
    });
    await expect(session.start()).rejects.toThrow(/timed out/iu);
    expect(session.state).toBe('closed');
  });
});
