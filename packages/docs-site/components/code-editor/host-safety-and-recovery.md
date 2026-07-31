---
title: Code Editor host safety and recovery
description: Sanitize Code Editor terminal presentation, authorize save/navigation/close effects, handle service failure, suspend stale work, and recover deterministically.
---

# Host safety and recovery

An editor may request saving, closing, navigation, or language-service work; the host decides
whether those effects are allowed. Protocol and source-derived text must be validated before
terminal presentation, while failures and recovery remain visible in service state.

## Focused usage

```ts
import { formatCodeEditorDiagnosticOverlay } from '@jsvision/code-editor';

const overlay = controller.presentation.assistance.overlay;
const safeRows = overlay === undefined ? [] : formatCodeEditorDiagnosticOverlay(overlay, i18n, 60);
```

## Safe terminal text

Sanitize diagnostic, hover, completion, symbol, filename, and host-detail presentation at the final
terminal boundary. Keep the original payload as inert data only where it is genuinely needed, and
never write it directly as terminal control bytes.

<PlayExample id="code-editor/safe-terminal-text"
  title="Hostile protocol text"
  blurb="Project control-byte-laden diagnostic text into a clipped terminal-safe status without mutating the source payload."
/>

## Authorization and recovery

Denied effects must remain denied, failed sessions must stop publishing results, and recovery must
create a clean ready state. Record only content-free events such as “save rejected” or “service
recovered.”

<PlayExample id="code-editor/host-recovery"
  title="Authorized recovery path"
  blurb="Recover a failed in-process service through an explicit authorization step and inspect the bounded host event."
/>

## Limits and practices

- Allowlist host-effect kinds and check expected document revisions before acting.
- Never launch a process, connect to a network, or write a file merely because a demo requested it.
- Bound protocol arrays and text before they reach overlay or status layout.
- Cancel and dispose failed work before publishing a recovered coordinator/session.

## Related

- [Documents & lifecycle](/components/code-editor/documents-and-lifecycle) — own revision-aware
  external changes and saves.
- [Language intelligence](/components/code-editor/language-intelligence) — validate protocol-shaped
  services.
- [`clipCodeEditorDisplayText` API](/api/code-editor/functions/clipCodeEditorDisplayText) — generated
  presentation helper.
