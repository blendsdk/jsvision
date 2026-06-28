/**
 * Data-driven Tier-1 input-corpus regression runner (RD-09 FR-1, plan doc 03-01).
 *
 * Specification oracle (ST-1…ST-7): every `bytes → expected events/queries`
 * expectation is authored from the RD-06 event contract and the classic xterm /
 * SGR / bracketed-paste grammars — never by running the decoder and copying its
 * output. The corpus is the checked-in, shareable evidence base; this file just
 * iterates it. If a case fails after implementation, the **engine** is wrong, not
 * the fixture (AR-8) — provided the fixture matches the contract.
 *
 * Each record feeds its bytes to `decode()` (optionally split into chunks to
 * exercise cross-chunk state threading, RD-06 RT-1), then calls `flush()`, and
 * asserts both the app-facing `events` and the isolated `queries` channel (PL-9).
 *
 * The `.js` extension in the import specifier is required by NodeNext ESM
 * resolution (it resolves to the `.ts` source during development via tsx).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDecoderState, decode, flush } from '../src/engine/index.js';
import type { DecodeOptions, InputEvent, QueryResponse } from '../src/engine/index.js';

const here = dirname(fileURLToPath(import.meta.url)); // test/
const CORPUS_DIR = join(here, 'fixtures', 'input-corpus');

/** A single expected query reply — the classification only (raw bytes are not asserted). */
interface ExpectedQuery {
  readonly kind: QueryResponse['kind'];
}

/** One corpus record: input bytes (+ optional chunking) → expected events and queries. */
interface CorpusRecord {
  readonly name: string;
  /** Lowercase, even-length, `[0-9a-f]` hex of the input bytes. */
  readonly bytesHex: string;
  /** `null` = one `decode()` call; an array of split offsets = multiple chunked calls. */
  readonly chunks: number[] | null;
  /** Optional per-case paste size-cap override (mirrors {@link DecodeOptions.pasteCap}). */
  readonly pasteCap?: number;
  /** The full ordered app-facing event list expected across all chunks plus `flush()`. */
  readonly expectedEvents: InputEvent[];
  /** Optional ordered query-reply classifications expected on the `queries` channel. */
  readonly expectedQueries?: ExpectedQuery[];
}

/**
 * Parse lowercase, even-length hex into bytes. The security boundary (AR-6): odd
 * length or any non-`[0-9a-f]` byte throws rather than silently mis-decoding.
 *
 * @param hex The hex string to parse.
 * @returns The decoded bytes.
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/.test(hex)) {
    throw new Error(`corpus: malformed bytesHex: ${JSON.stringify(hex)}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Split bytes at the given ascending offsets into successive decode() chunks.
 * `null` yields a single chunk. An out-of-range or non-ascending offset throws
 * (a fixture-authoring bug surfaced loudly, AR-6).
 *
 * @param bytes The full input bytes.
 * @param chunks `null` for one chunk, or split offsets in `(0, bytes.length)`.
 * @returns The ordered chunk views.
 */
export function splitChunks(bytes: Uint8Array, chunks: number[] | null): Uint8Array[] {
  if (chunks === null) {
    return [bytes];
  }
  const slices: Uint8Array[] = [];
  let prev = 0;
  for (const offset of chunks) {
    if (!Number.isInteger(offset) || offset <= prev || offset >= bytes.length) {
      throw new Error(`corpus: chunk offset out of range: ${offset}`);
    }
    slices.push(bytes.subarray(prev, offset));
    prev = offset;
  }
  slices.push(bytes.subarray(prev));
  return slices;
}

/** Load every `*.json` corpus file as `{ name, cases }`, sorted for deterministic order. */
export function loadCorpusFiles(dir: string): { name: string; cases: CorpusRecord[] }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((name) => ({ name, cases: JSON.parse(readFileSync(join(dir, name), 'utf8')) as CorpusRecord[] }));
}

/** Decode one record's bytes (chunked + flush), collecting events and query classifications. */
function runRecord(record: CorpusRecord): { events: InputEvent[]; queries: ExpectedQuery[] } {
  const opts: DecodeOptions | undefined = record.pasteCap !== undefined ? { pasteCap: record.pasteCap } : undefined;
  const bytes = hexToBytes(record.bytesHex);
  let state = createDecoderState();
  const events: InputEvent[] = [];
  const queries: ExpectedQuery[] = [];
  for (const chunk of splitChunks(bytes, record.chunks)) {
    const result = decode(chunk, state, opts);
    events.push(...result.events);
    for (const q of result.queries) queries.push({ kind: q.kind });
    state = result.state;
  }
  const flushed = flush(state, opts);
  events.push(...flushed.events);
  for (const q of flushed.queries) queries.push({ kind: q.kind });
  return { events, queries };
}

for (const file of loadCorpusFiles(CORPUS_DIR)) {
  for (const record of file.cases) {
    test(`corpus: ${file.name} / ${record.name}`, () => {
      const { events, queries } = runRecord(record);
      assert.deepEqual(events, record.expectedEvents);
      assert.deepEqual(queries, record.expectedQueries ?? []);
    });
  }
}
