/**
 * Immutable consumer-documentation oracle for translated action geometry and the multilingual
 * demonstration harness.
 *
 * Documentation is executable product surface: examples must name the public Button-group APIs and
 * localized source examples must use those APIs instead of guessed terminal-cell rectangles.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUTTON_PAGE = join(PACKAGE_ROOT, 'components', 'controls', 'button.md');
const LAYOUT_GUIDE = join(PACKAGE_ROOT, 'guide', 'layout.md');
const I18N_GUIDE = join(PACKAGE_ROOT, 'guide', 'i18n.md');
const THEME_PAGE = join(PACKAGE_ROOT, 'components', 'theming', 'i18n-theme-designer.md');
const THEME_EXAMPLE = join(PACKAGE_ROOT, 'examples', 'i18n-theme-designer.ts');
const FIXED_ENGLISH_FORM = join(PACKAGE_ROOT, 'examples', 'controls', 'form-dialog.ts');

/** Read one required authored documentation artifact. */
function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/** Return the executable TypeScript blocks embedded in one Markdown document. */
function typescriptBlocks(markdown: string): readonly string[] {
  return [...markdown.matchAll(/```(?:ts|typescript)\s*\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

describe('translated Button-group documentation', () => {
  // Public docs teach the shared measurement/composition contract through a copyable TypeScript
  // example rather than presenting fixed widths that happen to fit English.
  test('documents the public Button-group API with a runnable translated example', () => {
    const documentation = `${read(BUTTON_PAGE)}\n${read(LAYOUT_GUIDE)}`;
    const example = typescriptBlocks(documentation).find(
      (block) =>
        /\bmeasureButtonGroup\s*\(/u.test(block) &&
        /\bbuttonGroup\s*\(/u.test(block) &&
        /from ['"]@jsvision\/ui['"]/u.test(block),
    );

    expect(example, 'copyable measureButtonGroup/buttonGroup TypeScript example').toBeDefined();
    expect(example).toMatch(/\bnew Button\s*\(/u);
    expect(example).toMatch(/\bminimumButtonWidth\b/u);
    expect(documentation).toMatch(/natural[\s\S]{0,100}(?:translated|caption|label)[\s\S]{0,100}width/iu);
    expect(documentation).toMatch(/widest[\s\S]{0,120}(?:sibling|button|action)/iu);
  });

  // The authored policy distinguishes preferred minima from the terminal's absolute clipping bound
  // and explains every ordering and display-cell invariant an application must preserve.
  test('documents wrapping, vertical composition, display cells, and viewport negotiation', () => {
    const documentation = `${read(BUTTON_PAGE)}\n${read(LAYOUT_GUIDE)}`;
    const requiredSubstance = [
      /equal[\s\S]{0,100}(?:row|sibling)/iu,
      /row-major/iu,
      /maxColumns/u,
      /buttonColumn/u,
      /vertical/iu,
      /viewport[\s\S]{0,120}(?:minimum|negotia|expand|wrap)/iu,
      /hard[\s-]bound|absolute[\s\S]{0,60}(?:bound|clip)/iu,
      /wide[\s\S]{0,100}(?:glyph|character|caption)/iu,
      /combining/iu,
      /accelerator[\s\S]{0,100}(?:exclude|markup|width)/iu,
      /single parent|unattached|one live Button/iu,
    ];
    for (const pattern of requiredSubstance) {
      expect(documentation, `missing translated layout guidance ${pattern}`).toMatch(pattern);
    }
  });
});

describe('multilingual harness documentation', () => {
  // The dedicated command is discoverable with its complete locale/catalog/lifecycle contract and
  // clearly excludes caller-owned content from translation.
  test('documents demo:i18n, all locales, five catalogs, and fresh reconstruction', () => {
    const documentation = `${read(I18N_GUIDE)}\n${read(THEME_PAGE)}`;
    expect(documentation).toContain('yarn workspace @jsvision/examples demo:i18n');
    expect(documentation).toMatch(
      /en[\s,|/]+nl[\s,|/]+de[\s,|/]+fr[\s,|/]+es[\s,|/]+it[\s,|/]+pt-PT[\s,|/]+pl[\s,|/]+ro[\s,|/]+sv/u,
    );
    for (const packageName of ['ui', 'forms', 'files', 'datagrid', 'code-editor']) {
      expect(documentation, `${packageName} catalog`).toContain(`@jsvision/${packageName}/locales/`);
    }
    expect(documentation).toMatch(/typed[\s-]story registry|typed registry/iu);
    expect(documentation).toMatch(/fresh[\s\S]{0,100}I18n[\s\S]{0,100}Application/iu);
    expect(documentation).toMatch(/long[\s\S]{0,80}(?:override|caption)/iu);
    expect(documentation).toMatch(/caller-owned[\s\S]{0,160}(?:not translated|excluded|remain|never translated)/iu);
    expect(documentation).not.toMatch(/(?:setLocale|changeLocale|mutateLocale)\s*\(/u);
  });

  // The localized Theme Designer composes real translated Buttons with one complete-group metric.
  // It includes the Code Editor catalog because the worked app demonstrates five-package composition.
  test('uses shared Button metrics in the localized Theme Designer example', () => {
    const source = read(THEME_EXAMPLE);
    expect(source).toMatch(/from ['"]@jsvision\/code-editor\/locales\/nl['"]/u);
    expect(source).toMatch(/\bButton\b/u);
    expect(source).toMatch(/\bmeasureButtonGroup\s*\(/u);
    expect(source).toMatch(/\bbuttonGroup\s*\(/u);
    expect(source).toMatch(/catalogs:\s*\[[^\]]*codeEditorNl/u);
    expect(source).not.toMatch(/\bat\s*\(\s*(?:okButton|cancelButton)\s*\(/u);
  });

  // Existing English-only visual fixtures intentionally keep their exact historical geometry; the
  // translated-layout sweep must not silently turn them into a different demonstration.
  test('leaves the fixed English form fixture at its historical geometry', () => {
    const source = read(FIXED_ENGLISH_FORM);
    expect(source).not.toMatch(/@jsvision\/i18n|\/locales\//u);
    expect(source).toContain('at(okButton(), 9, 9, 10, 2)');
    expect(source).toContain('at(cancelButton(), 22, 9, 12, 2)');
  });
});
