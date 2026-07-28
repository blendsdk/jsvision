/**
 * Immutable canonical-skill oracle for translated layout and the multilingual QA workflow.
 *
 * The canonical skill is a supported SDK surface. It must teach the same public Button-group and
 * reconstruction contracts as the consumer docs, and source-impact routing must keep every mapped
 * reference under review.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { checkTreesEqual } from '../../../scripts/check-plugin.mjs';
import { readImpactRegistry } from '../../../scripts/plugin-impact.mjs';

const SKILL_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = join(SKILL_ROOT, '..', '..');
const DISTRIBUTED_ROOT = join(REPOSITORY_ROOT, 'plugins', 'jsvision-plugin', 'skills', 'jsvision');

/** Read one canonical skill reference. */
function reference(path: string): string {
  return readFileSync(join(SKILL_ROOT, 'references', path), 'utf8');
}

/** Whether one configured source directory includes the complete target directory. */
function mapsSource(configuredPaths: readonly string[], target: string): boolean {
  return configuredPaths.some((configured) => target === configured || target.startsWith(`${configured}/`));
}

describe('canonical translated layout guidance', () => {
  // Layout guidance names the public measurement and composition APIs and explains the invariants
  // that make translated actions safe across rows, columns, and constrained terminal viewports.
  test('teaches the complete public Button-group and viewport contract', () => {
    const layout = reference('layout.md');
    const requiredSubstance = [
      /measureButtonGroup/u,
      /buttonGroup/u,
      /buttonColumn/u,
      /minimumButtonWidth/u,
      /natural[\s\S]{0,100}(?:caption|label|width)/iu,
      /equal[\s\S]{0,100}(?:sibling|row|button)/iu,
      /row-major/iu,
      /viewport[\s\S]{0,120}(?:minimum|wrap|expand|negotia)/iu,
      /hard[\s-]bound|absolute[\s\S]{0,60}(?:bound|clip)/iu,
      /wide/iu,
      /combining/iu,
      /accelerator/iu,
      /single parent|unattached|one live Button/iu,
    ];
    for (const pattern of requiredSubstance) {
      expect(layout, `missing canonical layout guidance ${pattern}`).toMatch(pattern);
    }
  });

  // Both high-use dialog recipes compose the complete action set from real Buttons. The translated
  // recipe may configure a historical minimum, but it never assigns guessed widths per caption.
  test.each(['recipes/forms-dialogs.md', 'recipes/theme-designer.md'])('uses shared Button metrics in %s', (path) => {
    const recipe = reference(path);
    expect(recipe).toMatch(/\bmeasureButtonGroup\s*\(/u);
    expect(recipe).toMatch(/\bbuttonGroup\s*\(|\bbuttonColumn\s*\(/u);
    expect(recipe).toMatch(/\bminimumButtonWidth\b/u);
    expect(recipe).not.toMatch(/fixed\s*\(\s*(?:okButton|cancelButton)\s*\([^)]*\)\s*,\s*\d+/u);
  });
});

describe('canonical multilingual harness guidance', () => {
  // Agent-facing guidance exposes the dedicated command, all official locale IDs, fresh
  // reconstruction, five-package composition, stress overrides, and the caller-data boundary.
  test('documents the demo command and complete reconstruction contract', () => {
    const guidance = `${reference('i18n.md')}\n${reference('running-and-testing.md')}`;
    expect(guidance).toContain('yarn workspace @jsvision/examples demo:i18n');
    expect(guidance).toMatch(
      /en[\s,|/]+nl[\s,|/]+de[\s,|/]+fr[\s,|/]+es[\s,|/]+it[\s,|/]+pt-PT[\s,|/]+pl[\s,|/]+ro[\s,|/]+sv/u,
    );
    expect(guidance).toMatch(/typed[\s-]story registry|typed registry/iu);
    expect(guidance).toMatch(/fresh[\s\S]{0,100}I18n[\s\S]{0,100}Application/iu);
    for (const packageName of ['ui', 'forms', 'files', 'datagrid', 'code-editor']) {
      expect(guidance, `${packageName} catalog`).toContain(`@jsvision/${packageName}/locales/`);
    }
    expect(guidance).toMatch(/long[\s\S]{0,80}(?:override|caption)/iu);
    expect(guidance).toMatch(/caller-owned[\s\S]{0,160}(?:not translated|excluded|remain|never translated)/iu);
    expect(guidance).not.toMatch(/(?:setLocale|changeLocale|mutateLocale)\s*\(/u);
  });

  // Source-impact routing covers every canonical reference affected by translated sizing and the
  // dedicated demonstration, including generated API lookup pages.
  test('maps translated implementation and demo seams to all affected references', () => {
    const registry = readImpactRegistry() as {
      readonly areas: readonly {
        readonly name: string;
        readonly paths: readonly string[];
        readonly references: readonly string[];
      }[];
    };
    const area = registry.areas.find((candidate) => candidate.name === 'internationalization');
    expect(area).toBeDefined();
    for (const target of [
      'packages/ui/src/controls',
      'packages/ui/src/dialog',
      'packages/ui/src/editor',
      'packages/ui/src/date',
      'packages/forms/src',
      'packages/files/src',
      'packages/datagrid/src',
      'packages/code-editor/src',
      'packages/examples/i18n-demo',
    ]) {
      expect(mapsSource(area?.paths ?? [], target), `source-impact coverage for ${target}`).toBe(true);
    }
    expect(area?.references).toEqual(
      expect.arrayContaining([
        'references/layout.md',
        'references/i18n.md',
        'references/running-and-testing.md',
        'references/recipes/forms-dialogs.md',
        'references/recipes/theme-designer.md',
        'references/api/controls.md',
        'references/api/forms.md',
        'references/api/files.md',
        'references/api/datagrid.md',
        'references/api/code-editor.md',
      ]),
    );
  });

  // The assembled plugin is generated from the canonical skill; byte parity makes the canonical
  // assertions above apply to the distributed guidance without duplicating its content in tests.
  test('keeps generated guidance byte-identical to the canonical skill', () => {
    expect(checkTreesEqual(SKILL_ROOT, DISTRIBUTED_ROOT)).toEqual([]);
  });
});
