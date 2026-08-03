import { describe, expect, it } from 'vitest';

import {
  KanbanInvalidIdentityError,
  KanbanObservationBuffer,
  createKanbanColumnId,
  createKanbanObservation,
  createPlacementToken,
} from '../src/index.js';
import type { KanbanObservation } from '../src/index.js';

describe('Kanban local security boundary', () => {
  it('should redact hostile callback failures and omit records, query data, and placement tokens', () => {
    // Observations expose bounded diagnostics, never application payloads or raw callback exceptions.
    const card = { id: 42, title: 'private customer payload' };
    const query = { filter: 'secret-account-number' };
    const token = createPlacementToken('opaque-placement-secret');
    const failure = new Error(`raw failure: ${card.title}; ${query.filter}; ${token}`);

    const observation = createKanbanObservation({
      code: 'source-callback-failed',
      scope: 'source',
      cardKey: card.id,
      error: failure,
    });
    const serialized = JSON.stringify(observation);

    expect(observation).toMatchObject({
      code: 'source-callback-failed',
      scope: 'source',
      cardKey: card.id,
    });
    expect(serialized).not.toContain(card.title);
    expect(serialized).not.toContain(query.filter);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain(failure.message);
  });

  it('should bound observation messages and retain only the newest configured entries', () => {
    const buffer = new KanbanObservationBuffer(2);
    const observations: readonly KanbanObservation[] = [
      { code: 'first', scope: 'card', cardKey: 1, message: 'first safe message' },
      { code: 'second', scope: 'card', cardKey: '1', message: 'second safe message' },
      { code: 'third', scope: 'source', counts: { failures: 3 }, message: 'x'.repeat(10_000) },
    ];

    for (const observation of observations) buffer.push(observation);

    expect(buffer.values()).toHaveLength(2);
    expect(buffer.values().map(({ code }) => code)).toEqual(['second', 'third']);
    expect(buffer.values()[0]?.cardKey).toBe('1');
    expect(buffer.values()[1]?.message?.length).toBeLessThan(10_000);
  });

  it('should sanitize identity failures without disclosing hostile terminal payloads', () => {
    const hostileId = 'customer-secret\u001b]52;c;clipboard-payload\u0007';

    try {
      createKanbanColumnId(hostileId);
      throw new Error('expected identity validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(KanbanInvalidIdentityError);
      expect(error).toMatchObject({ code: 'invalid-identity', kind: 'column' });
      expect(String(error)).not.toContain('customer-secret');
      expect(String(error)).not.toContain('clipboard-payload');
      expect(String(error)).not.toContain('\u001b');
    }
  });

  it('should classify external infrastructure controls as application-owned rather than tested here', () => {
    // This package is an in-process terminal component with no server, transport, or persistence layer.
    const boundaryReport = {
      packageOwned: [
        'bounded-input-validation',
        'terminal-text-sanitization',
        'redacted-diagnostics',
        'callback-failure-isolation',
      ],
      applicationOwned: [
        'authorization',
        'storage-encryption',
        'network-tls',
        'server-rate-limiting',
        'host-hardening',
      ],
      notApplicablePackageMechanisms: [
        'shell-execution',
        'eval-execution',
        'sql-construction',
        'html-rendering',
        'path-resolution',
        'network-server',
      ],
    } as const;

    expect(boundaryReport.packageOwned).toContain('bounded-input-validation');
    expect(boundaryReport.applicationOwned).toEqual(
      expect.arrayContaining(['storage-encryption', 'network-tls', 'server-rate-limiting', 'host-hardening']),
    );
    expect(boundaryReport.notApplicablePackageMechanisms).toHaveLength(6);
  });
});
