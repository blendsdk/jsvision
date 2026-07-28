/** JSON and catalog builders shared by the Node loader specification tests. */

/** Hard public loader limits used at their exact acceptance boundaries. */
export const nodeLoaderLimits = Object.freeze({
  fileBytes: 2 * 1024 * 1024,
  keyScalars: 512,
  messageBytes: 65_536,
  messages: 10_000,
});

/** Produce one schema-1 JSON catalog without retaining the supplied message map. */
export function catalogJson(locale: string, messages: Readonly<Record<string, unknown>>): string {
  return JSON.stringify({ schema: 1, locale, messages });
}

/** Produce a valid JSON document padded to an exact UTF-8 byte size with JSON whitespace. */
export function padJsonToBytes(json: string, bytes: number): string {
  const current = Buffer.byteLength(json);
  if (current > bytes) throw new RangeError('JSON fixture is larger than its requested byte size.');
  return json + ' '.repeat(bytes - current);
}

/** Produce a catalog with exactly the requested number of valid messages. */
export function countedCatalogJson(count: number): string {
  return catalogJson(
    'en',
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`fixture.key-${index}`, 'value'])),
  );
}

/** Produce a namespaced key with an exact Unicode-scalar count. */
export function keyWithScalars(count: number): string {
  if (count < 5) throw new RangeError('A namespaced fixture key needs at least five scalars.');
  return `app.${'k'.repeat(count - 4)}`;
}

/** Strict-JSON failures that permissive parsing must never normalize or accept. */
export const strictJsonFailures = Object.freeze([
  {
    label: 'duplicate top-level member',
    json: '{"schema":1,"schema":1,"locale":"en","messages":{}}',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'duplicate messages member',
    json: '{"schema":1,"locale":"en","messages":{"app.title":"First","app.title":"Second"}}',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'duplicate structured-message member',
    json: '{"schema":1,"locale":"en","messages":{"app.count":{"kind":"plural","kind":"select","parameter":"count","cases":{"other":"Other"}}}}',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'duplicate case member',
    json: '{"schema":1,"locale":"en","messages":{"app.count":{"kind":"plural","parameter":"count","cases":{"other":"First","other":"Second"}}}}',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'line comment',
    json: '{"schema":1,// comment\n"locale":"en","messages":{}}',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'block comment',
    json: '{"schema":1,"locale":"en",/* comment */"messages":{}}',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'trailing data',
    json: '{"schema":1,"locale":"en","messages":{}} false',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'leading-zero number',
    json: '{"schema":01,"locale":"en","messages":{}}',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'non-finite number',
    json: '{"schema":1e9999,"locale":"en","messages":{}}',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'malformed string escape',
    json: '{"schema":1,"locale":"en","messages":{"app.title":"\\x"}}',
    expectedCode: 'INVALID_JSON',
  },
  {
    label: 'inferred locale map shape',
    json: '{"en":{"app.title":"Title"}}',
    expectedCode: 'INVALID_CATALOG',
  },
  {
    label: 'unknown catalog field',
    json: '{"schema":1,"locale":"en","messages":{},"unexpected":true}',
    expectedCode: 'INVALID_CATALOG',
  },
] as const);

/** Every forbidden terminal-control or bidi scalar accepted by JSON escaping. */
export const unsafeCatalogText = Object.freeze([
  ...Array.from({ length: 0x20 }, (_, value) => value)
    .filter((value) => value !== 0x0a)
    .map((value) => ({
      expectedCode: 'UNSAFE_TEXT',
      label: `U+${value.toString(16).toUpperCase().padStart(4, '0')}`,
      value: String.fromCodePoint(value),
    })),
  ...Array.from({ length: 0x21 }, (_, offset) => offset + 0x7f).map((value) => ({
    expectedCode: 'UNSAFE_TEXT',
    label: `U+${value.toString(16).toUpperCase().padStart(4, '0')}`,
    value: String.fromCodePoint(value),
  })),
  ...Array.from({ length: 5 }, (_, offset) => offset + 0x202a).map((value) => ({
    expectedCode: 'UNSAFE_TEXT',
    label: `U+${value.toString(16).toUpperCase()}`,
    value: String.fromCodePoint(value),
  })),
  ...Array.from({ length: 4 }, (_, offset) => offset + 0x2066).map((value) => ({
    expectedCode: 'UNSAFE_TEXT',
    label: `U+${value.toString(16).toUpperCase()}`,
    value: String.fromCodePoint(value),
  })),
  { expectedCode: 'INVALID_JSON', label: 'lone high surrogate', value: '\uD800' },
  { expectedCode: 'INVALID_JSON', label: 'lone low surrogate', value: '\uDC00' },
] as const);

/** Reference and candidate catalogs covering strict parity and accelerator failures. */
export const strictReferenceCatalog = Object.freeze({
  schema: 1 as const,
  locale: 'en',
  messages: Object.freeze({
    'dialog.open': '~O~pen ${name}',
    'dialog.save': '~S~ave',
    'items.count': Object.freeze({
      kind: 'plural' as const,
      parameter: 'count',
      cases: Object.freeze({ one: 'One item', other: '${count} items' }),
    }),
    'status.label': 'Status',
  }),
});

/** Deliberately incomplete candidate used to assert every strict-parity issue family. */
export const incompleteDutchCatalog = Object.freeze({
  schema: 1 as const,
  locale: 'nl',
  messages: Object.freeze({
    'dialog.open': '~O~penen',
    'dialog.save': '~O~pslaan',
    'items.count': 'Artikelen',
    'extra.label': 'Extra',
  }),
});
