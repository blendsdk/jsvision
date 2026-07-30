---
title: In production
description: Package, deploy, observe, and support a Node or Bun ESM terminal application with evidence-based operational controls.
---

# In production

## Who is this course for?

This course is for developers preparing a JSVision application for real users and operators. First
complete [Crash safety & terminal restore](/guide/crash-safety),
[Untrusted text & terminal injection](/guide/untrusted-text), and
[Terminal capabilities & portability](/guide/terminal-capabilities). We assume that you can build
an application, distinguish trusted from untrusted display text, and explain capability resolution.

By the end you will build a reproducible Node release, explain the boundary between application and
supervisor ownership, diagnose startup and support failures, and verify a release with current
operational evidence. The motivating problem is not merely “does the program start?” It is “can we
ship this exact artifact, restore the user's terminal after failure, and support the environments
we promise?”

The beginner boundary is one deployable Node 22+ ESM artifact. Intermediate work covers terminal
ownership, bounded restart, diagnostics, and compatibility. Advanced work turns those controls into
dated release decisions without promoting experiments into promises.

## What is the production-readiness mental model?

A production release is a chain of owners and evidence:

```text
build artifact → runtime process → controlling terminal/TTY
      ↓                 ↓                    ↓
 reproducibility   supervision         restore + capabilities
      └──────────────────→ evidence → support promise
```

The package owner proves what was built. The runtime or process owner starts that artifact. The
application and host own terminal restore and cleanup; the supervisor owns restart after the child
has finished cleanup. Finally, a named support owner scopes each claim to a version, environment,
and evidence date.

Treat release readiness as a go/no-go decision. Every blocking concern needs pass, fail, or warning
evidence tied to one release identifier. A reproducible lockfile and provenance describe the
artifact; they do not prove that its terminal, security, compatibility, or support controls work.

| Layer            | Owner                   | Required evidence                          |
| ---------------- | ----------------------- | ------------------------------------------ |
| Build artifact   | Release pipeline        | version, commit, digest, frozen lockfile   |
| Runtime process  | Launcher and supervisor | runtime version, exit reason, restart path |
| Terminal and TTY | JSVision app and host   | attachment, capabilities, restore trace    |
| Operations       | Service owner           | diagnostics, security and freshness checks |
| Support promise  | Product owner           | tested matrix, date, response boundary     |

## How do I get the first deployable result?

Make Node 22+ and ESM explicit, build into `dist`, and launch the built entry rather than TypeScript
source. A minimal application package has this shape:

```json
{
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js"
  }
}
```

Use the public package entries and let the application runner own terminal cleanup:

```ts
import process from 'node:process';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

const app = createApplication({
  caps: resolveCapabilities().profile,
});

process.exitCode = await app.run();
```

`await app.run()` restores raw mode, the alternate screen, and cursor policy through its host
cleanup path. A successful local launch is only the first result; record the artifact version,
commit, and digest before calling it deployable.

## What operational evidence replaces a browser laboratory?

An embedded browser terminal cannot honestly reproduce a real controlling TTY, operating-system
supervision, container security, signal delivery, or deployment. This course therefore has no
`PlayExample`. It uses authentic substitutes that can run, be verified, and produce an observable
expected result:

| Artifact                                                     | Learning objective                    | Expected observation                                                |
| ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------- |
| `src/example-fixtures/in-production/supervisor-policy.json`  | Inspect bounded process policy        | Three delayed attempts, then operator action                        |
| `src/example-fixtures/in-production/supervisor-decision.ts`  | Execute policy against child exits    | Clean and permanent exits stop; a bounded crash loop opens          |
| `src/example-fixtures/in-production/production-readiness.ts` | Make a deterministic release decision | Missing, failed, or stale evidence produces no-go                   |
| `src/example-fixtures/in-production/bounded-diagnostics.ts`  | Build a secret-free support sample    | Fixed-size records contain no input payload                         |
| `test/in-production-example.spec.test.ts`                    | Execute the substitute evidence       | Ship, startup, crash-loop, redaction, and freshness assertions pass |

Run the artifact test and observe both sides of each decision:

```ts
const result = assessProductionReadiness(releaseId, evidence, {
  assessedAt: releaseClock,
  maxAgeMs: evidenceAgeLimit,
});
```

`assessProductionReadiness` belongs to the linked course fixture, not the SDK package; import the
equivalent from your own operations module in a real project. The abbreviated snippet names the
boundary while the artifact contains the executable implementation.

## How do I package a Node ESM application?

JSVision's current package contract is ESM-only with Node `>=22`. Keep `@jsvision/core` and
`@jsvision/ui` on the same version or lockstep pin, import their public package entry points, and
never depend on an internal `src`, `dist`, or engine path.

Use a frozen lockfile or immutable install, run the build and verification from that dependency
graph, and archive the resulting `dist` artifact with its checksum, version, and commit. Verify the
archive after unpacking rather than trusting the workspace that produced it.

```ts
import { VERSION } from '@jsvision/core';

const releaseIdentity = {
  sdkVersion: VERSION,
  artifactDigest: 'sha256:<from-release-pipeline>',
  commit: '<source-commit>',
};
```

`require()` and CommonJS entry points are unsupported. If a CommonJS launcher must cross the
boundary, use dynamic `import()` to load the ESM application; do not manufacture an undocumented
deep import. The [ESM and zero-dependency decision](/reference/decisions/ADR-001-esm-zero-dependency)
explains the package boundary.

## When is a Bun deployment claim justified?

[ADR-009](/reference/decisions/ADR-009-bun-runtime-support) is **Proposed**. Its recorded
observations do not create a guarantee or support promise. Current package manifests declare a Node
engine and no Bun engine, so Node is the contractual baseline.

`bun build --compile` can produce a target binary or executable with an embedded runtime. That
changes the artifact: bundled source and runtime affect size, signing, scanning, patch response,
and provenance. Record those properties instead of treating the binary like the Node `dist` tree.

```ts
import { VERSION } from '@jsvision/core';

const bunObservation = {
  sdkVersion: VERSION,
  runtime: 'Bun 1.x',
  evidenceDate: 'YYYY-MM-DD',
  checks: ['PTY', 'restore', 'signal forwarding', 'packaged binary'],
};
```

Before making a bounded Bun claim, test current CI and a real PTY, restore paths, signal handling,
and the compiled artifact across the recorded environment matrix. Do not turn a proposed
experiment or dated observation into a guarantee. Re-run it for every supported release.

## How do I preserve terminal and signal ownership?

A controlling TTY must remain attached and preserved for the deployed process. A detached,
background, or non-TTY launch should fail preflight when `requireTty` is true; silently starting
cannot create an interactive terminal later.

Forward `SIGINT`, `SIGTERM`, and `SIGHUP` from the supervisor to the child application. Give the
child a grace period to leave raw mode, restore the alternate screen, and normalize the cursor
before any forced termination.

```ts
import process from 'node:process';
import { createApplication } from '@jsvision/ui';

const app = createApplication({ requireTty: true });
const code = await app.run();
process.exitCode = code;
```

Choose one terminal lifecycle owner. `Application.run()` is that owner for a normal application;
do not add a competing restore sequence in a wrapper. The supervisor waits and observes—it does
not write terminal escape sequences on the application's behalf.

A shutdown timeout or `TimeoutStopSec` must leave room for clean restore before force. `SIGKILL`
(or `kill -9`) cannot run a handler and therefore cannot perform cleanup. It is a final containment
mechanism, never the ordinary shutdown path.

## How do I supervise without creating a crash loop?

Restart on a classified failure or non-zero exit, never after a clean zero or normal operator stop.
Use delayed backoff, a rolling window, and a maximum attempt limit. When the crash-loop limit opens,
stop and require manual investigation.

```ts
const restartPolicy = {
  mode: 'on-failure',
  maxAttempts: 3,
  windowSeconds: 60,
  backoffSeconds: [1, 5, 15],
} as const;
```

The linked `supervisor-decision.ts` evaluator executes those rules without sleeping or starting a
process. Its artifact tests prove first and third backoff, breaker opening, clean stop, and permanent
startup stop against the JSON policy.

Classify startup or preflight failures such as missing TTY, invalid configuration, denied
permission, or absent artifact as permanent until an operator changes the environment; do not
restart them. Classify each exit reason as deploy error, operator stop, application defect, or host
failure before applying policy.

A health check that says only “process alive” is not enough for an interactive terminal. Readiness
also requires a valid attachment, usable input, and a terminal whose capabilities match the
selected fallback.

## How do I collect bounded, redacted diagnostics?

`createLogger()` writes to a ring, file, or safe stderr destination. Give a ring an explicit,
positive size with a defensive maximum, or give files retention and rotation. The course artifact
clamps requests to 1–256 records. `console.log()` or direct stdout can corrupt the active UI because
it scribbles outside the renderer.

```ts
import { createLogger, redactEvent } from '@jsvision/core';

const logger = createLogger({ sink: 'ring', size: 128 });
logger.debug('input', 'event', redactEvent(event));
const supportRecords = logger.entries();
logger.close();
```

`redactEvent()` removes printable characters and paste payloads; the retained structural event must
never contain user text. `sanitize()` serves a different boundary: it makes untrusted display text
inert by removing terminal control bytes, but it is not redaction and does not make a value safe to
retain.

```ts
import { sanitize } from '@jsvision/core';
import { signal, Text } from '@jsvision/ui';

const safeStatus = signal('');
const statusView = new Text(() => safeStatus());

safeStatus.set(sanitize(untrustedStatus));
```

Allowlist fields such as release ID and a closed display category. Never retain caller-authored
display text merely because it was sanitized. Omit or redact tokens, secrets, paths, environment
values, and user text. Set diagnostic retention, rotation, and expiry before an incident, then
delete support bundles when their purpose expires.

## How do capability snapshots support an incident?

Evaluate the essential interactive TTY before starting. Missing TTY is a hard failure; missing
mouse, colour, or alternate screen is a supported degradation to keyboard-only, monochrome, or
inline mode.

```ts
import { evaluateEssentials, resolveCapabilities } from '@jsvision/core';

const resolution = resolveCapabilities();
const essentials = evaluateEssentials(resolution.profile, { isTTY });
if (!essentials.met) {
  throw new Error(`Missing: ${essentials.missing.join(', ')}`);
}
```

After `evaluateEssentials()`, the interactive TTY is either met or named in `missing`; optional
capabilities are reported separately as degradations.

Add a capability snapshot to an incident ticket or support bundle. `dumpCaps()` reports each
profile value with its reason layer or provenance and is safe and secret-free; it does not include
environment secrets or input payloads. That capability reason provenance lets support diagnose
which resolution layer selected the unexpected value.

```ts
import { createLogger, dumpCaps, resolveCapabilities } from '@jsvision/core';

const logger = createLogger({ sink: 'ring', size: 32 });
logger.info('capabilities', dumpCaps(resolveCapabilities()));
```

Compare reason provenance when the wrong capability appears. Verify SSH, tmux, screen, Windows, and
the terminals in your support matrix with dated evidence. A fallback or degraded presentation is
not a failure and is not automatically unsupported; it is a deliberate mode when interaction
remains complete.

## How do I set security expectations?

Zero runtime dependencies reduce one supply-chain surface, but that does not secure the app,
authorize host capabilities, or harden a container. Follow the
[security architecture](/reference/architecture/security) and apply least privilege to the whole
deployment.

Containers and sandboxes need explicit access to the TTY device they require and no broader
filesystem or network capability than the application needs. Run as a non-root identity, keep
secrets outside diagnostics, validate external input, and record who authorizes clipboard,
filesystem, process, and network operations.

```ts
import { sanitize } from '@jsvision/core';

function supportLabel(externalLabel: string): string {
  const bounded = Array.from(externalLabel).slice(0, 80).join('');
  return sanitize(bounded);
}
```

Sanitization protects the display boundary. It does not replace authorization, isolation,
encryption, secret management, or data-retention policy.

## How do I scope compatibility and support promises?

A compatibility statement names runtime, OS, terminal, package version, tested interaction, and
test date. “Works everywhere” is not evidence. Keep a matrix that separates contractual support,
tested observation, degraded-but-usable behavior, and unsupported combinations.

| Claim            | Minimum scope                                                            |
| ---------------- | ------------------------------------------------------------------------ |
| Node support     | Node version, OS, terminal, JSVision version, date                       |
| Bun observation  | Bun version, PTY, source or compiled mode, restore/signal evidence, date |
| Terminal support | emulator/version, local or remote layer, capabilities and fallback       |
| Support policy   | owner, response boundary, reproduction data, maintained versions         |

A support promise needs an owner who can reproduce a report with the named release evidence and who
knows when a version leaves the maintained window.

## How do I use performance evidence?

Use the repository's performance evidence to detect regressions, not to invent a universal promise.
The [performance benchmark decision](/reference/decisions/ADR-006-informational-perf-bench)
describes median and p95 frame evidence around a 16 ms informational budget. Results depend on
environment, hardware, terminal, workload, and contention.

```ts
const performanceEvidence = {
  metric: 'frame time',
  statistics: ['median', 'p95'],
  budgetMs: 16,
  scope: 'recorded hardware and fixture only',
};
```

A benchmark is not an SLA, guarantee, or universal capacity figure. Record fixture size, runtime,
hardware, terminal, commit, and whether the runner was contended. Compare like with like and
investigate a regression before widening the supported workload.

## How do I make a release-readiness decision?

The `production-readiness.ts` artifact models each concern as pass, warn, or fail with a reason.
Warnings block by default. Shipping one requires a named owner, acceptance reason, and acceptance
time valid for that evidence. It requires an injected `assessedAt` clock and maximum age, making the
result deterministic in CI and review.

```ts
const policy = {
  assessedAt: releaseClock,
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
};

const result = assessProductionReadiness(releaseId, evidence, policy);
if (result.decision === 'no-go') blockRelease(result.checks);
```

Tie evidence to the release identifier—version, commit, and artifact digest. Reject duplicate
evidence rather than letting input order choose between pass and fail. Ship only when all required
blocking checks pass or have an explicitly accepted fresh warning. An unaccepted warning or a
missing, duplicate, failed, or stale blocking check is no-go: do not ship.

## How do I keep operational evidence fresh?

Every item has `recordedAt`; the release assessment supplies the deterministic clock rather than
calling ambient time. Define a maximum age or freshness limit by evidence class. Compatibility,
security, performance, and restore evidence can all become stale when code, runtime, environment,
or policy changes.

```ts
const age = assessedAt - evidence.recordedAt;
const freshness = age <= maxAgeMs ? 'fresh' : 'stale';
if (freshness === 'stale') rerunTheOwningCheck();
```

Treat future timestamps as invalid, expire old diagnostics, and rerun the owning check after any
relevant change. A release dashboard that preserves green results forever is hiding uncertainty,
not reducing it.

## What belongs in advanced production work?

Advanced teams automate signed artifact provenance, generate a runtime/OS/terminal compatibility
matrix, rehearse restoration under signals in real PTYs, and test container or sandbox
authorization. They also version supervisor policy, retention policy, and support windows alongside
the application.

Keep the decision boundary observable: every claim has an owner, scope, date, environment, version,
and correction path. Promotion from experimental runtime evidence to supported status is a product
and engineering decision backed by current CI and incident capability, not a wording change.

## How do I diagnose production failures?

Start with the symptom, then collect only the evidence that distinguishes plausible causes.

| Symptom                                       | Likely cause                                     | Correction                                               | Distinguishing evidence                           |
| --------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------- |
| failed startup on non-TTY                     | No controlling terminal attachment               | Allocate a PTY or honor `requiresTty` and stop           | TTY allocation and preflight result               |
| crash loop                                    | Permanent startup failure is being restarted     | Open the bounded breaker and require operator action     | attempt window, backoff, classified exit          |
| terminal remains in raw mode or cursor hidden | Forced exit or competing lifecycle owner         | Forward signals, extend grace, keep one restore owner    | restore trace and supervisor signal timeline      |
| diagnostic leak contains a secret             | Raw event or broad object was logged             | Use `redactEvent`, an allowlist, and bounded retention   | serialized ring contains structure but no payload |
| wrong capability selected                     | Environment, query, or override won unexpectedly | Compare profile reason provenance and correct that layer | `dumpCaps` snapshot from the affected terminal    |
| stale evidence shows green                    | Freshness was not bound to the release clock     | Fail the check and rerun its owner                       | recorded time, maximum age, release digest        |

Two failures can look alike. A process that exits immediately may have a non-TTY attachment, a
missing artifact, or an application defect; its preflight and classified exit distinguish them. A
damaged shell after exit requires a restore trace, while a merely degraded inline display requires
capability evidence.

## What are the best practices?

- Pin JSVision packages in lockstep because mixed SDK versions weaken the tested package boundary.
- Build from a frozen lockfile so that the artifact can be reproduced from its recorded source.
- Attach version, commit, and digest to evidence; otherwise a passing check may describe another build.
- Preserve one terminal lifecycle owner because competing restore logic creates ordering failures.
- Forward graceful signals and delay forced termination so that `Application.run()` can restore.
- Bound restart attempts with backoff; otherwise a permanent startup error becomes a crash loop.
- Use screen-safe bounded logging because stdout diagnostics can corrupt the active terminal UI.
- Redact input and allowlist fields so that support evidence cannot retain user payloads or secrets.
- Date compatibility and performance claims because runtime and terminal behavior can drift.
- Block missing, failed, or stale controls; otherwise the readiness decision only records optimism.

## What should I practice next?

1. Run `test/in-production-example.spec.test.ts` and explain why each failing variant is no-go.
2. Change `supervisor-policy.json` to model your launcher, then verify bounded backoff and grace.
3. Add a release digest to the readiness fixture and reject evidence for a different artifact.
4. Capture `dumpCaps()` across SSH, tmux, screen, Windows, and one monochrome fallback.
5. Rehearse `SIGINT`, `SIGTERM`, and `SIGHUP` against a real PTY and record the restore trace.
6. Define maximum ages for security, compatibility, performance, restore, and support evidence.

Continue with [Build a complete application](/guide/complete-application) to compose these
production controls into one release workflow. For exact symbols, see
[`createLogger()`](/api/core/functions/createLogger),
[`evaluateEssentials()`](/api/core/functions/evaluateEssentials), and
[`dumpCaps()`](/api/core/functions/dumpCaps).
