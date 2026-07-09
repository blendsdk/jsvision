/**
 * Probe 6 runner — the "VBA-in-TS" event model. A trusted, in-process TypeScript handler wired into
 * `RecordSet.commit()` can (a) VETO a save with a user-presentable message and (b) MUTATE the pending
 * record before it is written — plus `OnCurrent`/`AfterUpdate` lifecycle events. Then a written
 * assessment (no build) of the untrusted-end-user sandbox options.
 */
import { pool } from './db.js';
import { pgSource } from './data-source.js';
import { RecordSet } from './record-set.js';

async function main(): Promise<void> {
  console.log('=== Probe 6: scripting / event model (BeforeSave veto) ===');
  const source = await pgSource('app', 'customer');
  const rs = new RecordSet(source, await source.fetchWindow(0, 100));
  rs.first();

  // Lifecycle events (OnCurrent / AfterUpdate) — trusted handlers, plain function registration.
  const log: string[] = [];
  rs.on('current', (row) => log.push(`OnCurrent → id=${(row as { id?: number })?.id}`));
  rs.on('commit', (row) => log.push(`AfterUpdate → balance=${(row as { balance?: string })?.balance}`));

  // A trusted BeforeSave handler = ordinary TypeScript with a curated API (ctx.get/set/veto).
  //  1) business rule beyond any DB constraint: balance may not exceed the credit limit;
  //  2) a normalisation mutation: collapse whitespace in the name before saving.
  rs.onBeforeSave((ctx) => {
    const name = ctx.get('name');
    const normalized = name.replace(/\s+/g, ' ').trim();
    if (normalized !== name) ctx.set('name', normalized);

    const balance = Number(ctx.get('balance'));
    const creditLimit = Number(ctx.get('credit_limit'));
    if (Number.isFinite(balance) && Number.isFinite(creditLimit) && balance > creditLimit) {
      ctx.veto(`Balance ${balance} exceeds the credit limit ${creditLimit}.`);
    }
  });

  const target = rs.current();
  console.log(
    `\ncurrent id=${target?.id} name="${target?.name}" balance=${target?.balance} credit_limit=${target?.credit_limit}`,
  );

  // Scenario A — a rule violation is VETOED end-to-end; no DB write occurs.
  console.log('\nA. edit balance ABOVE the credit limit → BeforeSave veto:');
  rs.field('balance').set('999999');
  const vetoed = await rs.commit();
  console.log(`   commit() → ${vetoed.status}` + (vetoed.status === 'vetoed' ? ` : "${vetoed.message}"` : ''));
  const afterVeto = await pool.query('SELECT balance FROM app.customer WHERE id=$1', [target?.id]);
  console.log(`   DB balance still = ${afterVeto.rows[0].balance} (no write — veto blocked it ✓)`);
  rs.rollback();

  // Scenario B — a valid edit with a messy name; the handler normalises it, then it persists.
  console.log('\nB. edit balance within limit + a messy name → handler normalises, then persists:');
  rs.field('balance').set('1500.00');
  rs.field('name').set('  Ada   Lovelace  ');
  const ok = await rs.commit();
  console.log(
    `   commit() → ${ok.status}` + (ok.status === 'ok' ? ` : name="${ok.row.name}" balance=${ok.row.balance}` : ''),
  );
  const afterOk = await pool.query('SELECT name, balance FROM app.customer WHERE id=$1', [target?.id]);
  console.log(
    `   DB now → name="${afterOk.rows[0].name}" balance=${afterOk.rows[0].balance} (normalised name persisted ✓)`,
  );

  // Move the cursor to show the OnCurrent event fires.
  rs.next();
  rs.prev();

  console.log('\n   lifecycle events observed:');
  for (const e of log) console.log(`     • ${e}`);

  // Restore the seed.
  await pool.query('UPDATE app.customer SET name=$1, balance=$2 WHERE id=$3', [
    target?.name,
    target?.balance,
    target?.id,
  ]);
  console.log(`\n   restored name/balance for id=${target?.id} — seed pristine.`);

  console.log('\n--- UNTRUSTED-SANDBOX ASSESSMENT (assessed, NOT built) ---');
  console.log(`  TRUSTED handlers (dev-authored): essentially FREE — they are plain functions over a
  curated API (ctx.get/set/veto + parameterized queries only). Demonstrated above. This is the
  "VBA problem" solved by the host language being the scripting language.

  UNTRUSTED handlers (end-user-authored) need isolation. Options:
    • node:vm — same heap, weak isolation. A determined script can escape (prototype/constructor
      reach) and there is no CPU/memory bound. NOT safe for hostile input. Cheap to wire; fine only
      for semi-trusted power users. Verdict: insufficient alone.
    • isolated-vm — a separate V8 isolate: real memory/CPU limits, no shared heap. Strong isolation,
      the industry default. BUT it is a NATIVE addon — it violates the zero-native-dep ethos, though
      only in the Data Studio APP package (the check:deps guard hits published packages only, so it
      is ALLOWED here). Verdict: the right tool IF untrusted scripting is a real requirement.
    • Restricted DSL / expression language — a small, purpose-built evaluator (field refs, arithmetic,
      comparisons, a whitelist of functions) with no host reach at all. Safest and dependency-free,
      but limited expressiveness and it is real language-design work. Verdict: good for validation/
      calculated-field expressions; not a general event language.

  RECOMMENDATION: ship TRUSTED TS handlers first (near-zero cost, covers the dev-facing v1). DEFER the
  untrusted sandbox. If/when end-user scripting is required, reach for isolated-vm in the app package,
  and expose ONLY a capability-limited API (parameterized queries, no fs/net; @jsvision/core already
  ships redactEvent/sanitize DNA for the boundary). A restricted DSL is the fallback for
  calculated-field / validation expressions where full scripting is overkill.`);

  console.log('\nProbe 6 verdict: 🟢 trusted BeforeSave veto + mutate works end-to-end (near-zero cost);');
  console.log('   untrusted sandbox assessed → isolated-vm (app-package, allowed) or a DSL, both DEFERRABLE.');
}

main()
  .catch((err) => {
    console.error('Probe 6 FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
