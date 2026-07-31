/**
 * Specification tests for the Apps overview showcase.
 *
 * The overview must present every shipped application as a visual, runnable destination. It also
 * needs a clear starting point for newcomers and routes for readers interested in productivity or
 * custom rendering, without retaining claims about examples that do not exist.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const overviewPath = fileURLToPath(new URL('../apps/index.md', import.meta.url));
const screenshotRoot = fileURLToPath(new URL('../public/apps', import.meta.url));
const overview = readFileSync(overviewPath, 'utf8');

const applications = [
  { slug: 'hello', screenshot: 'hello.png' },
  { slug: 'calculator', screenshot: 'calculator.png' },
  { slug: 'editor', screenshot: 'editor.png' },
  { slug: 'desktop', screenshot: 'desktop.png' },
  { slug: 'life', screenshot: 'life.png' },
  { slug: 'amiga-clock', screenshot: 'amiga-clock.png' },
  { slug: 'matrix', screenshot: 'matrix.png' },
  { slug: 'effects', screenshot: 'effects.png' },
] as const;

describe('Apps overview', () => {
  test('presents the shipped app collection instead of future placeholder claims', () => {
    // The page describes the eight runnable applications that are available today.
    expect(overview).not.toContain('Placeholder');
    expect(overview).not.toContain('todo app');
    expect(overview).not.toContain('file browser');
    expect(overview).toContain('eight complete JSVision applications');
    expect(overview).toContain('<AppsGallery />');
  });

  test('features a live flagship and gives readers task-oriented paths forward', () => {
    // Visitors can immediately run the flagship or choose a sequence that matches their goal.
    expect(overview).toContain('<PlayExample id="apps/desktop"');
    expect(overview).toContain('## Choose your path');
    expect(overview).toContain('Learning JSVision');
    expect(overview).toContain('Building productivity tools');
    expect(overview).toContain('Custom rendering and animation');
    expect(overview).toContain('/guide/complete-application');
  });

  test.each(applications)(
    'provides the $slug page and screenshot used by its showcase card',
    ({ slug, screenshot }) => {
      // Every card has both a real detail destination and a local, deployable visual preview.
      expect(existsSync(`${packageRoot}/apps/${slug}.md`)).toBe(true);
      expect(existsSync(`${screenshotRoot}/${screenshot}`)).toBe(true);
    },
  );
});
