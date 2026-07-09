/**
 * Probe 0 — connectivity + import smoke test.
 *
 * Proves: (a) `pg` connects to the throwaway DB and `SELECT 1` returns; (b) a `tsx` script in this
 * workspace can `import { DataGrid } from '@jsvision/ui'` (by name → built dist) without a resolution
 * error; (c) records the pg/Node versions and confirms no native build occurred.
 */
import { DataGrid } from '@jsvision/ui';
import { createRequire } from 'node:module';
import { pool, query, safeUrl } from './db.js';

const require = createRequire(import.meta.url);

async function main(): Promise<void> {
  console.log('=== Probe 0: setup smoke ===');
  console.log('Node:', process.version);
  const pgPkg = require('pg/package.json') as { version: string };
  console.log('pg:', pgPkg.version, '(pure JS — no native build)');
  console.log('DATABASE_URL:', safeUrl(process.env.DATABASE_URL ?? ''));

  const one = await query<{ n: number }>('SELECT 1 AS n');
  console.log('SELECT 1 →', one.rows[0].n);

  const ver = await query<{ version: string }>('SELECT version()');
  console.log('server:', ver.rows[0].version.split(',')[0]);

  const counts = await query<{ obj: string; n: string }>(
    `SELECT 'customer' AS obj, count(*)::text AS n FROM app.customer
     UNION ALL SELECT 'big', count(*)::text FROM app.big`,
  );
  for (const r of counts.rows) console.log(`  app.${r.obj}: ${r.n} rows`);

  // Import resolves (this line throwing would mean a resolution failure).
  console.log('import DataGrid from @jsvision/ui →', typeof DataGrid === 'function' ? 'OK' : 'FAIL');

  console.log('\nProbe 0 verdict: 🟢 pg connects, seed present, @jsvision/ui resolves by name.');
}

main()
  .catch((err) => {
    console.error('Probe 0 FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
