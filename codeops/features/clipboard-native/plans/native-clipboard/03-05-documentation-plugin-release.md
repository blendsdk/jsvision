# Component: Documentation, Plugin, and Release Closure

> **Implements**: RD-03 R3.6–R3.11
> **Status**: Ready for execution
> **CodeOps Artifact Schema**: 1

## Consumer documentation

Document:

- canonical app-local clipboard ownership and optional raw host callbacks;
- application and direct event-loop configuration examples;
- ordinary `Ctrl+C`/`Ctrl+V`, terminal-owned shifted shortcuts, and bracketed-paste separation;
- async ordering and focus/modal/lifecycle discard behavior;
- 1 MiB UTF-8 bound, empty success, fallback, and payload-free diagnostics;
- `tvedit`/`clipboardy` platform helper limitations, headless/SSH behavior, and no auto-install policy;
- browser and OSC 52 compatibility without implying native read support where none is configured.

All public types/methods/properties/constants receive API documentation suitable for a new SDK
consumer. Durable source comments explain invariants without mentioning planning artifacts.

## Plugin impact workflow

1. Run the source-impact report for every changed mapped path.
2. Review each reported canonical reference under `tools/jsvision-skill/`.
3. Update canonical recipes/guidance where behavior or API changed.
4. Run `yarn plugin:update`; never edit the distributed plugin copy directly.
5. Inspect generated API pages, synchronized snippets, source-impact snapshot, and assembled skill.
6. Run `yarn plugin:check` and include generated changes in the same implementation commit.

## Release evidence

| Evidence | Required truth |
|---|---|
| Automated | Specification and implementation suites use injected adapters and pass. |
| Compatibility | Existing local/OSC/browser/bracketed-paste tests remain green. |
| Security | Sentinel clipboard/error content is absent from logs and snapshots. |
| Manual matrix | Attempted environments record observations; unavailable cells remain explicit. |
| Dependency | Version, Node engine, license, API, transitive diff, and platform notes rechecked. |
| Final gate | Clean focused checks, `yarn plugin:check`, and authoritative `yarn verify`. |

Issue closure or release publication is outside this plan's automatic authority.
