# Cross-Platform Function Keys Implementation Plan

> **Feature**: Canonical F1–F12 input across native terminals and xterm.js, with portable number-row fallbacks
> **Status**: Planning Complete
> **Created**: 2026-07-23
> **CodeOps Artifact Schema**: 1

## Overview

JSVision already models F1–F12 and recognizes the primary xterm sequences, but the decoder omits
other established encodings, the browser adapter relies on xterm.js byte synthesis, and applications
have no portable fallback when an outer layer reserves a physical function key.

This plan expands the bounded keyboard grammar, normalizes the approved number-row aliases at the UI
event boundary, and lets a DOM-capable xterm.js terminal dispatch physical function keys directly.
The UI continues to consume one platform-neutral `KeyEvent`; low-level decoding remains faithful to
the received key and existing applications can opt out of aliases. See AR-2, AR-4, and AR-5.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Confirmed behavior, scope, and compatibility decisions |
| PF | [Preflight Report](00-preflight-report.md) | Post-creation adversarial audit |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | Owning feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Codebase-grounded implementation analysis |
| 03-01 | [Terminal Decoder](03-01-terminal-decoder.md) | Native byte grammar and canonical events |
| 03-02 | [Fallback Policy](03-02-fallback-policy.md) | UI normalization and public configuration |
| 03-03 | [Browser Integration](03-03-browser-integration.md) | xterm.js pre-encoding interception |
| 03-04 | [Documentation and Distribution](03-04-documentation-and-distribution.md) | Consumer guidance, changelogs, and plugin synchronization |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Specification-first task sequence |

## Quick Reference

### Usage Example

```ts
import { createApplication } from '@jsvision/ui';

// Default: Alt+1…0,-,= provide F1…F12.
const portable = createApplication();

// Preserve genuine Alt+number-row chords.
const literalAlt = createApplication({ functionKeyFallback: 'none' });
```

### Key Decisions

| Decision | Outcome | AR Ref |
|----------|---------|--------|
| Alias set | `Alt+1…9,0,-,=` maps to F1–F12 | AR-2 |
| Escape timing | Preserve the existing 50 ms disambiguation window | AR-3 |
| Decoder scope | Standard F1–F12 legacy, Linux-console, modified, and CSI-u forms | AR-4, AR-8 |
| Browser input | Direct focused `keydown` canonicalization with byte fallback | AR-5 |
| Guarantee | Actions remain accessible; physical capture is best effort | AR-6 |
| Compatibility | Default-on UI policy with an explicit `'none'` opt-out | AR-7 |

## Related Files

- `packages/core/src/engine/input/keys.ts`
- `packages/core/src/engine/input/events.ts`
- `packages/core/src/engine/input/index.ts`
- `packages/core/src/engine/index.ts`
- `packages/ui/src/event/event-loop.ts`
- `packages/ui/src/event/types.ts`
- `packages/ui/src/app/application.ts`
- `packages/web/src/host.ts`
- `packages/web/src/mount.ts`
- `packages/web/src/key-reclaim.ts`
- `packages/docs-site/guide/keyboard-and-clipboard.md`
- `tools/jsvision-skill/references/api/core-essentials.md`
- `tools/jsvision-skill/references/api/app-shell.md`
- `tools/jsvision-skill/references/api/web.md`
