import type { StandardCard } from '@jsvision/kanban';

/** Public Node.js organization project loaded when the playground starts. */
export const DEFAULT_GITHUB_PROJECT_URL = 'https://github.com/orgs/nodejs/projects/11';

const API_VERSION = '2026-03-10';
const NO_STATUS_COLUMN_ID = 'github-no-status';
const MAX_PAGES = 100;
const MAX_PAGE_MEMBERS = 100;
const MAX_PROJECT_ITEMS = 10_000;
const MAX_FIELDS = 256;
const MAX_STATUS_OPTIONS = 256;
const MAX_CARD_MEMBERS = 64;
const MAX_GENERATED_URL_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_LOAD_BYTES = 32 * 1024 * 1024;

/** Canonical parts of a public organization or user GitHub Projects URL. */
export interface GitHubProjectLocation {
  /** GitHub URL namespace used by the project owner. */
  readonly ownerKind: 'orgs' | 'users';
  /** GitHub organization or user login. */
  readonly owner: string;
  /** Owner-local Projects V2 number. */
  readonly projectNumber: number;
  /** Optional public project view whose filtered items should be loaded. */
  readonly viewNumber?: number;
}

/** Status color names returned by GitHub's single-select project field. */
export type GitHubProjectStatusColor = 'GRAY' | 'BLUE' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PINK' | 'PURPLE';

/** GitHub metadata kept opaque to the generic Kanban package. */
export interface GitHubProjectCardData {
  /** Full repository name when the item belongs to a repository. */
  readonly repository?: string;
  /** Compact issue or pull-request number. */
  readonly reference?: string;
  /** Browser URL for the original GitHub item. */
  readonly url?: string;
  /** GitHub status color used by the app's theme-role mapping. */
  readonly statusColor: GitHubProjectStatusColor;
}

/** Application-owned card type displayed by the standalone playground. */
export type GitHubProjectCard = StandardCard<string, GitHubProjectCardData>;

/** One ordered status lane obtained from the GitHub project schema. */
export interface GitHubProjectColumn {
  /** Stable GitHub status-option identifier. */
  readonly columnId: string;
  /** Human-readable GitHub status name. */
  readonly label: string;
  /** Equality revision used by the Kanban data source. */
  readonly revision: number;
  /** GitHub color associated with the status option. */
  readonly color: GitHubProjectStatusColor;
}

/** Immutable public-project snapshot used to seed or refresh the local playground. */
export interface GitHubProjectSnapshot {
  /** Stable GitHub project node identifier. */
  readonly projectId: string;
  /** Display title supplied by GitHub. */
  readonly title: string;
  /** Optional short project description. */
  readonly description?: string;
  /** Canonical project page URL. */
  readonly url: string;
  /** Parsed owner and optional view selection. */
  readonly location: GitHubProjectLocation;
  /** Ordered lanes derived from GitHub's Status field. */
  readonly columns: readonly GitHubProjectColumn[];
  /** Ordered project items converted into generic Kanban cards. */
  readonly cards: readonly GitHubProjectCard[];
}

/** Minimal headers contract required from a GitHub HTTP response. */
export interface GitHubProjectHttpHeaders {
  /** Reads one response header case-insensitively. */
  get(name: string): string | null;
}

/** Minimal response surface used by the injectable public GitHub transport. */
export interface GitHubProjectHttpResponse {
  /** Whether the HTTP response represents success. */
  readonly ok: boolean;
  /** Numeric HTTP status. */
  readonly status: number;
  /** Human-readable HTTP status. */
  readonly statusText: string;
  /** Response headers, including GitHub pagination links. */
  readonly headers: GitHubProjectHttpHeaders;
  /** Required byte stream so limits can be enforced before the complete JSON body is allocated. */
  readonly body: ReadableStream<Uint8Array>;
}

/** Injectable HTTP boundary used by tests and by the native-fetch default. */
export type GitHubProjectTransport = (
  url: string,
  options: { readonly signal?: AbortSignal },
) => Promise<GitHubProjectHttpResponse>;

/** Options for loading one public GitHub Projects V2 snapshot. */
export interface LoadGitHubProjectOptions {
  /** Optional transport replacement for tests or specialized hosts. */
  readonly transport?: GitHubProjectTransport;
  /** Optional cancellation signal for stale application loads. */
  readonly signal?: AbortSignal;
}

/** Error raised when a public project URL or GitHub response cannot be used safely. */
export class GitHubProjectLoadError extends Error {
  /** Creates a stable, user-presentable loading error. */
  constructor(message: string) {
    super(message);
    this.name = 'GitHubProjectLoadError';
  }
}

/**
 * Parses one canonical public GitHub Projects URL.
 *
 * @param value User-entered GitHub project URL.
 * @returns Validated owner, project number, and optional view number.
 * @throws {@link GitHubProjectLoadError} when the URL is not a supported public project URL.
 * @example
 * ```ts
 * parseGitHubProjectUrl('https://github.com/orgs/nodejs/projects/11');
 * ```
 */
export function parseGitHubProjectUrl(value: string): GitHubProjectLocation {
  const invalid = (): never => {
    throw new GitHubProjectLoadError(
      'Enter a public GitHub Projects URL such as https://github.com/orgs/nodejs/projects/11.',
    );
  };
  if (value.length < 1 || value.length > 500) invalid();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid();
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username !== '' || url.password !== '') {
    return invalid();
  }
  if (url.search !== '' || url.hash !== '') return invalid();
  const parts = url.pathname.split('/').filter(Boolean);
  const hasView = parts.length === 6 && parts[4] === 'views';
  if (!(parts.length === 4 || hasView) || (parts[0] !== 'orgs' && parts[0] !== 'users') || parts[2] !== 'projects') {
    return invalid();
  }
  const owner = parts[1];
  const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u;
  const projectNumber = Number(parts[3]);
  const viewNumber = hasView ? Number(parts[5]) : undefined;
  if (
    owner === undefined ||
    !ownerPattern.test(owner) ||
    !Number.isSafeInteger(projectNumber) ||
    projectNumber < 1 ||
    (viewNumber !== undefined && (!Number.isSafeInteger(viewNumber) || viewNumber < 1))
  ) {
    return invalid();
  }
  return {
    ownerKind: parts[0],
    owner,
    projectNumber,
    ...(viewNumber === undefined ? {} : { viewNumber }),
  };
}

/** Native public GitHub transport with the current REST media type and API version. */
const nativeTransport: GitHubProjectTransport = async (url, options) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'jsvision-github-kanban',
    },
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  if (response.body === null) throw new GitHubProjectLoadError('GitHub returned an unreadable project response.');
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    body: response.body,
  };
};

/** Returns whether an untrusted JSON value is a plain record-like object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a bounded display string while removing terminal control characters. */
function displayString(value: unknown, maximum = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return cleaned === '' ? undefined : cleaned.slice(0, maximum);
}

/** Reads a positive numeric or string identifier as display-safe text. */
function identifier(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return displayString(value, 200);
}

/** Reads GitHub's `{ raw, html }` rich-text wrapper or a direct string. */
function rawText(value: unknown): string | undefined {
  if (typeof value === 'string') return displayString(value);
  if (!isRecord(value)) return undefined;
  return displayString(value.raw) ?? displayString(value.html);
}

/** Narrows a GitHub status color to the documented public enum. */
function statusColor(value: unknown): GitHubProjectStatusColor {
  switch (value) {
    case 'BLUE':
    case 'GREEN':
    case 'YELLOW':
    case 'ORANGE':
    case 'RED':
    case 'PINK':
    case 'PURPLE':
      return value;
    default:
      return 'GRAY';
  }
}

/** Throws a concise GitHub HTTP error, including the unauthenticated rate-limit case. */
interface LoadBudget {
  bytes: number;
}

/** Reads and parses one response while enforcing declared, actual, and cumulative byte ceilings. */
async function checkedJson(response: GitHubProjectHttpResponse, budget: LoadBudget): Promise<unknown> {
  if (!response.ok) {
    const suffix = response.status === 403 ? ' The public GitHub API rate limit may have been reached.' : '';
    throw new GitHubProjectLoadError(`GitHub returned ${response.status} ${response.statusText}.${suffix}`);
  }
  try {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
      throw new GitHubProjectLoadError('GitHub returned a project response that is too large.');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES || budget.bytes + bytes > MAX_LOAD_BYTES) {
          await reader.cancel();
          throw new GitHubProjectLoadError('GitHub returned a project response that is too large.');
        }
        chunks.push(next.value);
      }
    } finally {
      reader.releaseLock();
    }
    budget.bytes += bytes;
    const merged = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(merged));
  } catch (error: unknown) {
    if (error instanceof GitHubProjectLoadError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new GitHubProjectLoadError('GitHub returned an unreadable project response.');
  }
}

/** Extracts and validates GitHub's next-page URL from an RFC 8288 Link header. */
function nextPage(link: string | null): string | undefined {
  if (link === null) return undefined;
  for (const part of link.split(',')) {
    const match = part.match(/^\s*<([^>]+)>;\s*rel="next"\s*$/u);
    if (match === null) continue;
    const value = match[1];
    if (value === undefined) return undefined;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'api.github.com') {
      throw new GitHubProjectLoadError('GitHub returned an invalid pagination URL.');
    }
    return url.toString();
  }
  return undefined;
}

/** Loads every page from one bounded GitHub collection endpoint. */
async function loadCollection(
  initialUrl: string,
  transport: GitHubProjectTransport,
  signal: AbortSignal | undefined,
  budget: LoadBudget,
  maximumMembers: number,
): Promise<readonly unknown[]> {
  const values: unknown[] = [];
  let url: string | undefined = initialUrl;
  for (let page = 0; url !== undefined && page < MAX_PAGES; page += 1) {
    const response = await transport(url, signal === undefined ? {} : { signal });
    const body = await checkedJson(response, budget);
    if (!Array.isArray(body)) throw new GitHubProjectLoadError('GitHub returned an invalid project collection.');
    if (body.length > MAX_PAGE_MEMBERS || values.length + body.length > maximumMembers) {
      throw new GitHubProjectLoadError('The project is too large for this playground session.');
    }
    values.push(...body);
    url = nextPage(response.headers.get('link'));
  }
  if (url !== undefined) throw new GitHubProjectLoadError('The project is too large for this playground session.');
  return values;
}

/** Reads a named field value from one Projects V2 item. */
function fieldValue(item: Record<string, unknown>, name: string): unknown {
  if (!Array.isArray(item.fields)) return undefined;
  const field = item.fields.find((candidate) => isRecord(candidate) && displayString(candidate.name) === name);
  return isRecord(field) ? field.value : undefined;
}

/** Reads compact assignee records from a GitHub field value. */
function assignees(value: unknown): readonly { readonly id: string; readonly label: string }[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_CARD_MEMBERS) throw new GitHubProjectLoadError('A project item has too many assignees.');
  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const id = identifier(candidate.id) ?? displayString(candidate.node_id);
    const label = displayString(candidate.login) ?? displayString(candidate.name);
    return id === undefined || label === undefined ? [] : [{ id, label }];
  });
}

/** Reads compact label records from a GitHub field value. */
function labels(value: unknown): readonly { readonly id: string; readonly label: string }[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_CARD_MEMBERS) throw new GitHubProjectLoadError('A project item has too many labels.');
  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const id = identifier(candidate.id) ?? displayString(candidate.node_id);
    const label = displayString(candidate.name);
    return id === undefined || label === undefined ? [] : [{ id, label }];
  });
}

/** Converts one valid status field option into a Kanban column. */
function projectColumn(value: unknown): GitHubProjectColumn | undefined {
  if (!isRecord(value)) return undefined;
  const columnId = identifier(value.id);
  const label = rawText(value.name);
  if (columnId === undefined || label === undefined) return undefined;
  return Object.freeze({ columnId, label, revision: 1, color: statusColor(value.color) });
}

/** Converts one GitHub project item into the app's generic card model. */
function projectCard(value: unknown, columns: readonly GitHubProjectColumn[]): GitHubProjectCard | undefined {
  if (!isRecord(value)) return undefined;
  const content = isRecord(value.content) ? value.content : undefined;
  const key = displayString(value.node_id) ?? identifier(value.id);
  const status = fieldValue(value, 'Status');
  const selectedStatusId = isRecord(status) ? identifier(status.id) : undefined;
  const column = columns.find(({ columnId }) => columnId === selectedStatusId);
  const title =
    (content === undefined ? undefined : displayString(content.title)) ??
    rawText(fieldValue(value, 'Title')) ??
    'Untitled item';
  if (key === undefined) return undefined;
  const repositoryValue = fieldValue(value, 'Repository');
  const repository = isRecord(repositoryValue) ? displayString(repositoryValue.full_name) : undefined;
  const number = content === undefined ? undefined : identifier(content.number);
  const description = content === undefined ? undefined : displayString(content.body, 10_000);
  const url = content === undefined ? undefined : displayString(content.html_url, 1_000);
  const type = displayString(value.content_type) ?? rawText(fieldValue(value, 'Type')) ?? 'Draft';
  const cardAssignees = assignees(fieldValue(value, 'Assignees'));
  const cardLabels = labels(fieldValue(value, 'Labels'));
  const summaries = [
    ...(repository === undefined ? [] : [{ fieldId: 'repository', label: 'Repo', value: repository }]),
    ...(number === undefined ? [] : [{ fieldId: 'reference', label: 'Item', value: `#${number}` }]),
  ];
  return Object.freeze({
    key,
    columnId: column?.columnId ?? NO_STATUS_COLUMN_ID,
    title,
    status: column?.label ?? 'No status',
    type,
    ...(description === undefined ? {} : { description }),
    ...(cardAssignees.length === 0 ? {} : { assignees: Object.freeze(cardAssignees) }),
    ...(cardLabels.length === 0 ? {} : { labels: Object.freeze(cardLabels) }),
    ...(summaries.length === 0 ? {} : { summaries: Object.freeze(summaries) }),
    custom: Object.freeze({
      statusColor: column?.color ?? 'GRAY',
      ...(repository === undefined ? {} : { repository }),
      ...(number === undefined ? {} : { reference: `#${number}` }),
      ...(url === undefined ? {} : { url }),
    }),
  });
}

/**
 * Loads a public GitHub Projects V2 board without authentication or write access.
 *
 * @param projectUrl Canonical public organization or user project URL.
 * @param options Optional cancellation and injected transport seams.
 * @returns Immutable lanes and cards ready for the local-only playground.
 */
export async function loadGitHubProject(
  projectUrl: string,
  options: LoadGitHubProjectOptions = {},
): Promise<GitHubProjectSnapshot> {
  const location = parseGitHubProjectUrl(projectUrl);
  const transport = options.transport ?? nativeTransport;
  const budget: LoadBudget = { bytes: 0 };
  const apiBase = `https://api.github.com/${location.ownerKind}/${location.owner}/projectsV2/${location.projectNumber}`;
  const projectBody = await checkedJson(
    await transport(apiBase, options.signal === undefined ? {} : { signal: options.signal }),
    budget,
  );
  if (!isRecord(projectBody)) throw new GitHubProjectLoadError('GitHub returned an invalid project record.');
  const projectId = displayString(projectBody.node_id) ?? identifier(projectBody.id);
  const title = displayString(projectBody.title);
  if (projectId === undefined || title === undefined) {
    throw new GitHubProjectLoadError('GitHub returned a project without an identity or title.');
  }

  const fields = await loadCollection(`${apiBase}/fields?per_page=100`, transport, options.signal, budget, MAX_FIELDS);
  const statusField = fields.find(
    (field) => isRecord(field) && displayString(field.name) === 'Status' && field.data_type === 'single_select',
  );
  if (isRecord(statusField) && Array.isArray(statusField.options) && statusField.options.length > MAX_STATUS_OPTIONS) {
    throw new GitHubProjectLoadError('The project has too many status options.');
  }
  const configuredColumns =
    isRecord(statusField) && Array.isArray(statusField.options)
      ? statusField.options.flatMap((option) => {
          const column = projectColumn(option);
          return column === undefined ? [] : [column];
        })
      : [];
  const fieldIds = fields.flatMap((field) => {
    const id = isRecord(field) ? identifier(field.id) : undefined;
    return id === undefined ? [] : [id];
  });
  const itemPath = location.viewNumber === undefined ? '/items' : `/views/${location.viewNumber}/items`;
  const itemUrl = `${apiBase}${itemPath}?per_page=100${
    fieldIds.length === 0 ? '' : `&fields=${encodeURIComponent(fieldIds.join(','))}`
  }`;
  if (new TextEncoder().encode(itemUrl).byteLength > MAX_GENERATED_URL_BYTES) {
    throw new GitHubProjectLoadError('The generated GitHub request is too large.');
  }
  const items = await loadCollection(itemUrl, transport, options.signal, budget, MAX_PROJECT_ITEMS);
  const cards = items.flatMap((item) => {
    const card = projectCard(item, configuredColumns);
    return card === undefined ? [] : [card];
  });
  const hasUnassigned = cards.some(({ columnId }) => columnId === NO_STATUS_COLUMN_ID);
  const columns: readonly GitHubProjectColumn[] = Object.freeze([
    ...configuredColumns,
    ...(hasUnassigned
      ? [Object.freeze({ columnId: NO_STATUS_COLUMN_ID, label: 'No status', revision: 1, color: 'GRAY' as const })]
      : []),
  ]);
  if (columns.length === 0) {
    throw new GitHubProjectLoadError('This project does not expose a Status field or any displayable items.');
  }
  const description = displayString(projectBody.short_description, 1_000);
  return Object.freeze({
    projectId,
    title,
    ...(description === undefined ? {} : { description }),
    url: projectUrl,
    location,
    columns,
    cards: Object.freeze(cards),
  });
}
