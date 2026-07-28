# Clipboard Consistency Ambiguity Register

> **Status**: Resolved
> **Last Updated**: 2026-07-27
> **CodeOps Artifact Schema**: 1

| ID | Category | Decision | Status | Affects |
|----|----------|----------|--------|---------|
| AR-01 | runtime | Normalize pasted text to the target document's established line-ending style. A document without an established style and a mixed-ending document use LF, matching their existing newline insertion policy. The canonical clipboard and host mirror retain the exact raw text. | Resolved — user approved recommendation on 2026-07-27 | T-03.4, T-03.5, T-03.6 |
