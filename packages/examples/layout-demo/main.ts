/**
 * Layout engine walkthrough (RD-02) — a narrated console demo of `@jsvision/ui`'s
 * cell-native flex layout.
 *
 * Run it (works anywhere, no TTY needed — the layout engine is UI-independent):
 *
 *   yarn workspace @jsvision/examples demo:layout
 *
 * It steps through integer-exact `fr` apportionment, `auto` content sizing,
 * `gap`/`padding`, `justify`/`align`, overflow, and a nested app-shell tree —
 * printing the computed rects and rendering them as ASCII so you can *see* a
 * `LayoutBox` tree become integer rectangles that fill their container exactly.
 *
 * It also shows the one thing the result map does NOT give you directly: rects
 * are **parent-relative**, so a renderer composes absolute screen coordinates by
 * summing ancestor origins (the `absoluteRects` walk below).
 *
 * Dev-only example — not part of the published package. The package is imported
 * by name (`@jsvision/ui`), exactly as a consumer would.
 */
import { layout, type LayoutBox, type LayoutProps, type LayoutResult, type Rect, type Size2D } from '@jsvision/ui';

/** Human-readable labels for boxes, used by the ASCII renderer and rect tables. */
const labels = new Map<LayoutBox, string>();

/** Build a labelled {@link LayoutBox} and remember its label for printing. */
function box(label: string, props: LayoutProps, children: LayoutBox[] = [], measure?: LayoutBox['measure']): LayoutBox {
  const node: LayoutBox = measure ? { props, children, measure } : { props, children };
  labels.set(node, label);
  return node;
}

/** Print a section header. */
function section(title: string): void {
  console.log(`\n${'─'.repeat(64)}\n  ${title}\n${'─'.repeat(64)}`);
}

/** Format a rect compactly. */
function fmt(rect: Rect | undefined): string {
  if (!rect) return '(none)';
  return `x:${rect.x} y:${rect.y} w:${rect.width} h:${rect.height}`;
}

/** Print every box's parent-relative rect, in tree order. */
function printRects(root: LayoutBox, result: LayoutResult): void {
  const walk = (node: LayoutBox, depth: number): void => {
    const label = labels.get(node) ?? '?';
    console.log(`   ${'  '.repeat(depth)}${label.padEnd(12 - depth * 2)} ${fmt(result.get(node))}`);
    node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(root, 0);
}

/**
 * Compose absolute rects from the parent-relative result by summing ancestor
 * origins — exactly what a renderer does before painting. This is the bridge
 * from `layout()`'s output to screen coordinates.
 */
function absoluteRects(root: LayoutBox, result: LayoutResult): Map<LayoutBox, Rect> {
  const absolute = new Map<LayoutBox, Rect>();
  const walk = (node: LayoutBox, originX: number, originY: number): void => {
    const local = result.get(node);
    if (!local) return;
    const x = originX + local.x;
    const y = originY + local.y;
    absolute.set(node, { x, y, width: local.width, height: local.height });
    node.children.forEach((child) => walk(child, x, y));
  };
  walk(root, 0, 0);
  return absolute;
}

/**
 * Render the laid-out tree as ASCII: each box fills its absolute rect with a
 * distinct character, drawn parent-first so children visibly partition their
 * parent. Returns the grid plus a legend mapping characters to boxes.
 */
function renderAscii(root: LayoutBox, result: LayoutResult, viewport: Size2D): string {
  const absolute = absoluteRects(root, result);
  const grid: string[][] = Array.from({ length: viewport.height }, () => new Array<string>(viewport.width).fill('.'));
  const glyphs = '#%@=+*ABCDEFGH';
  const order: LayoutBox[] = [];
  const collect = (node: LayoutBox): void => {
    order.push(node);
    node.children.forEach(collect);
  };
  collect(root);

  const legend: string[] = [];
  order.forEach((node, index) => {
    const rect = absolute.get(node);
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const glyph = glyphs[index % glyphs.length];
    for (let j = 0; j < rect.height; j += 1) {
      for (let i = 0; i < rect.width; i += 1) {
        const gx = rect.x + i;
        const gy = rect.y + j;
        if (gy >= 0 && gy < viewport.height && gx >= 0 && gx < viewport.width) grid[gy][gx] = glyph;
      }
    }
    legend.push(`   '${glyph}' ${(labels.get(node) ?? '?').padEnd(10)} ${fmt(rect)}`);
  });

  const picture = grid.map((row) => `   ${row.join('')}`).join('\n');
  return `${picture}\n\n   legend (absolute rects):\n${legend.join('\n')}`;
}

// 1 — Integer-exact fr apportionment --------------------------------------------
section('1. fr children fill the container EXACTLY — no 1-cell gap or overlap');
{
  const a = box('fixed(3)', { size: { kind: 'fixed', cells: 3 } });
  const b = box('fr(1)', { size: { kind: 'fr', weight: 1 } });
  const c = box('fr(1)', { size: { kind: 'fr', weight: 1 } });
  const root = box('row', { direction: 'row' }, [a, b, c]);
  const result = layout(root, { width: 80, height: 1 });
  printRects(root, result);
  const widths = [a, b, c].map((n) => result.get(n)?.width ?? 0);
  console.log(`   widths = [${widths.join(', ')}]  sum = ${widths.reduce((s, w) => s + w, 0)} (== content width 80)`);
}

// 2 — auto content sizing + gap -------------------------------------------------
section('2. auto sizes to content; gap sits BETWEEN children only');
{
  // A label-like leaf reports its own size via measure(); the engine never sees a widget.
  const label = box('label', { size: { kind: 'auto' } }, [], () => ({ width: 11, height: 1 }));
  const badge = box('badge', { size: { kind: 'fixed', cells: 3 } });
  const bar = box('auto-row', { direction: 'row', size: { kind: 'auto' }, gap: 2 }, [label, badge]);
  const root = box('root', { direction: 'row' }, [bar]);
  const result = layout(root, { width: 40, height: 1 });
  printRects(root, result);
  console.log(`   auto-row natural width = ${result.get(bar)?.width} (11 + gap 2 + 3)`);
}

// 3 — justify + align on a single child -----------------------------------------
section('3. justify places leftover main space; align places the cross axis');
{
  for (const justify of ['start', 'center', 'end'] as const) {
    const child = box('child', { size: { kind: 'fixed', cells: 4 } });
    const root = box('row', { direction: 'row', justify }, [child]);
    const x = layout(root, { width: 12, height: 1 }).get(child)?.x;
    console.log(`   justify:${justify.padEnd(6)} → child x = ${x}`);
  }
}

// 4 — overflow: fixed extends past the edge, fr collapses to 0 -------------------
section('4. overflow — fixed/auto extend past the edge; fr clamps to 0 (no shrink)');
{
  const a = box('fixed(4)', { size: { kind: 'fixed', cells: 4 } });
  const b = box('fixed(4)', { size: { kind: 'fixed', cells: 4 } });
  const c = box('fr(1)', { size: { kind: 'fr', weight: 1 } });
  const root = box('row(w=6)', { direction: 'row' }, [a, b, c]);
  const result = layout(root, { width: 6, height: 1 });
  printRects(root, result);
  console.log('   second fixed extends past the 6-cell edge; the fr child gets width 0');
}

// 5 — a nested app shell, rendered ----------------------------------------------
section('5. a nested app shell — col[header, row[sidebar, content], footer]');
{
  const viewport: Size2D = { width: 48, height: 12 };
  const sidebar = box('sidebar', { size: { kind: 'fixed', cells: 12 } });
  const content = box('content', { size: { kind: 'fr', weight: 1 }, padding: 1 }, [
    box('panel', { size: { kind: 'fr', weight: 1 } }),
  ]);
  const middle = box('middle', { direction: 'row', size: { kind: 'fr', weight: 1 }, gap: 1 }, [sidebar, content]);
  const header = box('header', { size: { kind: 'fixed', cells: 1 } });
  const footer = box('footer', { size: { kind: 'fixed', cells: 1 } });
  const root = box('app', { direction: 'col' }, [header, middle, footer]);

  const result = layout(root, viewport);
  console.log('   parent-relative rects (what layout() returns):');
  printRects(root, result);
  console.log('\n   composed to absolute + rendered:');
  console.log(renderAscii(root, result, viewport));
}

console.log('\n   Done — every rect is an integer; the partition fills the viewport exactly.\n');
