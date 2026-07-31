/** Implementation coverage for the Apps overview gallery data and rendering contract. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { APP_GALLERY_ENTRIES } from '../src/apps/apps-gallery.js';

const componentPath = fileURLToPath(new URL('../.vitepress/theme/components/AppsGallery.vue', import.meta.url));
const componentSource = readFileSync(componentPath, 'utf8');

describe('Apps gallery implementation', () => {
  test('keeps identifiers, pages, and screenshots unique and locally scoped', () => {
    const identifiers = APP_GALLERY_ENTRIES.map((entry) => entry.exampleId);
    const pages = APP_GALLERY_ENTRIES.map((entry) => entry.page);
    const screenshots = APP_GALLERY_ENTRIES.map((entry) => entry.screenshot);

    expect(new Set(identifiers).size).toBe(8);
    expect(new Set(pages).size).toBe(8);
    expect(new Set(screenshots).size).toBe(8);
    expect(identifiers.every((identifier) => /^apps\/[a-z0-9-]+$/u.test(identifier))).toBe(true);
    expect(pages.every((page) => /^\/apps\/[a-z0-9-]+$/u.test(page))).toBe(true);
    expect(screenshots.every((screenshot) => /^\/apps\/[a-z0-9-]+\.png$/u.test(screenshot))).toBe(true);
  });

  test('renders semantic cards with lazy images and encoded live-example links', () => {
    expect(componentSource).toContain('<article v-for="entry in APP_GALLERY_ENTRIES"');
    expect(componentSource).toContain(':alt="entry.screenshotAlt"');
    expect(componentSource).toContain('loading="lazy"');
    expect(componentSource).toContain('encodeURIComponent(exampleId)');
    expect(componentSource).toContain(':href="liveExampleUrl(entry.page, entry.exampleId)"');
  });
});
