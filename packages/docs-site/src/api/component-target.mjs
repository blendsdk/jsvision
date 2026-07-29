/**
 * Parse component-documentation targets shared by API maps, backlinks, and
 * production build validation.
 */

const ROUTE_PATTERN = /^\/components\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)+$/;
const FRAGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function titleCase(segment) {
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Parse a component route and optional heading fragment.
 *
 * Plain Markdown pages build to `<route>.html`, while a route ending in `/`
 * builds to `<route>/index.html`. The fragment is kept separately so callers
 * never accidentally include it in a filesystem lookup.
 *
 * @param {string} target Site-absolute target below `/components/`.
 * @returns {{route: string, fragment?: string, label: string, buildKey: string}}
 * Normalized route metadata.
 * @throws {TypeError} When the target is malformed, unsafe, or outside the component tree.
 *
 * @example
 * parseComponentTarget('/components/data-grid/#editing')
 * // => { route: '/components/data-grid/', fragment: 'editing',
 * //      label: 'Data Grid', buildKey: 'components/data-grid/index.html' }
 */
export function parseComponentTarget(target) {
  if (typeof target !== 'string' || target === '') {
    throw new TypeError('component target must be a non-empty string');
  }
  if (
    target.includes('\\') ||
    target.includes('?') ||
    target.includes('%') ||
    target.includes('\0') ||
    target.split('#').length > 2
  ) {
    throw new TypeError(`invalid component target: ${target}`);
  }

  const [route, fragment] = target.split('#');
  if (!ROUTE_PATTERN.test(route) || route.includes('//') || route.split('/').includes('..')) {
    throw new TypeError(`component target must be a canonical /components/ route: ${target}`);
  }
  if (fragment !== undefined && !FRAGMENT_PATTERN.test(fragment)) {
    throw new TypeError(`component target fragment must be kebab-case: ${target}`);
  }

  const routeSegments = route.split('/').filter(Boolean);
  const label = titleCase(routeSegments[routeSegments.length - 1]);
  const relativeRoute = route.slice(1);
  const buildKey = route.endsWith('/') ? `${relativeRoute}index.html` : `${relativeRoute}.html`;
  return Object.freeze({
    route,
    ...(fragment === undefined ? {} : { fragment }),
    label,
    buildKey,
  });
}
