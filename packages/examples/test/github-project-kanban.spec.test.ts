/**
 * Specification oracle for the standalone public GitHub Projects Kanban playground.
 *
 * The loader accepts only canonical public GitHub project URLs and converts GitHub's status,
 * label, assignee, repository, and issue metadata into application-owned Kanban records.
 */
import { expect, test } from 'vitest';

import {
  DEFAULT_GITHUB_PROJECT_URL,
  loadGitHubProject,
  parseGitHubProjectUrl,
} from '../github-project-kanban/github-project.js';
import type { GitHubProjectHttpResponse, GitHubProjectTransport } from '../github-project-kanban/github-project.js';

/** Creates one deterministic JSON response for the injected HTTP boundary. */
function jsonResponse(body: unknown, link: string | null = null): GitHubProjectHttpResponse {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (name) => (name.toLocaleLowerCase() === 'link' ? link : null) },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

/** Creates one body-backed response so byte ceilings are exercised before JSON parsing. */
function textResponse(text: string, contentLength?: string): GitHubProjectHttpResponse {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (name) => (name.toLocaleLowerCase() === 'content-length' ? (contentLength ?? null) : null),
    },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

/** Creates one response whose bytes arrive through the streamed transport seam. */
function streamResponse(
  chunks: readonly Uint8Array[],
  contentLength?: string,
  link: string | null = null,
): GitHubProjectHttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (name) =>
        name.toLocaleLowerCase() === 'content-length'
          ? (contentLength ?? null)
          : name.toLocaleLowerCase() === 'link'
            ? link
            : null,
    },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  };
}

/** Pads one JSON record with an ignored ASCII property to an exact UTF-8 byte length. */
function exactJsonRecord(record: Record<string, unknown>, bytes: number): Uint8Array {
  const encoder = new TextEncoder();
  const withPadding = { ...record, padding: '' };
  const base = encoder.encode(JSON.stringify(withPadding));
  if (base.byteLength > bytes) throw new Error('Requested JSON boundary is smaller than the fixture.');
  withPadding.padding = 'a'.repeat(bytes - base.byteLength);
  const output = encoder.encode(JSON.stringify(withPadding));
  if (output.byteLength !== bytes) throw new Error('Expected exact ASCII JSON byte boundary.');
  return output;
}

/** Pads the first record in one JSON array to an exact UTF-8 byte length. */
function exactJsonArray(record: Record<string, unknown>, bytes: number): Uint8Array {
  const encoder = new TextEncoder();
  const withPadding = { ...record, padding: '' };
  const base = encoder.encode(JSON.stringify([withPadding]));
  if (base.byteLength > bytes) throw new Error('Requested JSON boundary is smaller than the fixture.');
  withPadding.padding = 'a'.repeat(bytes - base.byteLength);
  const output = encoder.encode(JSON.stringify([withPadding]));
  if (output.byteLength !== bytes) throw new Error('Expected exact ASCII JSON array byte boundary.');
  return output;
}

// The playground must accept both organization and user project URLs, including a selected view.
test('should parse canonical public GitHub project URLs', () => {
  expect(parseGitHubProjectUrl(DEFAULT_GITHUB_PROJECT_URL)).toEqual({
    ownerKind: 'orgs',
    owner: 'nodejs',
    projectNumber: 11,
  });
  expect(parseGitHubProjectUrl('https://github.com/users/octocat/projects/7/views/3')).toEqual({
    ownerKind: 'users',
    owner: 'octocat',
    projectNumber: 7,
    viewNumber: 3,
  });
});

// Unrelated hosts and paths must never be converted into GitHub API requests.
test.each([
  'https://example.com/orgs/nodejs/projects/11',
  'http://github.com/orgs/nodejs/projects/11',
  'https://github.com/nodejs/node',
  'https://github.com/orgs/nodejs/projects/not-a-number',
  'https://github.com/orgs/nodejs/projects/11/settings',
])('should reject unsupported project URL %s', (value) => {
  expect(() => parseGitHubProjectUrl(value)).toThrow(/public GitHub Projects URL/u);
});

// A loaded project must preserve GitHub's status order and useful card metadata.
test('should load public project fields and cards into Kanban-ready records', async () => {
  const requests: string[] = [];
  const transport: GitHubProjectTransport = (url) => {
    requests.push(url);
    if (url.endsWith('/projectsV2/11')) {
      return Promise.resolve(
        jsonResponse({
          node_id: 'project-node',
          title: 'Node-API Team Project',
          short_description: 'Public delivery work',
          html_url: DEFAULT_GITHUB_PROJECT_URL,
          owner: { login: 'nodejs' },
        }),
      );
    }
    if (url.includes('/fields?')) {
      return Promise.resolve(
        jsonResponse([
          { id: 1, name: 'Title', data_type: 'title' },
          {
            id: 2,
            name: 'Status',
            data_type: 'single_select',
            options: [
              { id: 'todo', name: { raw: 'Todo' }, color: 'GREEN' },
              { id: 'done', name: { raw: 'Done' }, color: 'PURPLE' },
            ],
          },
          { id: 3, name: 'Labels', data_type: 'labels' },
          { id: 4, name: 'Assignees', data_type: 'assignees' },
          { id: 5, name: 'Repository', data_type: 'repository' },
        ]),
      );
    }
    return Promise.resolve(
      jsonResponse([
        {
          id: 42,
          node_id: 'item-node',
          content_type: 'Issue',
          content: {
            title: 'Make the public loader delightful',
            number: 123,
            html_url: 'https://github.com/nodejs/node/issues/123',
            body: 'A useful description',
          },
          fields: [
            { id: 2, name: 'Status', value: { id: 'todo', name: { raw: 'Todo' }, color: 'GREEN' } },
            { id: 3, name: 'Labels', value: [{ id: 9, name: 'good first issue', color: '7057ff' }] },
            { id: 4, name: 'Assignees', value: [{ id: 10, login: 'octocat' }] },
            { id: 5, name: 'Repository', value: { full_name: 'nodejs/node' } },
          ],
        },
      ]),
    );
  };

  const snapshot = await loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, { transport });

  expect(snapshot.title).toBe('Node-API Team Project');
  expect(snapshot.columns.map(({ label }) => label)).toEqual(['Todo', 'Done']);
  expect(snapshot.cards).toHaveLength(1);
  expect(snapshot.cards[0]).toMatchObject({
    key: 'item-node',
    columnId: 'todo',
    title: 'Make the public loader delightful',
    status: 'Todo',
    type: 'Issue',
    assignees: [{ id: '10', label: 'octocat' }],
    labels: [{ id: '9', label: 'good first issue' }],
    custom: { repository: 'nodejs/node', reference: '#123', statusColor: 'GREEN' },
  });
  expect(requests).toHaveLength(3);
  expect(requests[2]).toContain('fields=1%2C2%2C3%2C4%2C5');
});

// GitHub pagination must be followed so cards are not silently omitted from larger projects.
test('should follow GitHub pagination links for project items', async () => {
  let itemPage = 0;
  const transport: GitHubProjectTransport = (url) => {
    if (url.endsWith('/projectsV2/11')) {
      return Promise.resolve(jsonResponse({ node_id: 'p', title: 'Paged', owner: { login: 'nodejs' } }));
    }
    if (url.includes('/fields?')) {
      return Promise.resolve(
        jsonResponse([
          {
            id: 2,
            name: 'Status',
            data_type: 'single_select',
            options: [{ id: 'todo', name: { raw: 'Todo' }, color: 'GREEN' }],
          },
        ]),
      );
    }
    itemPage += 1;
    const next = itemPage === 1 ? '<https://api.github.com/page-two>; rel="next"' : null;
    return Promise.resolve(
      jsonResponse(
        [{ id: itemPage, node_id: `item-${itemPage}`, content: { title: `Card ${itemPage}` }, fields: [] }],
        next,
      ),
    );
  };

  const snapshot = await loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, { transport });
  expect(snapshot.cards.map(({ title }) => title)).toEqual(['Card 1', 'Card 2']);
});

test('should reject declared, actual, malformed, and oversized collection bodies', async () => {
  await expect(
    loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, {
      transport: () => Promise.resolve(textResponse('{}', String(4 * 1024 * 1024 + 1))),
    }),
  ).rejects.toThrow(/too large/u);

  await expect(
    loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, {
      transport: () => Promise.resolve(textResponse('x'.repeat(4 * 1024 * 1024 + 1), '1')),
    }),
  ).rejects.toThrow(/too large/u);

  await expect(
    loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, {
      transport: () => Promise.resolve(textResponse('{not json')),
    }),
  ).rejects.toThrow(/unreadable/u);

  let request = 0;
  await expect(
    loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, {
      transport: () => {
        request += 1;
        if (request === 1) return Promise.resolve(jsonResponse({ node_id: 'p', title: 'Large' }));
        return Promise.resolve(jsonResponse(Array.from({ length: 101 }, (_, id) => ({ id }))));
      },
    }),
  ).rejects.toThrow(/too large/u);
});

test('should enforce chunked and multibyte response bytes instead of trusting content length', async () => {
  const encoder = new TextEncoder();
  const oversized = encoder.encode('界'.repeat(Math.ceil((4 * 1024 * 1024 + 1) / 3)));
  await expect(
    loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, {
      transport: () =>
        Promise.resolve(streamResponse([oversized.subarray(0, 2_000_000), oversized.subarray(2_000_000)], '1')),
    }),
  ).rejects.toThrow(/too large/u);

  const project = encoder.encode(JSON.stringify({ node_id: 'p', title: '界' }));
  let request = 0;
  await expect(
    loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, {
      transport: () => {
        request += 1;
        if (request === 1) return Promise.resolve(streamResponse([project.subarray(0, 5), project.subarray(5)]));
        return Promise.resolve(jsonResponse([]));
      },
    }),
  ).rejects.toThrow(/Status field/u);
});

test('should preserve cancellation while a streamed response is being read', async () => {
  const aborted = new DOMException('cancelled', 'AbortError');
  const response: GitHubProjectHttpResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(aborted);
      },
    }),
  };
  await expect(
    loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, { transport: () => Promise.resolve(response) }),
  ).rejects.toBe(aborted);
});

test('should accept the exact per-response byte boundary and reject cumulative overflow', async () => {
  const exact = exactJsonRecord({ node_id: 'p', title: 'Boundary' }, 4 * 1024 * 1024);
  let request = 0;
  await expect(
    loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, {
      transport: () => {
        request += 1;
        if (request === 1) return Promise.resolve(streamResponse([exact], String(exact.byteLength)));
        return Promise.resolve(jsonResponse([]));
      },
    }),
  ).rejects.toThrow(/Status field/u);

  const fieldArray = exactJsonArray(
    {
      id: 2,
      name: 'Status',
      data_type: 'single_select',
      options: [{ id: 'todo', name: { raw: 'Todo' }, color: 'GREEN' }],
    },
    4 * 1024 * 1024,
  );
  const paddedItem = exactJsonArray(
    { id: 1, node_id: 'item', content: { title: 'Card' }, fields: [] },
    4 * 1024 * 1024,
  );
  let cumulativeRequest = 0;
  await expect(
    loadGitHubProject(DEFAULT_GITHUB_PROJECT_URL, {
      transport: () => {
        cumulativeRequest += 1;
        if (cumulativeRequest === 1) return Promise.resolve(streamResponse([exact]));
        if (cumulativeRequest === 2) return Promise.resolve(streamResponse([fieldArray]));
        return Promise.resolve(
          streamResponse(
            [paddedItem],
            undefined,
            cumulativeRequest < 10 ? '<https://api.github.com/next>; rel="next"' : null,
          ),
        );
      },
    }),
  ).rejects.toThrow(/too large/u);
});
