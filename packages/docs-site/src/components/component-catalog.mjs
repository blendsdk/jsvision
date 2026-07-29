/**
 * Validate and project the checked-in component documentation catalog.
 *
 * This module is intentionally independent of Node APIs so VitePress
 * configuration and focused tests can share the exact same validation rules.
 */

const COMMON_FIELDS = ['kind', 'id', 'title', 'family', 'page', 'related', 'sidebarOrder'];
const COMPONENT_FIELDS = ['package', 'symbols', 'complexity', 'examples', 'apiSymbols', 'primary'];
const TOPIC_FIELDS = ['hub', 'profile', 'examples'];
const PACKAGE_NAMES = new Set(['ui', 'forms', 'files', 'datagrid', 'code-editor']);
const COMPLEXITIES = new Set(['standard', 'data-grid-hub', 'code-editor-hub']);
const HUBS = new Set(['data-grid', 'code-editor']);
const PROFILES = new Set(['landing', 'capability', 'api']);
const COMPONENT_ROUTE = /^\/components\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)+(?:#[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value, path) {
  if (!isRecord(value)) fail(path, 'expected an object');
  return value;
}

function requireString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'expected a non-empty string');
  return value;
}

function requireInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) fail(path, 'expected a positive integer');
  return value;
}

function requireEnum(value, allowed, path) {
  const selected = requireString(value, path);
  if (!allowed.has(selected)) fail(path, `unknown value "${selected}"`);
  return selected;
}

function requireStringArray(value, path, allowEmpty = true) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(path, allowEmpty ? 'expected a string array' : 'expected a non-empty string array');
  }
  return value.map((item, index) => requireString(item, `${path}[${index}]`));
}

function rejectUnknownFields(value, fields, path) {
  const allowed = new Set(fields);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'unknown field');
  }
}

function requireUnique(values, path) {
  if (new Set(values).size !== values.length) fail(path, 'contains duplicate values');
}

function freezeArray(values) {
  return Object.freeze([...values]);
}

function parseApiSymbols(value, path) {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  return freezeArray(
    value.map((item, index) => {
      const itemPath = `${path}[${index}]`;
      const record = requireRecord(item, itemPath);
      rejectUnknownFields(record, ['package', 'symbol'], itemPath);
      return Object.freeze({
        package: requireEnum(record.package, PACKAGE_NAMES, `${itemPath}.package`),
        symbol: requireString(record.symbol, `${itemPath}.symbol`),
      });
    }),
  );
}

function parseCommon(record, path) {
  const page = requireString(record.page, `${path}.page`);
  if (!COMPONENT_ROUTE.test(page)) fail(`${path}.page`, 'expected a site-absolute component route');
  const related = requireStringArray(record.related, `${path}.related`);
  requireUnique(related, `${path}.related`);
  return {
    id: requireString(record.id, `${path}.id`),
    title: requireString(record.title, `${path}.title`),
    family: requireString(record.family, `${path}.family`),
    page,
    related: freezeArray(related),
    sidebarOrder: requireInteger(record.sidebarOrder, `${path}.sidebarOrder`),
  };
}

function parseComponent(record, path) {
  rejectUnknownFields(record, [...COMMON_FIELDS, ...COMPONENT_FIELDS], path);
  const common = parseCommon(record, path);
  const symbols = requireStringArray(record.symbols, `${path}.symbols`, false);
  const examples = requireStringArray(record.examples, `${path}.examples`, false);
  requireUnique(symbols, `${path}.symbols`);
  requireUnique(examples, `${path}.examples`);
  if (typeof record.primary !== 'boolean') fail(`${path}.primary`, 'expected a boolean');
  return Object.freeze({
    kind: 'component',
    ...common,
    package: requireEnum(record.package, PACKAGE_NAMES, `${path}.package`),
    symbols: freezeArray(symbols),
    complexity: requireEnum(record.complexity, COMPLEXITIES, `${path}.complexity`),
    examples: freezeArray(examples),
    apiSymbols: parseApiSymbols(record.apiSymbols, `${path}.apiSymbols`),
    primary: record.primary,
  });
}

function parseTopic(record, path) {
  rejectUnknownFields(record, [...COMMON_FIELDS, ...TOPIC_FIELDS], path);
  const common = parseCommon(record, path);
  const profile = requireEnum(record.profile, PROFILES, `${path}.profile`);
  const examples = requireStringArray(record.examples, `${path}.examples`);
  if (profile !== 'api' && examples.length === 0) {
    fail(`${path}.examples`, 'only API topics may omit examples');
  }
  requireUnique(examples, `${path}.examples`);
  return Object.freeze({
    kind: 'topic',
    ...common,
    hub: requireEnum(record.hub, HUBS, `${path}.hub`),
    profile,
    examples: freezeArray(examples),
  });
}

function compareEntries(left, right) {
  return (
    left.sidebarOrder - right.sidebarOrder || left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
  );
}

function navigationItem(entry) {
  return Object.freeze({ id: entry.id, text: entry.title, link: entry.page });
}

/** Expose Map reads without leaking mutating methods such as set/delete/clear. */
function readonlyMap(source) {
  return Object.freeze({
    get size() {
      return source.size;
    },
    get(key) {
      return source.get(key);
    },
    has(key) {
      return source.has(key);
    },
    entries() {
      return source.entries();
    },
    keys() {
      return source.keys();
    },
    values() {
      return source.values();
    },
    forEach(callback, thisArg) {
      source.forEach((value, key) => callback.call(thisArg, value, key, this));
    },
    [Symbol.iterator]() {
      return source[Symbol.iterator]();
    },
  });
}

/**
 * Parse and validate an unknown catalog value.
 *
 * @param {unknown} value Candidate value, normally parsed from `components.json`.
 * @returns {Readonly<{schemaVersion: 1, entries: readonly object[]}>} Deeply frozen catalog.
 * @throws {TypeError} When a field, discriminator, relationship, or ordering key is invalid.
 */
export function validateComponentCatalog(value) {
  const document = requireRecord(value, 'catalog');
  rejectUnknownFields(document, ['schemaVersion', 'entries'], 'catalog');
  if (document.schemaVersion !== 1) fail('catalog.schemaVersion', 'expected 1');
  if (!Array.isArray(document.entries)) fail('catalog.entries', 'expected an array');

  const entries = document.entries.map((entry, index) => {
    const path = `catalog.entries[${index}]`;
    const record = requireRecord(entry, path);
    if (record.kind === 'component') return parseComponent(record, path);
    if (record.kind === 'topic') return parseTopic(record, path);
    fail(`${path}.kind`, 'expected "component" or "topic"');
  });

  requireUnique(
    entries.map((entry) => entry.id),
    'catalog.entries.id',
  );
  const ids = new Set(entries.map((entry) => entry.id));
  const symbolOwners = [];
  const orderKeys = [];
  const projectedRoutes = [];
  const navigationLabelKeys = [];
  for (const entry of entries) {
    if (entry.related.includes(entry.id)) fail(`${entry.id}.related`, 'cannot reference itself');
    for (const related of entry.related) {
      if (!ids.has(related)) fail(`${entry.id}.related`, `unknown catalog id "${related}"`);
    }
    if (entry.kind === 'component') {
      symbolOwners.push(...entry.symbols.map((symbol) => `${entry.package}:${symbol}`));
      orderKeys.push(`${entry.complexity === 'standard' ? entry.family : entry.complexity}:${entry.sidebarOrder}`);
      if (entry.complexity === 'standard' && entry.primary) {
        projectedRoutes.push(entry.page);
        navigationLabelKeys.push(`standard:${entry.family}:${entry.title}`);
      }
    } else {
      orderKeys.push(`${entry.hub}:${entry.sidebarOrder}`);
      projectedRoutes.push(entry.page);
      navigationLabelKeys.push(`${entry.hub}:${entry.title}`);
    }
  }
  requireUnique(symbolOwners, 'catalog component symbol ownership');
  requireUnique(orderKeys, 'catalog sidebar ordering');
  requireUnique(projectedRoutes, 'catalog projected routes');
  requireUnique(navigationLabelKeys, 'catalog navigation labels');

  return Object.freeze({ schemaVersion: 1, entries: freezeArray(entries) });
}

/**
 * Parse catalog JSON and apply the same validation used for object input.
 *
 * @param {string} source UTF-8 JSON source.
 * @returns {ReturnType<typeof validateComponentCatalog>} Validated catalog.
 * @throws {SyntaxError|TypeError} When JSON parsing or catalog validation fails.
 */
export function parseComponentCatalog(source, sourceName = 'components.json') {
  if (typeof source !== 'string') fail('catalog source', 'expected a string');
  try {
    return validateComponentCatalog(JSON.parse(source));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new SyntaxError(`${sourceName}: invalid JSON at $: ${error.message}`, { cause: error });
    }
    throw error;
  }
}

/**
 * Build stable lookup maps without exposing mutable catalog state.
 *
 * @param {readonly object[]} entries Validated catalog entries.
 * @returns {Readonly<{byId: ReadonlyMap<string, object>, symbolOwner: ReadonlyMap<string, object>}>}
 * Lookup maps for documentation integrations.
 */
export function createComponentCatalogIndexes(entries) {
  const byId = new Map();
  const symbolOwner = new Map();
  for (const entry of entries) {
    byId.set(entry.id, entry);
    if (entry.kind === 'component') {
      for (const symbol of entry.symbols) symbolOwner.set(`${entry.package}:${symbol}`, entry);
    }
  }
  return Object.freeze({ byId: readonlyMap(byId), symbolOwner: readonlyMap(symbolOwner) });
}

/**
 * Project deterministic standard and specialist navigation.
 *
 * @param {readonly object[]} entries Validated component/topic entries in any order.
 * @returns {Readonly<{components: readonly object[], dataGrid: readonly object[], codeEditor: readonly object[]}>}
 * Stable navigation groups suitable for VitePress configuration.
 */
export function projectComponentNavigation(entries) {
  const standards = entries
    .filter((entry) => entry.kind === 'component' && entry.complexity === 'standard' && entry.primary)
    .slice()
    .sort((left, right) => left.family.localeCompare(right.family) || compareEntries(left, right));
  const grouped = new Map();
  for (const entry of standards) {
    const items = grouped.get(entry.family) ?? [];
    items.push(navigationItem(entry));
    grouped.set(entry.family, items);
  }
  const components = [...grouped].map(([text, items]) => Object.freeze({ text, items: freezeArray(items) }));
  const hubLandings = entries
    .filter((entry) => entry.kind === 'topic' && entry.profile === 'landing')
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
    .map((entry) => Object.freeze({ id: entry.id, text: entry.family, link: entry.page }));
  if (hubLandings.length > 0) {
    components.push(Object.freeze({ text: 'Specialists', items: freezeArray(hubLandings) }));
  }
  const topics = (hub) =>
    entries
      .filter((entry) => entry.kind === 'topic' && entry.hub === hub)
      .slice()
      .sort(compareEntries)
      .map(navigationItem);
  return Object.freeze({
    components: freezeArray(components),
    dataGrid: freezeArray(topics('data-grid')),
    codeEditor: freezeArray(topics('code-editor')),
  });
}

/**
 * Compare declared visual ownership with an independently supplied inventory.
 *
 * @param {readonly object[]} entries Validated catalog entries.
 * @param {readonly string[]} expected Keys in `package:symbol` form.
 * @returns {Readonly<{missing: readonly string[], unexpected: readonly string[]}>} Sorted parity differences.
 */
export function compareVisualSymbolInventory(entries, expected) {
  const actual = new Set(
    entries
      .filter((entry) => entry.kind === 'component')
      .flatMap((entry) => entry.symbols.map((symbol) => `${entry.package}:${symbol}`)),
  );
  const wanted = new Set(expected);
  return Object.freeze({
    missing: freezeArray([...wanted].filter((key) => !actual.has(key)).sort()),
    unexpected: freezeArray([...actual].filter((key) => !wanted.has(key)).sort()),
  });
}
