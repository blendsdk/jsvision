/**
 * Shared harness for the frame-snapshot tests: spawn a headless demo once, then pull individual
 * composed frames out of its stdout by the title it printed above them.
 *
 * The demos that use this all print their render buffer as an ASCII grid framed by `+----+` rulers,
 * so a frame is recoverable from stdout alone — which makes the running demo itself the geometry
 * oracle, with no changes to the demo and no second copy of its view tree living in a test.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

/** The outcome of one demo run: its exit code and everything it wrote to stdout. */
export interface DemoRun {
  readonly code: number | null;
  readonly stdout: string;
  /** Anything the demo wrote to stderr — a crash's stack trace arrives here, not in `stdout`. */
  readonly stderr: string;
}

/**
 * Run `<demoDir>/main.ts` under tsx with no TTY and collect its output.
 *
 * stderr is drained as well as stdout, for two reasons: a child that fills an unread pipe blocks
 * forever and would surface only as a timeout, and when a demo throws, the stack trace it prints is
 * the one piece of information worth having.
 *
 * @param demoDir Directory name of the demo inside the examples package, e.g. `'event-demo'`.
 * @param timeoutMs How long to wait before killing the child and rejecting.
 * @returns The exit code and everything the demo wrote to stdout and stderr.
 */
export async function spawnDemo(demoDir: string, timeoutMs = 15_000): Promise<DemoRun> {
  const mainPath = join(pkgRoot, demoDir, 'main.ts');
  return new Promise<DemoRun>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error(`${demoDir} did not exit in time${stderr === '' ? '' : `; stderr:\n${stderr}`}`));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => (stderr += chunk));
    child.on('error', (err) => {
      clearTimeout(guard);
      rejectPromise(err);
    });
    child.on('close', (code) => {
      clearTimeout(guard);
      resolvePromise({ code, stdout, stderr });
    });
    child.stdin.end();
  });
}

/**
 * Extract one composed frame's rows from a demo's stdout.
 *
 * Several demos print more than one frame, so the frame is located by the exact title line the demo
 * printed above it; the rows are then the `|…|` lines between the two rulers that follow. The pipes
 * are stripped, so each returned string is exactly as wide as the render buffer.
 *
 * @param stdout Everything the demo wrote, as returned by {@link spawnDemo}.
 * @param title The frame's printed title line, matched exactly.
 * @returns The frame's rows, top to bottom, without the enclosing pipes.
 * @throws If no frame follows that title — a silently empty frame would make every row assertion
 * vacuously true.
 *
 * @example
 * ```ts
 * const run = await spawnDemo('event-demo');
 * const rows = frameRows(run.stdout, 'Frame 1 — focus on [OK]');
 * expect(rows[2]).toBe('  > OK                       Open Dialog          ');
 * ```
 */
export function frameRows(stdout: string, title: string): string[] {
  const lines = stdout.split('\n').map((line) => line.replace(/\r$/, ''));
  const start = lines.indexOf(title);
  if (start === -1) throw new Error(`frame title not found in demo output: ${title}`);

  const top = lines.findIndex((line, i) => i > start && /^\+-+\+$/.test(line));
  if (top === -1) throw new Error(`no frame ruler after title: ${title}`);

  const rows: string[] = [];
  for (let i = top + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^\+-+\+$/.test(line)) break;
    if (!line.startsWith('|') || !line.endsWith('|')) {
      throw new Error(`unexpected line inside frame "${title}": ${line}`);
    }
    rows.push(line.slice(1, -1));
  }
  if (rows.length === 0) throw new Error(`frame "${title}" has no rows`);
  return rows;
}
