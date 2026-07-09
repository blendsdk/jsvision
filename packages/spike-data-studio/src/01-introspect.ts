/**
 * Probe 1 runner — introspect every object in schema `app` (incl. the view, the no-PK table, and the
 * composite-PK table) and print a TableMeta dump plus a consolidated type→editor verdict table.
 */
import { pool } from './db.js';
import { introspect, listRelations } from './introspect.js';
import type { EditorVerdict, TableMeta } from './introspect.js';

function relKindName(k: string): string {
  return { r: 'table', v: 'view', m: 'matview', p: 'partitioned' }[k] ?? k;
}

function dumpTable(m: TableMeta): void {
  const pk = m.primaryKey.length ? m.primaryKey.join(', ') : '(none)';
  console.log(`\n■ ${m.schema}.${m.name}  [${relKindName(m.relKind)}]  updatable=${m.updatable}  PK: ${pk}`);
  for (const c of m.columns) {
    const flags = [
      c.notNull ? 'NOT NULL' : 'nullable',
      c.generated === 's' ? 'GENERATED' : null,
      c.identity ? `identity(${c.identity})` : null,
      c.enumValues ? `enum{${c.enumValues.join('|')}}` : null,
      c.defaultExpr ? `def=${c.defaultExpr}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    console.log(
      `   ${c.name.padEnd(14)} ${c.pgType.padEnd(20)} → ${c.editor.padEnd(14)} [${c.editorVerdict}]  ${flags}`,
    );
  }
  if (m.foreignKeys.length) {
    for (const fk of m.foreignKeys) {
      console.log(`   FK ${fk.columns.join(',')} → ${fk.refTable}(${fk.refColumns.join(',')})`);
    }
  }
  if (m.checks.length) {
    for (const ck of m.checks) console.log(`   CHECK ${ck.name}: ${ck.expr}`);
  }
}

async function main(): Promise<void> {
  console.log('=== Probe 1: introspection & type mapping ===');
  const rels = await listRelations('app');
  console.log('objects in app:', rels.map((r) => `${r.name}(${relKindName(r.relKind)})`).join(', '));

  const metas: TableMeta[] = [];
  for (const r of rels) metas.push(await introspect('app', r.name));
  for (const m of metas) dumpTable(m);

  // Consolidated type→editor verdict table across every distinct PG type in the seed.
  console.log('\n=== TYPE → EDITOR verdict (distinct types across the seed) ===');
  const seen = new Map<string, { editor: string; verdict: EditorVerdict; sample: string }>();
  for (const m of metas) {
    for (const c of m.columns) {
      const key = c.pgType;
      if (!seen.has(key)) seen.set(key, { editor: c.editor, verdict: c.editorVerdict, sample: `${m.name}.${c.name}` });
    }
  }
  const rows = [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log('  ' + 'PG type'.padEnd(22) + 'editor'.padEnd(16) + 'verdict'.padEnd(12) + 'sample column');
  for (const [pgType, v] of rows) {
    console.log('  ' + pgType.padEnd(22) + v.editor.padEnd(16) + v.verdict.padEnd(12) + v.sample);
  }

  const counts = rows.reduce(
    (acc, [, v]) => ((acc[v.verdict] = (acc[v.verdict] ?? 0) + 1), acc),
    {} as Record<string, number>,
  );
  console.log('\nverdict tally:', JSON.stringify(counts));
  console.log('\nWhat the catalog canNOT tell us: intended display labels for FK values (needs a lookup');
  console.log('  query per FK), human field captions/help, business validation beyond CHECK, and the');
  console.log('  semantic meaning of jsonb/array contents (only that they are json/array).');
}

main()
  .catch((err) => {
    console.error('Probe 1 FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
