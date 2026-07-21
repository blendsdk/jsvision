/**
 * The pure view serializer for `@jsvision/datagrid` — it turns a snapshot of the current view (the
 * resolved visible columns plus the filtered/sorted rows) into a CSV, HTML, JSON, or TSV string. Like
 * `sort.ts`/`filter.ts`/`aggregate.ts` it holds no view state and no signals: every function takes plain
 * inputs, so it is directly unit-testable. The grid's `exportView` method gathers the snapshot from its
 * private state and calls {@link serializeView}; nothing here reads a signal or touches a view.
 *
 * Text formats defend two egress boundaries: control bytes are stripped (so app/network data can never
 * inject a terminal or markup sequence), and CSV/TSV cells that would read as a spreadsheet formula are
 * neutralized. The control-byte strip runs BEFORE the formula-escape so a control-byte-masked formula
 * (e.g. an ESC- or CR-prefixed `=cmd`) cannot slip a live payload past the escape.
 */
import { sanitize } from '@jsvision/core';

/**
 * The serialization target for a grid export.
 *
 * - `'csv'` / `'tsv'` — RFC-4180 framing (records joined by CRLF; a field containing the delimiter, a
 *   double-quote, or a newline is double-quoted with embedded quotes doubled), plus spreadsheet
 *   formula-injection escaping.
 * - `'html'` — a standalone document whose `<table>` reproduces the view (every title/cell markup-escaped).
 * - `'json'` — an array of objects with the raw column values keyed by column id.
 *
 * @example
 * ```ts
 * import type { ExportFormat } from '@jsvision/datagrid';
 * const formats: ExportFormat[] = ['csv', 'html', 'json', 'tsv'];
 * ```
 */
export type ExportFormat = 'csv' | 'html' | 'json' | 'tsv';

/**
 * One resolved, exportable column: the display `title`, a formatted-text accessor (`text`, the CSV/HTML/
 * TSV cell string), and the raw value accessor (`raw`, used by JSON only). Internal — the grid builds
 * these from its private column model and hands them to {@link serializeView}.
 */
export interface ExportColumn<T> {
  /** Stable column id — the JSON object key. */
  readonly id: string;
  /** Header cell text. */
  readonly title: string;
  /** The formatted cell string (`format(value(row))`, or `String(value(row))` when unformatted). */
  readonly text: (row: T) => string;
  /** The raw column value (JSON export only — never formula- or CSV-escaped). */
  readonly raw: (row: T) => unknown;
}

/** A leading character that makes a spreadsheet read a cell as a formula (the OWASP CSV-injection set). */
const FORMULA_LEADING = /^[=+\-@\t\r]/;

/**
 * Prefix a `'` to a field that begins with a formula trigger, so a spreadsheet stores it as literal text
 * instead of evaluating it. Runs on already-sanitized text — a leading `\r` cannot survive the sanitize,
 * but a CR-masked formula (`\r=SUM`) reduces to `=SUM` first and is then caught here. Accepted tradeoff: a
 * legitimate negative like `-5` becomes `'-5`.
 */
function formulaEscape(field: string): string {
  return FORMULA_LEADING.test(field) ? `'${field}` : field;
}

/**
 * Serialize one CSV/TSV field: strip control bytes, defuse a leading formula trigger, then RFC-4180 quote
 * (double-quote the field, doubling embedded quotes) when it contains the delimiter, a quote, or a
 * newline. Sanitizing first closes the control-byte-masked-formula bypass.
 */
function delimitedField(text: string, delimiter: string): string {
  const escaped = formulaEscape(sanitize(text));
  const mustQuote =
    escaped.includes(delimiter) || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r');
  return mustQuote ? `"${escaped.replace(/"/g, '""')}"` : escaped;
}

/** Join the header + each row into a delimited document (records CRLF-separated, no trailing CRLF). */
function serializeDelimited<T>(cols: readonly ExportColumn<T>[], rows: readonly T[], delimiter: string): string {
  const header = cols.map((c) => delimitedField(c.title, delimiter)).join(delimiter);
  const body = rows.map((row) => cols.map((c) => delimitedField(c.text(row), delimiter)).join(delimiter));
  return [header, ...body].join('\r\n');
}

/** Escape the five markup-significant characters so exported data can never inject live markup. */
function htmlEscape(text: string): string {
  return sanitize(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Build a standalone HTML document whose `<table>` reproduces the view (titles + rows, all escaped). */
function serializeHtml<T>(cols: readonly ExportColumn<T>[], rows: readonly T[]): string {
  const head = `<thead><tr>${cols.map((c) => `<th>${htmlEscape(c.title)}</th>`).join('')}</tr></thead>`;
  const body = rows
    .map((row) => `<tr>${cols.map((c) => `<td>${htmlEscape(c.text(row))}</td>`).join('')}</tr>`)
    .join('\n');
  return `<!doctype html>\n<meta charset="utf-8">\n<table>\n${head}\n<tbody>\n${body}\n</tbody>\n</table>\n`;
}

/** Serialize the rows as raw values keyed by column id — `JSON.stringify` owns its own string escaping. */
function serializeJson<T>(cols: readonly ExportColumn<T>[], rows: readonly T[]): string {
  const objects = rows.map((row) => {
    const object: Record<string, unknown> = {};
    for (const col of cols) object[col.id] = col.raw(row);
    return object;
  });
  return JSON.stringify(objects, null, 2);
}

/**
 * Serialize a view snapshot to the requested format. Pure: it reads only the passed columns and rows and
 * never touches a signal or a view. CSV/TSV are RFC-4180 with formula-injection escaping; HTML is a
 * standalone escaped document; JSON is raw values keyed by column id. Zero rows yields a header-only
 * document (CSV/HTML/TSV) or `[]` (JSON), never an exception.
 *
 * @param cols The resolved, ordered export columns (visible columns in display order).
 * @param rows The rows to serialize (the filtered + sorted display set) — a real array; a lazy/windowed
 *   view is rejected upstream by the grid before this is called.
 * @param format The target format.
 * @returns The serialized document as a string.
 * @example
 * ```ts
 * import { serializeView } from './export-view.js';
 *
 * // Internal to the package — the grid's exportView() builds `cols` from its column model and calls this.
 * const cols = [
 *   { id: 'id', title: 'ID', text: (r: { id: number }) => String(r.id), raw: (r: { id: number }) => r.id },
 * ];
 * serializeView(cols, [{ id: 1 }, { id: 2 }], 'csv'); // 'ID\r\n1\r\n2'
 * ```
 */
export function serializeView<T>(cols: readonly ExportColumn<T>[], rows: readonly T[], format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return serializeDelimited(cols, rows, ',');
    case 'tsv':
      return serializeDelimited(cols, rows, '\t');
    case 'html':
      return serializeHtml(cols, rows);
    case 'json':
      return serializeJson(cols, rows);
    default: {
      // The `ExportFormat` union makes this unreachable; the exhaustive check surfaces a future format.
      const unreachable: never = format;
      throw new Error(`unsupported export format: ${String(unreachable)}`);
    }
  }
}
