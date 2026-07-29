/**
 * Parse and validate component teaching pages without depending on VitePress internals.
 */
import { load as loadYaml } from 'js-yaml';

const PROFILE_NAMES = new Set(['standard', 'landing', 'capability', 'api']);
const INTERNAL_IMPORT = /\bfrom\s+['"](?:\.{1,2}\/|\/|[^'"]*\/src\/)[^'"]*['"]/;
const FULL_EXAMPLE = /\b(?:defineExample|demoApp|demoShell)\b/;
const VITEPRESS_CONTROL = /[\u0000-\u001f]/g;
const VITEPRESS_SPECIAL = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g;
const VITEPRESS_COMBINING = /[\u0300-\u036f]/g;
const MIN_SECTION_CHARACTERS = 30;

function fail(filePath, message) {
  throw new TypeError(`${filePath}: ${message}`);
}

function normalizeHeading(value) {
  return value
    .trim()
    .replace(/\s+#+\s*$/, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ');
}

function headingAnchors(headings) {
  const counts = new Map();
  return headings.map((heading) => {
    const base =
      heading.text
        .replace(/`([^`]+)`/g, '$1')
        .normalize('NFKD')
        .replace(VITEPRESS_COMBINING, '')
        .replace(VITEPRESS_CONTROL, '')
        .replace(VITEPRESS_SPECIAL, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/^(\d)/, '_$1')
        .toLocaleLowerCase('en-US') || 'section';
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  });
}

function parseFrontmatter(source, filePath) {
  if (!source.startsWith('---\n')) fail(filePath, 'missing frontmatter');
  const end = source.indexOf('\n---\n', 4);
  if (end < 0) fail(filePath, 'unterminated frontmatter');
  const block = source.slice(4, end);
  let values;
  try {
    values = loadYaml(block);
  } catch (error) {
    fail(filePath, `invalid frontmatter YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    fail(filePath, 'frontmatter must be a mapping');
  }
  const title = Reflect.get(values, 'title');
  const description = Reflect.get(values, 'description');
  if (typeof title !== 'string' || title.trim() === '') fail(filePath, 'frontmatter title must be non-empty');
  if (typeof description !== 'string' || description.trim() === '') {
    fail(filePath, 'frontmatter description must be non-empty');
  }
  return { title: title.trim(), description: description.trim(), body: source.slice(end + 5) };
}

function maskMarkdown(value) {
  return value.replace(/[^\n]/g, ' ');
}

function scanMarkdown(body) {
  const headings = [];
  const snippets = [];
  const visibleLines = [];
  let fence = null;
  let snippet = [];
  let cursor = 0;
  const scannable = body.replace(/<!--[\s\S]*?-->/g, maskMarkdown);
  for (const lineWithEnding of scannable.match(/[^\n]*(?:\n|$)/g) ?? []) {
    if (lineWithEnding === '') continue;
    const line = lineWithEnding.endsWith('\n') ? lineWithEnding.slice(0, -1) : lineWithEnding;
    const marker = /^(`{3,}|~{3,})(.*)$/.exec(line.trimStart());
    if (marker) {
      if (fence === null) {
        fence = {
          marker: marker[1][0],
          length: marker[1].length,
          language: marker[2].trim(),
          start: cursor,
        };
        snippet = [];
      } else if (marker[1][0] === fence.marker && marker[1].length >= fence.length) {
        if (/^(?:ts|typescript)$/.test(fence.language)) {
          snippets.push({ code: snippet.join('\n'), start: fence.start, end: cursor + line.length });
        }
        fence = null;
      } else if (fence !== null) {
        snippet.push(line);
      }
      visibleLines.push(maskMarkdown(lineWithEnding));
      cursor += lineWithEnding.length;
      continue;
    }
    if (fence !== null) {
      snippet.push(line);
      visibleLines.push(maskMarkdown(lineWithEnding));
      cursor += lineWithEnding.length;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      headings.push({
        level: heading[1].length,
        text: heading[2],
        start: cursor,
        contentStart: cursor + lineWithEnding.length,
      });
    }
    visibleLines.push(lineWithEnding);
    cursor += lineWithEnding.length;
  }
  if (fence !== null) throw new TypeError('unterminated code fence');
  const visible = visibleLines.join('');
  return { headings, snippets, visible };
}

function playExamples(visible, filePath) {
  const plays = [...visible.matchAll(/<PlayExample\b([\s\S]*?)\/>/g)].map((match) => {
    const attributes = match[1];
    const read = (name) => new RegExp(`\\b${name}="([^"]+)"`).exec(attributes)?.[1] ?? '';
    const id = read('id');
    if (!id || !read('title') || !read('blurb')) {
      fail(filePath, 'PlayExample requires non-empty id, title, and blurb');
    }
    return { id, start: match.index, end: match.index + match[0].length };
  });
  if (new Set(plays.map((play) => play.id)).size !== plays.length) fail(filePath, 'duplicate PlayExample id');
  return plays;
}

function markdownLinks(visible) {
  return [...visible.matchAll(/\[[^\]]+\]\((\/[^)\s]+)\)/g)].map((match) => match[1]);
}

function requireHeading(headings, patterns, filePath, label) {
  const normalized = headings.map(normalizeHeading);
  if (!patterns.some((pattern) => normalized.some((heading) => pattern.test(heading)))) {
    fail(filePath, `missing ${label} section`);
  }
}

function exactPopulation(actual, expected, filePath) {
  const sortedActual = actual.map((play) => play.id).sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
    fail(filePath, `PlayExample population mismatch; expected ${sortedExpected.join(', ')}`);
  }
}

function validateSnippets(snippets, filePath, required) {
  if (required && snippets.length === 0) fail(filePath, 'missing focused TypeScript snippet');
  for (const snippet of snippets) {
    if (INTERNAL_IMPORT.test(snippet.code)) fail(filePath, 'snippets must import a public package entry');
    if (FULL_EXAMPLE.test(snippet.code)) fail(filePath, 'focused snippet cannot contain full example shell plumbing');
    const imports = [...snippet.code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    if (imports.length === 0 || imports.some((specifier) => !specifier.startsWith('@jsvision/'))) {
      fail(filePath, 'snippets must import a public package entry');
    }
  }
}

function sectionRange(headings, expected) {
  const index = headings.findIndex(
    (heading) => heading.level === 2 && normalizeHeading(heading.text) === normalizeHeading(expected),
  );
  if (index < 0) return undefined;
  const heading = headings[index];
  const next = headings.slice(index + 1).find((candidate) => candidate.level <= 2);
  return { start: heading.start, contentStart: heading.contentStart, end: next?.start ?? Number.POSITIVE_INFINITY };
}

function sectionText(visible, range) {
  return visible.slice(range.contentStart, Number.isFinite(range.end) ? range.end : undefined);
}

function requireSubstantiveSection(visible, range, filePath, label) {
  const teachingText = sectionText(visible, range)
    .replace(/<PlayExample\b[\s\S]*?\/>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[`#*|:[\]()-]/g, '')
    .replace(/\s+/g, '');
  if (teachingText.length < MIN_SECTION_CHARACTERS) fail(filePath, `${label} section is not substantive`);
}

function validateExpectedContent(source, options, sections, links) {
  const props = sections.get('props');
  const theming = sections.get('theming');
  for (const symbol of options.requiredPublicSymbols ?? []) {
    if (props === undefined || !sectionText(source, props).includes(symbol)) {
      fail(options.filePath, `Props/public state must name ${symbol}`);
    }
  }
  for (const role of options.requiredThemeRoles ?? []) {
    if (theming === undefined || !sectionText(source, theming).includes(`\`${role}\``)) {
      fail(options.filePath, `Theming must name ${role}`);
    }
  }
  if (options.validLinks !== undefined) {
    const allowed = new Set(options.validLinks);
    const invalid = links.find((link) => !allowed.has(link));
    if (invalid !== undefined) fail(options.filePath, `invalid related/API link ${invalid}`);
  }
}

function validateStandard(scanned, plays, options) {
  const { headings, visible, snippets } = scanned;
  const h2 = headings.filter((heading) => heading.level === 2).map((heading) => heading.text);
  requireHeading(h2, [/^usage$/], options.filePath, 'Usage');
  requireHeading(h2, [/^live example$/], options.filePath, 'Live example');
  requireHeading(h2, [/^props(?: and public state)?$/], options.filePath, 'Props/public state');
  requireHeading(h2, [/^siz(?:e|ing) and layout$/], options.filePath, 'Size and Layout');
  requireHeading(h2, [/^best practices$/], options.filePath, 'Best Practices');
  requireHeading(h2, [/^theming$/], options.filePath, 'Theming');
  requireHeading(h2, [/^related$/], options.filePath, 'Related');
  const requiredSpecific = options.componentSpecificHeadings ?? [];
  if (
    requiredSpecific.length === 0 ||
    !requiredSpecific.every((expected) => h2.some((actual) => normalizeHeading(actual) === normalizeHeading(expected)))
  ) {
    fail(options.filePath, 'missing component-specific section');
  }
  const sectionNames = [
    ['usage', 'Usage'],
    ['props', h2.find((heading) => /^props(?: and public state)?$/.test(normalizeHeading(heading)))],
    ['sizing', h2.find((heading) => /^siz(?:e|ing) and layout$/.test(normalizeHeading(heading)))],
    ['best-practices', 'Best Practices'],
    ['theming', 'Theming'],
    ['related', 'Related'],
  ];
  const sections = new Map();
  for (const [key, heading] of sectionNames) {
    if (heading === undefined) continue;
    const range = sectionRange(headings, heading);
    if (range !== undefined) {
      sections.set(key, range);
      if (key !== 'usage') requireSubstantiveSection(visible, range, options.filePath, heading);
    }
  }
  for (const heading of requiredSpecific) {
    const range = sectionRange(headings, heading);
    if (range !== undefined) requireSubstantiveSection(visible, range, options.filePath, heading);
  }
  const usage = sections.get('usage');
  const flagship = plays[0];
  const quickSnippet =
    usage === undefined ? undefined : snippets.find((item) => item.start >= usage.start && item.end <= usage.end);
  if (usage === undefined || flagship === undefined || usage.start >= flagship.start || quickSnippet === undefined) {
    fail(options.filePath, 'focused public-entry Usage must precede the flagship example');
  }
  return sections;
}

function validateProfile(scanned, plays, profile, filePath) {
  const { headings, visible, snippets } = scanned;
  const h2 = headings.filter((heading) => heading.level === 2).map((heading) => heading.text);
  const rules = {
    landing: [
      [/^quick start$/, 'Quick start'],
      [/^capability map$/, 'Capability map'],
      [/^cross-cutting practices$/, 'cross-cutting practices'],
      [/^related$/, 'Related'],
    ],
    capability: [
      [/^focused usage$/, 'focused usage'],
      [/^(?:limits and practices|practices and limits)$/, 'practices/limits'],
      [/^related$/, 'Related'],
    ],
    api: [
      [/^visual surfaces$/, 'visual surfaces'],
      [/^ownership boundaries$/, 'ownership boundaries'],
      [/^related$/, 'Related'],
    ],
  };
  for (const [pattern, label] of rules[profile]) {
    requireHeading(h2, [pattern], filePath, label);
    const heading = h2.find((candidate) => pattern.test(normalizeHeading(candidate)));
    const range = heading === undefined ? undefined : sectionRange(headings, heading);
    if (range !== undefined && !['Quick start', 'focused usage'].includes(label)) {
      requireSubstantiveSection(visible, range, filePath, label);
    }
  }
  if (profile === 'landing') {
    const quickStart = sectionRange(headings, 'Quick start');
    const capabilityMap = sectionRange(headings, 'Capability map');
    const quickSnippet = snippets.find(
      (item) => quickStart !== undefined && item.start >= quickStart.start && item.end <= quickStart.end,
    );
    if (
      quickStart === undefined ||
      capabilityMap === undefined ||
      plays[0] === undefined ||
      quickSnippet === undefined ||
      plays[0].start <= quickStart.start ||
      plays[0].start >= capabilityMap.start
    ) {
      fail(filePath, 'landing quick start and flagship example must precede the capability map');
    }
  }
  if (profile === 'capability') {
    const backbone = new Set(['focused usage', 'limits and practices', 'practices and limits', 'related']);
    const capabilityRanges = headings
      .filter((heading) => heading.level === 2 && !backbone.has(normalizeHeading(heading.text)))
      .map((heading) => ({ heading: heading.text, range: sectionRange(headings, heading.text) }))
      .filter((item) => item.range !== undefined);
    if (capabilityRanges.length === 0) fail(filePath, 'capability profile requires a capability section');
    for (const capability of capabilityRanges) {
      requireSubstantiveSection(visible, capability.range, filePath, capability.heading);
    }
    if (
      !plays.every((play) => capabilityRanges.some(({ range }) => play.start >= range.start && play.end <= range.end))
    ) {
      fail(filePath, 'each capability example must appear beside the capability it teaches');
    }
  }
}

/**
 * Validate a Markdown component page and return immutable structural evidence.
 *
 * @param {string} source Markdown source.
 * @param {{filePath: string, profile: 'standard'|'landing'|'capability'|'api',
 * expectedExamples: readonly string[], componentSpecificHeadings?: readonly string[]}} options
 * Expected page profile and staged example population.
 * @returns {{title: string, description: string, h1: string, headings: readonly string[],
 * anchors: readonly string[], exampleIds: readonly string[], snippetCount: number,
 * relatedLinks: readonly string[]}}
 * Parsed evidence for higher-level catalog checks.
 * @throws {TypeError} When the page violates its selected teaching contract.
 */
export function validateComponentPage(source, options) {
  if (typeof source !== 'string') fail(options.filePath, 'source must be a string');
  if (!PROFILE_NAMES.has(options.profile)) fail(options.filePath, `unknown profile ${options.profile}`);
  const frontmatter = parseFrontmatter(source, options.filePath);
  let scanned;
  try {
    scanned = scanMarkdown(frontmatter.body);
  } catch (error) {
    fail(options.filePath, error instanceof Error ? error.message : String(error));
  }
  const h1s = scanned.headings.filter((heading) => heading.level === 1);
  if (h1s.length !== 1) fail(options.filePath, `expected exactly one H1, found ${h1s.length}`);
  const plays = playExamples(scanned.visible, options.filePath);
  exactPopulation(plays, options.expectedExamples, options.filePath);

  const firstBlock = scanned.visible.search(/<PlayExample\b/);
  const firstSnippet = scanned.snippets[0]?.start ?? -1;
  const firstTeachingBlock =
    firstBlock < 0 ? firstSnippet : firstSnippet < 0 ? firstBlock : Math.min(firstBlock, firstSnippet);
  const intro = scanned.visible
    .slice(0, firstTeachingBlock < 0 ? undefined : firstTeachingBlock)
    .replace(/^# .+$/m, '')
    .trim();
  if (intro.length < 60) fail(options.filePath, 'introductory prose is not substantive');

  validateSnippets(scanned.snippets, options.filePath, options.profile !== 'api');
  const sections =
    options.profile === 'standard'
      ? validateStandard(scanned, plays, options)
      : (validateProfile(scanned, plays, options.profile, options.filePath), new Map());
  if (options.profile !== 'api' && plays.length === 0) fail(options.filePath, 'profile requires a live example');

  const links = markdownLinks(scanned.visible);
  if (!links.some((link) => link.startsWith('/api/'))) fail(options.filePath, 'missing generated API link');
  if (!links.some((link) => link.startsWith('/components/'))) fail(options.filePath, 'missing related component link');
  validateExpectedContent(scanned.visible, options, sections, links);

  return Object.freeze({
    title: frontmatter.title,
    description: frontmatter.description,
    h1: h1s[0].text,
    headings: Object.freeze(scanned.headings.map((heading) => heading.text)),
    anchors: Object.freeze(headingAnchors(scanned.headings)),
    exampleIds: Object.freeze(plays.map((play) => play.id)),
    snippetCount: scanned.snippets.length,
    relatedLinks: Object.freeze(links),
  });
}
