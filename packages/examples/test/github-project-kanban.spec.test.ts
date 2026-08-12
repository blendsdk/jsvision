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
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (name) => (name.toLocaleLowerCase() === 'link' ? link : null) },
    json: () => Promise.resolve(body),
  };
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
