/** Parser diagnostics and Markdown edge coverage for component teaching pages. */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { validateComponentPage } from '../src/components/component-pages.mjs';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUTTON_PATH = 'components/controls/button.md';
let buttonSource = '';

const OPTIONS = {
  filePath: BUTTON_PATH,
  profile: 'standard',
  expectedExamples: ['controls/button'],
  componentSpecificHeadings: ['Keyboard & mouse'],
} as const;

beforeAll(async () => {
  buttonSource = await readFile(join(PACKAGE_ROOT, BUTTON_PATH), 'utf8');
});

describe('component page parser diagnostics', () => {
  test('identifies the source path for malformed frontmatter and missing H1', () => {
    expect(() => validateComponentPage(buttonSource.replace(/^---/, '--'), OPTIONS)).toThrow(
      `${BUTTON_PATH}: missing frontmatter`,
    );
    expect(() => validateComponentPage(buttonSource.replace('# Button', 'Button'), OPTIONS)).toThrow(
      `${BUTTON_PATH}: expected exactly one H1`,
    );
  });

  test('rejects duplicate H1 and unterminated code fences with precise diagnostics', () => {
    expect(() => validateComponentPage(buttonSource.replace('# Button', '# Button\n\n# Duplicate'), OPTIONS)).toThrow(
      'expected exactly one H1, found 2',
    );
    expect(() => validateComponentPage(`${buttonSource}\n\n\`\`\`ts\nconst unfinished = true;`, OPTIONS)).toThrow(
      `${BUTTON_PATH}: unterminated code fence`,
    );
  });

  test('rejects malformed YAML and quoted empty metadata', () => {
    expect(() => validateComponentPage(buttonSource.replace('title: Button', 'title: [Button'), OPTIONS)).toThrow(
      `${BUTTON_PATH}: invalid frontmatter YAML`,
    );
    expect(() => validateComponentPage(buttonSource.replace('title: Button', 'title: ""'), OPTIONS)).toThrow(
      `${BUTTON_PATH}: frontmatter title must be non-empty`,
    );
  });

  test.each([
    ['commented', '<!-- <PlayExample id="controls/button" title="Hidden" blurb="Hidden example." /> -->'],
    ['fenced', '```html\n<PlayExample id="controls/button" title="Hidden" blurb="Hidden example." />\n```'],
  ])('does not count a %s PlayExample as rendered', (_case, hiddenExample) => {
    const source = buttonSource.replace(/<PlayExample\b[\s\S]*?\/>/, hiddenExample);
    expect(() => validateComponentPage(source, OPTIONS)).toThrow(/PlayExample population mismatch/);
  });

  test('does not count a heading hidden in an HTML comment', () => {
    const source = buttonSource.replace('## Related', '<!--\n## Related\n-->');
    expect(() => validateComponentPage(source, OPTIONS)).toThrow(/missing Related section/);
  });
});

describe('component page Markdown scanning', () => {
  test('ignores headings inside code fences', () => {
    const source = buttonSource.replace(
      "import { Button } from '@jsvision/ui';",
      "import { Button } from '@jsvision/ui';\n# This is snippet text, not a page heading",
    );
    const evidence = validateComponentPage(source, OPTIONS);
    expect(evidence.headings).not.toContain('This is snippet text, not a page heading');
  });

  test('creates stable Unicode, punctuation, and duplicate heading anchors', () => {
    const source = buttonSource.replace(
      '## Related',
      '## Café & `Unicode`\n\nExtra teaching detail.\n\n## Café & `Unicode`\n\nRepeated detail.\n\n## Related',
    );
    const evidence = validateComponentPage(source, OPTIONS);
    expect(evidence.anchors).toContain('cafe-unicode');
    expect(evidence.anchors).toContain('cafe-unicode-1');
    expect(evidence.anchors).toContain('keyboard-mouse');
  });
});
