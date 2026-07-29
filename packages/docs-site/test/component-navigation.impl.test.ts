/** Integration coverage for the concrete VitePress component-sidebar configuration. */
import { describe, expect, test } from 'vitest';
import vitepressConfig from '../.vitepress/config.js';

interface SidebarItem {
  readonly text: string;
  readonly link: string;
}

interface SidebarGroup {
  readonly text: string;
  readonly items: readonly SidebarItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSidebarItem(value: unknown): value is SidebarItem {
  return isRecord(value) && typeof value.text === 'string' && typeof value.link === 'string';
}

function isSidebarGroup(value: unknown): value is SidebarGroup {
  return (
    isRecord(value) && typeof value.text === 'string' && Array.isArray(value.items) && value.items.every(isSidebarItem)
  );
}

/** Read and validate the component sidebar map from the real VitePress config. */
function componentSidebars(): Readonly<Record<string, readonly SidebarGroup[]>> {
  const config: unknown = vitepressConfig;
  if (!isRecord(config) || !isRecord(config.themeConfig) || !isRecord(config.themeConfig.sidebar)) {
    throw new TypeError('VitePress config must expose a sidebar map');
  }
  const result: Record<string, readonly SidebarGroup[]> = {};
  for (const [prefix, groups] of Object.entries(config.themeConfig.sidebar)) {
    if (!prefix.startsWith('/components/')) continue;
    if (!Array.isArray(groups) || !groups.every(isSidebarGroup)) {
      throw new TypeError(`${prefix} must contain sidebar groups`);
    }
    result[prefix] = groups;
  }
  return result;
}

/** Resolve a route with VitePress's most-specific-prefix sidebar rule. */
function sidebarPrefixForRoute(route: string, sidebars: Readonly<Record<string, unknown>>): string | undefined {
  return Object.keys(sidebars)
    .filter((prefix) => route.startsWith(prefix))
    .sort((left, right) => right.length - left.length)[0];
}

describe('component sidebar integration', () => {
  test.each([
    ['/components/controls/button', '/components/'],
    ['/components/data-grid/sorting-and-filtering', '/components/data-grid/'],
    ['/components/code-editor/language-intelligence', '/components/code-editor/'],
  ])('resolves %s through the most specific prefix', (route, expectedPrefix) => {
    expect(sidebarPrefixForRoute(route, componentSidebars())).toBe(expectedPrefix);
  });

  test('contains no duplicate link or label inside any concrete sidebar', () => {
    for (const [prefix, groups] of Object.entries(componentSidebars())) {
      const items = groups.flatMap((group) => group.items);
      expect(new Set(items.map((item) => item.link)).size, `${prefix}: duplicate link`).toBe(items.length);
      for (const group of groups) {
        expect(new Set(group.items.map((item) => item.text)).size, `${prefix}/${group.text}: duplicate label`).toBe(
          group.items.length,
        );
      }
    }
  });
});
