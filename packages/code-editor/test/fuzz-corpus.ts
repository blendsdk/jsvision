/** Terminal-hostile values used across renderer and serialization security tests. */
export const terminalHostileCorpus: readonly unknown[] = Object.freeze([
  ...Array.from({ length: 32 }, (_, code) => String.fromCharCode(code)),
  ...Array.from({ length: 32 }, (_, code) => String.fromCharCode(0x80 + code)),
  '\u001b[31mred',
  '\u001b]0;title\u0007',
  '\u001bPdevice\u001b\\',
  '\u202aoverride\u202c',
  '\u2066isolate\u2069',
  '\u200bzero-width',
]);

/** Protocol values covering malformed envelopes, ranges, sizes, and unsafe URI schemes. */
export const protocolHostileCorpus: readonly unknown[] = Object.freeze([
  null,
  [],
  { jsonrpc: '1.0' },
  { jsonrpc: '2.0', id: -1, result: {} },
  { jsonrpc: '2.0', id: Number.NaN, result: {} },
  { range: { start: { line: -1, character: 0 }, end: { line: 0, character: 0 } } },
  { range: { start: { line: 1, character: 0 }, end: { line: 0, character: 0 } } },
  { uri: 'javascript:alert(1)' },
  { uri: 'data:text/html,unsafe' },
  { message: 'x'.repeat(8_193) },
]);

const hostileThemeAccessor = Object.create(null) as Record<string, unknown>;
Object.defineProperty(hostileThemeAccessor, 'name', {
  enumerable: true,
  get() {
    throw new Error('theme getter must not execute');
  },
});

/** Theme values covering getters, proxies, prototypes, depth, and malformed colors. */
export const themeHostileCorpus: readonly unknown[] = Object.freeze([
  null,
  [],
  hostileThemeAccessor,
  new Proxy(Object.create(null), {
    get() {
      throw new Error('theme proxy must not execute');
    },
  }),
  { name: '\u001b]0;unsafe\u0007' },
  { colors: { foreground: '#xyz' } },
  { surfaces: Object.create({ editor: { fg: '#fff' } }) },
  { nested: { nested: { nested: { nested: { nested: true } } } } },
  { constructor: { prototype: { polluted: true } } },
  { __proto__: { polluted: true } },
]);
