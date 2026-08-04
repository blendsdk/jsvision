import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

/** VitePress configuration for JSVision's developer-facing architecture record. */
export default withMermaid(
  defineConfig({
    title: 'JSVision — Technical Architecture',
    description: 'Architecture, design decisions, and developer guidance for JSVision.',
    themeConfig: {
      nav: [
        { text: 'Architecture', link: '/architecture/system-overview' },
        { text: 'Decisions', link: '/decisions/' },
        { text: 'Guides', link: '/guides/getting-started' },
        { text: 'Reference', link: '/reference/configuration' },
      ],
      sidebar: [
        {
          text: 'Overview',
          items: [{ text: 'Introduction', link: '/' }],
        },
        {
          text: 'Architecture',
          items: [
            { text: 'System overview', link: '/architecture/system-overview' },
            { text: 'Kanban architecture', link: '/architecture/kanban' },
            { text: 'Kanban data model', link: '/architecture/data-model' },
            { text: 'Kanban API design', link: '/architecture/api-design' },
            { text: 'Kanban security', link: '/architecture/security' },
          ],
        },
        {
          text: 'Decisions',
          items: [
            { text: 'Decision log', link: '/decisions/' },
            { text: 'ADR-006: Package and authority', link: '/decisions/ADR-006-kanban-package-authority' },
            { text: 'ADR-007: Responsive viewport', link: '/decisions/ADR-007-kanban-responsive-viewport' },
            { text: 'ADR-008: Query sessions', link: '/decisions/ADR-008-kanban-query-sessions' },
            { text: 'ADR-009: Atomic requests', link: '/decisions/ADR-009-kanban-atomic-requests' },
            { text: 'ADR-010: Board axes', link: '/decisions/ADR-010-kanban-board-axes' },
            { text: 'ADR-011: Card schema', link: '/decisions/ADR-011-kanban-card-schema' },
            { text: 'ADR-012: Saved views', link: '/decisions/ADR-012-kanban-saved-views' },
            { text: 'ADR-013: Bounded degradation', link: '/decisions/ADR-013-kanban-bounded-degradation' },
          ],
        },
        {
          text: 'Developer guides',
          items: [
            { text: 'Getting started', link: '/guides/getting-started' },
            { text: 'Development workflow', link: '/guides/development' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Configuration', link: '/reference/configuration' },
            { text: 'Integrations', link: '/reference/integrations' },
          ],
        },
      ],
    },
  }),
);
