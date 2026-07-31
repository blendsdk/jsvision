/**
 * Validate and project the checked-in Guide curriculum catalog.
 *
 * This module stays independent of Node APIs so VitePress and focused tests share one contract.
 */

const FIELDS = [
  'id',
  'title',
  'group',
  'page',
  'profile',
  'stage',
  'sidebarOrder',
  'prerequisites',
  'learningOutcomes',
  'requiredLiveExamples',
  'liveExampleException',
  'examples',
];
const PROFILES = new Set(['orientation', 'course', 'integration', 'specialist']);
const STAGES = new Set(['complete', 'upgrade', 'planned']);
const SITE_ROUTE = /^\/(?:guide\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?\/?|components\/[a-z0-9]+(?:-[a-z0-9]+)*\/)$/;

/** Throw one path-addressed catalog validation error. */
function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

/** Return true for a plain object-like value. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Require a plain record. */
function requireRecord(value, path) {
  if (!isRecord(value)) fail(path, 'expected an object');
  return value;
}

/** Require a non-empty string. */
function requireString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'expected a non-empty string');
  return value;
}

/** Require a non-negative safe integer. */
function requireCount(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) fail(path, 'expected a non-negative integer');
  return value;
}

/** Require a positive safe integer. */
function requireOrder(value, path) {
  const order = requireCount(value, path);
  if (order === 0) fail(path, 'expected a positive integer');
  return order;
}

/** Require a known string discriminator. */
function requireEnum(value, allowed, path) {
  const selected = requireString(value, path);
  if (!allowed.has(selected)) fail(path, `unknown value "${selected}"`);
  return selected;
}

/** Require a unique string array with an optional minimum length. */
function requireStringArray(value, path, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) {
    fail(path, `expected a string array with at least ${minimum} entries`);
  }
  const items = value.map((item, index) => requireString(item, `${path}[${index}]`));
  if (new Set(items).size !== items.length) fail(path, 'contains duplicate values');
  return Object.freeze(items);
}

/** Reject fields that are not part of the stable schema. */
function rejectUnknownFields(value, path) {
  const allowed = new Set(FIELDS);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'unknown field');
  }
}

/** Freeze a shallow copy without exposing a mutable caller-owned array. */
function freezeArray(values) {
  return Object.freeze([...values]);
}

/** Parse optional external evidence that cannot be discovered by this Node-independent module. */
function parseValidationOptions(value) {
  if (value === undefined) return Object.freeze({ registeredExampleIds: null });
  const options = requireRecord(value, 'catalog validation options');
  for (const key of Object.keys(options)) {
    if (key !== 'registeredExampleIds') fail(`catalog validation options.${key}`, 'unknown field');
  }
  const registeredExampleIds =
    options.registeredExampleIds === undefined
      ? null
      : new Set(requireStringArray(options.registeredExampleIds, 'catalog validation options.registeredExampleIds'));
  return Object.freeze({ registeredExampleIds });
}

/** Reject a prerequisite cycle and include its deterministic traversal path in the diagnostic. */
function validatePrerequisiteGraph(entries) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const visited = new Set();
  const visiting = new Set();
  const visit = (id, path) => {
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      const cycle = [...path.slice(cycleStart), id];
      fail(`${id}.prerequisites`, `cycle detected: ${cycle.join(' -> ')}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const entry = byId.get(id);
    for (const prerequisite of entry.prerequisites) visit(prerequisite, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const entry of entries) visit(entry.id, []);
}

/** Parse one curriculum entry. */
function parseEntry(value, index) {
  const path = `catalog.entries[${index}]`;
  const record = requireRecord(value, path);
  rejectUnknownFields(record, path);
  const page = requireString(record.page, `${path}.page`);
  if (!SITE_ROUTE.test(page)) fail(`${path}.page`, 'expected a supported site-absolute route');
  const profile = requireEnum(record.profile, PROFILES, `${path}.profile`);
  const stage = requireEnum(record.stage, STAGES, `${path}.stage`);
  const requiredLiveExamples = requireCount(record.requiredLiveExamples, `${path}.requiredLiveExamples`);
  const liveExampleException =
    record.liveExampleException === null
      ? null
      : requireString(record.liveExampleException, `${path}.liveExampleException`);
  if (profile === 'course' && requiredLiveExamples < 1 && liveExampleException === null) {
    fail(`${path}.liveExampleException`, 'a course without a live example requires an explicit exception');
  }
  if (profile === 'specialist' && !page.startsWith('/components/')) {
    fail(`${path}.page`, 'a specialist course must target a component hub');
  }
  if (profile !== 'specialist' && !page.startsWith('/guide/')) {
    fail(`${path}.page`, 'a Guide profile must target a Guide route');
  }
  return Object.freeze({
    id: requireString(record.id, `${path}.id`),
    title: requireString(record.title, `${path}.title`),
    group: requireString(record.group, `${path}.group`),
    page,
    profile,
    stage,
    sidebarOrder: requireOrder(record.sidebarOrder, `${path}.sidebarOrder`),
    prerequisites: requireStringArray(record.prerequisites, `${path}.prerequisites`),
    learningOutcomes: requireStringArray(record.learningOutcomes, `${path}.learningOutcomes`, 2),
    requiredLiveExamples,
    liveExampleException,
    examples: requireStringArray(record.examples, `${path}.examples`),
  });
}

/**
 * Validate an unknown Guide curriculum document.
 *
 * @param {unknown} value Candidate value, normally parsed from `guides.json`.
 * @param {{registeredExampleIds?: readonly string[]}} [options] Optional registry evidence used to
 * validate completed example IDs without importing the docs-site registry into this shared module.
 * @returns {Readonly<{schemaVersion: 1, entries: readonly object[]}>} Deeply frozen curriculum.
 * @throws {TypeError} When the document contains an invalid field, relationship, or ordering key.
 */
export function validateGuideCatalog(value, options) {
  const validation = parseValidationOptions(options);
  const document = requireRecord(value, 'catalog');
  for (const key of Object.keys(document)) {
    if (key !== 'schemaVersion' && key !== 'entries') fail(`catalog.${key}`, 'unknown field');
  }
  if (document.schemaVersion !== 1) fail('catalog.schemaVersion', 'expected 1');
  if (!Array.isArray(document.entries)) fail('catalog.entries', 'expected an array');
  const entries = document.entries.map(parseEntry);
  const ids = entries.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) fail('catalog.entries.id', 'contains duplicate values');
  const pages = entries.map((entry) => entry.page);
  if (new Set(pages).size !== pages.length) fail('catalog.entries.page', 'contains duplicate values');
  const knownIds = new Set(ids);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const orderKeys = [];
  for (const entry of entries) {
    orderKeys.push(`${entry.group}:${entry.sidebarOrder}`);
    for (const prerequisite of entry.prerequisites) {
      if (!knownIds.has(prerequisite)) fail(`${entry.id}.prerequisites`, `unknown prerequisite "${prerequisite}"`);
      if (prerequisite === entry.id) fail(`${entry.id}.prerequisites`, 'cannot reference itself');
    }
    if (entry.stage === 'complete' && entry.examples.length < entry.requiredLiveExamples) {
      fail(`${entry.id}.examples`, 'a completed entry must satisfy its live-example target');
    }
    if (entry.stage === 'complete') {
      for (const prerequisite of entry.prerequisites) {
        if (byId.get(prerequisite).stage !== 'complete') {
          fail(`${entry.id}.prerequisites`, `completed entry depends on non-complete "${prerequisite}"`);
        }
      }
      if (validation.registeredExampleIds !== null) {
        for (const example of entry.examples) {
          if (!validation.registeredExampleIds.has(example)) {
            fail(`${entry.id}.examples`, `unregistered example "${example}"`);
          }
        }
      }
    }
  }
  if (new Set(orderKeys).size !== orderKeys.length) fail('catalog sidebar ordering', 'contains duplicate positions');
  validatePrerequisiteGraph(entries);
  return Object.freeze({ schemaVersion: 1, entries: freezeArray(entries) });
}

/**
 * Parse curriculum JSON with the same validation used for object input.
 *
 * @param {string} source UTF-8 JSON source.
 * @param {string} sourceName Diagnostic source name.
 * @param {{registeredExampleIds?: readonly string[]}} [options] Optional registry evidence.
 * @returns {ReturnType<typeof validateGuideCatalog>} Validated curriculum.
 * @throws {SyntaxError|TypeError} When JSON or catalog validation fails.
 */
export function parseGuideCatalog(source, sourceName = 'guides.json', options) {
  if (typeof source !== 'string') fail('catalog source', 'expected a string');
  try {
    return validateGuideCatalog(JSON.parse(source), options);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new SyntaxError(`${sourceName}: invalid JSON at $: ${error.message}`, { cause: error });
    }
    throw error;
  }
}

/**
 * Project deterministic navigation for implemented and in-progress pages.
 *
 * Planned entries remain in the curriculum but are withheld until a real teaching page exists.
 *
 * @param {readonly object[]} entries Validated entries in curriculum order.
 * @returns {readonly object[]} VitePress-compatible Guide navigation groups.
 */
export function projectGuideNavigation(entries) {
  const validatedEntries = validateGuideCatalog({ schemaVersion: 1, entries }).entries;
  const groups = new Map();
  for (const entry of validatedEntries) {
    if (entry.stage === 'planned') continue;
    const items = groups.get(entry.group) ?? [];
    items.push(Object.freeze({ id: entry.id, text: entry.title, link: entry.page }));
    groups.set(entry.group, items);
  }
  return freezeArray(
    [...groups].map(([text, items]) =>
      Object.freeze({
        text,
        items: freezeArray(
          items.sort((left, right) => {
            const leftEntry = validatedEntries.find((entry) => entry.id === left.id);
            const rightEntry = validatedEntries.find((entry) => entry.id === right.id);
            return leftEntry.sidebarOrder - rightEntry.sidebarOrder;
          }),
        ),
      }),
    ),
  );
}
