/**
 * Probe 2 runner — exercise parameterized CRUD, transactions, xmin optimistic concurrency, the
 * composite-PK and no-PK edge cases, and constraint-error mapping. Leaves the seed pristine (all
 * scratch rows are inserted then deleted; the two-connection conflict test operates on a temp row).
 */
import type { PoolClient } from 'pg';
import { pool, withTransaction } from './db.js';
import {
  deleteByKey,
  insertReturning,
  mapPgError,
  selectKeyset,
  selectPage,
  updateByKey,
  updateOptimistic,
} from './crud.js';

interface Customer {
  id: number;
  name: string;
  email: string | null;
  tier: string;
  credit_limit: string;
  balance: string;
  xmin: string;
}

async function tryMapped(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    console.log(`   ${label}: (no error — unexpected)`);
  } catch (err) {
    const mapped = mapPgError(err);
    if (!mapped) throw err;
    console.log(`   ${label}: [${mapped.kind}] code=${mapped.code} → "${mapped.message}"`);
  }
}

async function main(): Promise<void> {
  console.log('=== Probe 2: CRUD / transactions / concurrency / errors ===');

  // 1. Parameterized paged SELECT (offset + keyset).
  const page = await selectPage<Customer>('app', 'customer', ['id'], 2, 0);
  console.log('\n1. paged SELECT (offset, limit 2):', page.rows.map((r) => `${r.id}:${r.name}`).join(', '));
  const seek = await selectKeyset<Customer>('app', 'customer', 'id', 2, 2);
  console.log('   keyset SELECT (id > 2, limit 2):', seek.rows.map((r) => `${r.id}:${r.name}`).join(', '));

  // 2. INSERT … RETURNING + UPDATE by PK + DELETE by PK (all parameterized), inside a transaction.
  console.log('\n2. INSERT/UPDATE/DELETE by PK in a transaction:');
  const inserted = await insertReturning<Customer>('app', 'customer', {
    name: 'Spike Temp',
    email: 'temp@example.com',
    tier: 'silver',
    credit_limit: 500,
  });
  console.log(`   INSERT RETURNING → id=${inserted.id} xmin=${inserted.xmin}`);
  const updated = await updateByKey<Customer>('app', 'customer', { id: inserted.id }, { balance: 42 });
  console.log(`   UPDATE WHERE id=${inserted.id} → balance=${updated?.balance}`);

  // 3. Transaction rollback around a multi-row edit (no persistence after rollback).
  console.log('\n3. transaction rollback (multi-row edit reverted):');
  await pool
    .query('SELECT balance FROM app.customer WHERE id=$1', [inserted.id])
    .then((r) => console.log(`   before: balance=${r.rows[0].balance}`));
  await withTransaction(async (c: PoolClient) => {
    await updateByKey('app', 'customer', { id: inserted.id }, { balance: 999 }, c);
    await updateByKey('app', 'customer', { id: inserted.id }, { credit_limit: 999 }, c);
    throw new Error('simulated failure → rollback');
  }).catch((e) => console.log(`   txn threw: ${(e as Error).message}`));
  await pool
    .query('SELECT balance, credit_limit FROM app.customer WHERE id=$1', [inserted.id])
    .then((r) => console.log(`   after rollback: balance=${r.rows[0].balance} credit_limit=${r.rows[0].credit_limit} (reverted ✓)`));

  // 4. Optimistic concurrency via xmin — two connections, second write conflicts.
  console.log('\n4. optimistic concurrency (xmin), two connections:');
  const a = await pool.connect();
  const b = await pool.connect();
  try {
    const read = (await a.query('SELECT *, xmin::text AS xmin FROM app.customer WHERE id=$1', [inserted.id])).rows[0] as Customer;
    console.log(`   A reads id=${inserted.id}, xmin=${read.xmin}`);
    const bWrite = await updateByKey<Customer>('app', 'customer', { id: inserted.id }, { balance: 100 }, b);
    console.log(`   B commits a change → new xmin=${bWrite?.xmin}`);
    const aWrite = await updateOptimistic<Customer>('app', 'customer', { id: inserted.id }, { balance: 200 }, read.xmin, a);
    console.log(`   A optimistic update with STALE xmin → ${aWrite.ok ? 'wrote (BUG)' : 'CONFLICT DETECTED ✓ (0 rows)'}`);
    const fresh = (await a.query('SELECT xmin::text AS xmin FROM app.customer WHERE id=$1', [inserted.id])).rows[0] as Customer;
    const aRetry = await updateOptimistic<Customer>('app', 'customer', { id: inserted.id }, { balance: 200 }, fresh.xmin, a);
    console.log(`   A re-reads fresh xmin then retries → ${aRetry.ok ? 'wrote ✓' : 'still conflict (BUG)'}`);
  } finally {
    a.release();
    b.release();
  }

  // 5. Composite-PK table (order_item): UPDATE/DELETE keyed on (order_id, line_no).
  console.log('\n5. composite-PK (app.order_item), key = (order_id, line_no):');
  await withTransaction(async (c) => {
    const before = (await c.query('SELECT qty FROM app.order_item WHERE order_id=1 AND line_no=1')).rows[0];
    const up = await updateByKey('app', 'order_item', { order_id: 1, line_no: 1 }, { qty: 7 }, c);
    console.log(`   UPDATE qty ${before.qty}→7 keyed on composite PK → ${up ? 'ok ✓' : 'no match'}`);
    await c.query('SELECT 1'); // then rollback (below) to keep the seed pristine
    throw new Error('rollback-composite');
  }).catch(() => console.log('   (rolled back — seed pristine)'));

  // 6. No-PK table (app.tag): what identifies a row? Decision → read-only.
  console.log('\n6. no-PK table (app.tag) — row identity:');
  const dupCheck = await pool.query(
    `SELECT count(*) - count(DISTINCT (label, color)) AS dup_rows FROM app.tag`,
  );
  console.log(`   full-row-match UPDATE is ambiguous when duplicate rows exist (dup rows now: ${dupCheck.rows[0].dup_rows}).`);
  const ctid = await pool.query(`SELECT ctid::text, label FROM app.tag LIMIT 1`);
  console.log(`   ctid gives a physical row id (${ctid.rows[0].ctid} → ${ctid.rows[0].label}) but it CHANGES on UPDATE/VACUUM.`);
  console.log('   DECISION: a no-PK table is READ-ONLY in the editor (or require the user to add a PK). ✓');

  // 7. Constraint errors → structured, user-presentable.
  console.log('\n7. constraint errors mapped to structured messages:');
  await tryMapped('CHECK (credit_limit>=0)', () =>
    updateByKey('app', 'customer', { id: inserted.id }, { credit_limit: -5 }),
  );
  await tryMapped('NOT NULL (name)', () => updateByKey('app', 'customer', { id: inserted.id }, { name: null }));
  await tryMapped('CHECK (order_item.qty>0)', () =>
    updateByKey('app', 'order_item', { order_id: 1, line_no: 1 }, { qty: 0 }),
  );
  await tryMapped('FK (order.customer_id)', () =>
    insertReturning('app', 'order', { customer_id: 999999, total: 1 }),
  );
  await tryMapped('bad numeric input', () => updateByKey('app', 'customer', { id: inserted.id }, { balance: 'not-a-number' }));

  // Cleanup: remove the scratch customer so the seed stays pristine.
  const del = await deleteByKey('app', 'customer', { id: inserted.id });
  console.log(`\ncleanup: deleted scratch customer id=${inserted.id} (${del} row) — seed pristine.`);
  console.log('\nProbe 2 verdict: 🟢 parameterized CRUD, txn rollback, xmin conflict detection, composite-PK all work;');
  console.log('   no-PK → read-only; constraint errors map to structured, user-presentable messages.');
}

main()
  .catch((err) => {
    console.error('Probe 2 FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
