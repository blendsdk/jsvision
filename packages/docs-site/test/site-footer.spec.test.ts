import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const CONFIG_PATH = fileURLToPath(new URL('../.vitepress/config.ts', import.meta.url));
const THEME_CSS_PATH = fileURLToPath(new URL('../.vitepress/theme/custom.css', import.meta.url));

describe('documentation site footer', () => {
  test('links the BlendSDK copyright holder to the repository', async () => {
    const config = await readFile(CONFIG_PATH, 'utf8');

    expect(config).toContain('copyright: `Copyright © 2026 <a href="${GITHUB_URL}">BlendSDK</a>`');
  });

  test('keeps the footer visible on pages with sidebars', async () => {
    const themeCss = await readFile(THEME_CSS_PATH, 'utf8');

    expect(themeCss).toMatch(/\.Layout\s+\.VPFooter\.has-sidebar\s*\{[^}]*display:\s*block;/u);
  });
});
