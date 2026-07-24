# Roadmap: Code Editor

> **Feature-Set**: Code Editor
> **Status**: Complete
> **Created**: 2026-07-23
> **Last Updated**: 2026-07-24 20:22
> **Progress**: 6 / 6 (100%)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|----|-------|----|------|-------|--------|--------------|----------------------|
| RD-01 | Editor surface and document lifecycle | [RD-01](requirements/RD-01-editor-surface-and-document-lifecycle.md) | [Plan](plans/code-editor/00-index.md) | Done | ✅ | 2026-07-24 | — |
| RD-02 | Local language features | [RD-02](requirements/RD-02-local-language-features.md) | [Plan](plans/code-editor/00-index.md) | Done | ✅ | 2026-07-24 | depends on RD-01 |
| RD-03 | Language server intelligence | [RD-03](requirements/RD-03-language-server-intelligence.md) | [Plan](plans/code-editor/00-index.md) | Done | ✅ | 2026-07-24 | depends on RD-01, RD-02 |
| RD-04 | Quality, security, and operability | [RD-04](requirements/RD-04-quality-security-and-operability.md) | [Plan](plans/code-editor/00-index.md) | Done | ✅ | 2026-07-24 | depends on RD-01…03 |
| RD-06 | Theme and syntax presentation | [RD-06](requirements/RD-06-theme-and-syntax-presentation.md) | [Plan](plans/code-editor/00-index.md) | Done | ✅ | 2026-07-24 | depends on RD-01…04 |
| RD-05 | Code Editor kitchen-sink | [RD-05](requirements/RD-05-code-editor-kitchen-sink.md) | [Plan](plans/code-editor/00-index.md) | Done | ✅ | 2026-07-24 | depends on RD-01…04, RD-06 |
| T-01 | Modern keyboard editing | — | [modern-keyboard-editing](plans/modern-keyboard-editing/99-execution-plan.md) | Done | ✅ | 2026-07-24 | depends on RD-01, RD-02, RD-05 |
