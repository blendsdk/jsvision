# Task T-01: Prevent post-merge release drift

> **Type**: Task (lightweight) · **Feature**: _maintenance · **CodeOps Artifact Schema**: 1
> **Progress**: 4/4 tasks (100%)
> **Last Updated**: 2026-07-23 17:04
> **Phase baseline tree**: 456dba732e4d0d7a5a6243a32d23833e5b115527

## Objective

Make the version-bump preparation path regenerate and validate every derived Codex plugin artifact,
and run that exact non-publishing path automatically before a pull request can merge into `master`.
All repository changes are made on the current develop-based feature branch; neither implementation
nor verification writes to `master`.

## Resolved ambiguities

- The preflight runs only for pull requests whose base branch is `master`; ordinary feature PRs
  into `develop` retain the existing CI matrix.
- Release preparation has one shared repository command used by both the release workflow and the
  preflight, preventing the two sequences from drifting.
- Preparation runs the existing `plugin:update` before `plugin:check`. The preceding clean-tree
  verification establishes that release-time source changes are mechanical version updates.
- The preflight has no publish, commit, tag, push, write permission, or release secrets.
- Making the new status check required is a GitHub branch-protection administration step and is
  not represented as repository code.

## Tasks

- [x] T-01.1 Add specification tests for the shared release-preparation command, release workflow
  usage, and master-PR-only preflight trigger. ✅ (completed: 2026-07-23 16:59)
- [x] T-01.2 Run the focused specification tests and confirm the new expectations fail.
  ✅ (completed: 2026-07-23 16:59)
- [x] T-01.3 Implement the shared release preparation and master pull-request preflight.
  ✅ (completed: 2026-07-23 17:00)
- [x] T-01.4 Run focused validation, plugin integrity checks, workflow validation, and `yarn verify`.
  ✅ (completed: 2026-07-23 17:04)

**Verify**: `yarn verify`
