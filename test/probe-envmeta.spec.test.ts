/**
 * Specification tests — env-meta security boundary (RD-03, plan doc 03-02).
 *
 * Oracle source: 07-testing-strategy.md ST-28 (RD AC-8 / AR-17). Only allowlisted env
 * keys may appear in the metadata; no other environment value may leak. Expectations
 * derive from the security requirement, not from the implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gatherEnvMeta } from '../examples/capability-probe/env-meta.js';

// ST-28: allowlisted env is recorded; secrets are never copied anywhere.
test('ST-28: only allowlisted env keys are recorded; secrets do not leak', () => {
  const meta = gatherEnvMeta({
    env: {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      SECRET: 'topsecret-value',
      AWS_SECRET_ACCESS_KEY: 'aws-leak-value',
    },
    platform: 'linux',
    now: () => '2026-06-28T00:00:00.000Z',
  });

  assert.equal(meta.term, 'xterm-256color');
  assert.equal(meta.colorterm, 'truecolor');
  assert.equal(meta.os, 'linux');
  assert.equal(meta.timestamp, '2026-06-28T00:00:00.000Z');

  // No secret value may appear anywhere in the serialized metadata.
  const serialized = JSON.stringify(meta);
  assert.ok(!serialized.includes('topsecret-value'), 'SECRET must not leak');
  assert.ok(!serialized.includes('aws-leak-value'), 'AWS key must not leak');
});
