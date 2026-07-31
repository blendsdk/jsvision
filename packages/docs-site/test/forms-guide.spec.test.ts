/**
 * Immutable oracle for the Forms course and its two laboratories.
 *
 * Public-control assertions prove the form store, bindings, validation, submission, loading, and
 * cleanup semantics before the teaching page and laboratories exist. The remaining assertions
 * describe the complete learner-visible result.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveCapabilities } from '@jsvision/core';
import { FormFieldError, bindCheck, bindField, bindRadio, createForm, formDialog } from '@jsvision/forms';
import type { AsyncValidator } from '@jsvision/forms';
import { Button, Group, Input, View, createEventLoop, createRoot } from '@jsvision/ui';
import { z } from 'zod';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const guidePath = fileURLToPath(new URL('../guide/forms.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'forms');
const stateLabId = 'guides/form-state-validation';
const asyncLabId = 'guides/form-async-submit';
const labIds = [stateLabId, asyncLabId] as const;

interface FormStateValidationPanel extends View {
  readonly lessonName: 'Form state and validation';
  readonly validSubmissions: number;
  readonly invalidSubmissions: number;
  readonly resetCount: number;
  readonly nameInput: Input;
  readonly portInput: Input;
}

interface FormAsyncSubmitPanel extends View {
  readonly lessonName: 'Async form submission';
  readonly validationRuns: number;
  readonly abortedValidations: number;
  readonly staleValidationResults: number;
  readonly acceptedValidationResults: number;
  readonly successfulSubmissions: number;
  readonly failedSubmissions: number;
  readonly cleanupCount: number;
  pendingManualRuns(): number;
}

function isFormStateValidationPanel(view: View): view is FormStateValidationPanel {
  return (
    view.constructor.name === 'FormStateValidationPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Form state and validation' &&
    'validSubmissions' in view &&
    typeof view.validSubmissions === 'number' &&
    'invalidSubmissions' in view &&
    typeof view.invalidSubmissions === 'number' &&
    'resetCount' in view &&
    typeof view.resetCount === 'number' &&
    'nameInput' in view &&
    view.nameInput instanceof Input &&
    'portInput' in view &&
    view.portInput instanceof Input
  );
}

function isFormAsyncSubmitPanel(view: View): view is FormAsyncSubmitPanel {
  return (
    view.constructor.name === 'FormAsyncSubmitPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Async form submission' &&
    'validationRuns' in view &&
    typeof view.validationRuns === 'number' &&
    'abortedValidations' in view &&
    typeof view.abortedValidations === 'number' &&
    'staleValidationResults' in view &&
    typeof view.staleValidationResults === 'number' &&
    'acceptedValidationResults' in view &&
    typeof view.acceptedValidationResults === 'number' &&
    'successfulSubmissions' in view &&
    typeof view.successfulSubmissions === 'number' &&
    'failedSubmissions' in view &&
    typeof view.failedSubmissions === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number' &&
    'pendingManualRuns' in view &&
    typeof view.pendingManualRuns === 'function'
  );
}

function statePanelIn(dialog: View): FormStateValidationPanel {
  const panels = viewsIn(dialog).filter(isFormStateValidationPanel);
  expect(panels).toHaveLength(1);
  const panel = panels[0];
  if (panel === undefined) throw new Error('Form-state laboratory is missing its teaching panel');
  return panel;
}

function asyncPanelIn(dialog: View): FormAsyncSubmitPanel {
  const panels = viewsIn(dialog).filter(isFormAsyncSubmitPanel);
  expect(panels).toHaveLength(1);
  const panel = panels[0];
  if (panel === undefined) throw new Error('Async-form laboratory is missing its teaching panel');
  return panel;
}

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
}

function registryEntry(id: string) {
  return EXAMPLES.find((candidate) => candidate.id === id);
}

async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = registryEntry(id);
  if (entry === undefined) throw new Error(`Missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

function resizeDialog(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): void {
  const origin = absoluteOrigin(dialog);
  const from = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: from,
    to: { x: from.x + 10, y: from.y + 4 },
  });
}

function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`Laboratory is missing "${label}"`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function controlledValidator(): {
  readonly validator: AsyncValidator<string>;
  readonly values: string[];
  readonly signals: AbortSignal[];
  resolve(index: number, message: string | null): void;
  reject(index: number, reason: unknown): void;
} {
  const values: string[] = [];
  const signals: AbortSignal[] = [];
  const runs: Array<ReturnType<typeof deferred<string | null>>> = [];
  const validator: AsyncValidator<string> = (value, { signal }) => {
    values.push(value);
    signals.push(signal);
    const run = deferred<string | null>();
    runs.push(run);
    return run.promise;
  };
  return {
    validator,
    values,
    signals,
    resolve: (index, message) => runs[index]?.resolve(message),
    reject: (index, reason) => runs[index]?.reject(reason),
  };
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Forms course contract', () => {
  test('should publish the completed catalog course with exact prerequisites, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Forms',
      page: '/guide/forms',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['reactive-state', 'dialogs-and-modality', 'async-work'],
      learningOutcomes: [
        'Build typed form state, field bindings, validation, submission, and reset workflows.',
        'Coordinate async validation and loading while preserving honest user feedback.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [stateLabId, asyncLabId],
    });
  });

  test('should state the learner contract and follow the complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the form mental model?',
      '## How do I build the first useful form?',
      '## How do raw and coerced values stay typed?',
      '## How do bindings, touched, and dirty state work?',
      '## How do synchronous and cross-field errors work?',
      '## How do submit, reset, and load change state?',
      '## Laboratory: form state and validation',
      '## How does asynchronous validation stay current?',
      '## How do async submission, failure, and retry work?',
      '## Laboratory: async form submission',
      '## How do forms compose with Form Dialog?',
      '## What changes across advanced lifecycle boundaries?',
      '## How do I diagnose form failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+typed.+form.+validation.+(?:async|submission|loading).+$/imu);
    expect(source).toMatch(
      /\bbuild\b[\s\S]{0,500}\bexplain\b[\s\S]{0,500}\bdiagnos(?:e|is)\b[\s\S]{0,500}\bverify\b/iu,
    );
    expect(source).toMatch(
      /(?:assume|already know|comfortable with)[\s\S]{0,500}(?:reactive state|dialog|async work)/iu,
    );
    expect(source).toContain(`<PlayExample id="${stateLabId}"`);
    expect(source).toContain(`<PlayExample id="${asyncLabId}"`);
  });

  test('should teach the raw store, typed output, direct bindings, and interaction state', () => {
    expect(source).toMatch(
      /field\(.+\)\.value[\s\S]{0,450}(?:raw|editing)[\s\S]{0,300}(?:stable|same)[\s\S]{0,180}Signal/iu,
    );
    expect(source).toMatch(/rawValues\(\)[\s\S]{0,350}(?:always|invalid)[\s\S]{0,300}values\(\)[\s\S]{0,250}null/iu);
    expect(source).toMatch(/z\.coerce\.(?:number|boolean)[\s\S]{0,350}(?:string|raw)[\s\S]{0,300}(?:number|typed)/iu);
    expect(source).toMatch(/new Input\([\s\S]{0,250}value:\s*(?:field|form\.field).+\.value/iu);
    expect(source).toMatch(/bindField\([\s\S]{0,350}(?:blur|focus leaves)[\s\S]{0,250}touched/iu);
    expect(source).toMatch(/touched[\s\S]{0,350}(?:first blur|submit)[\s\S]{0,350}dirty[\s\S]{0,300}baseline/iu);
    expect(source).toMatch(/bindRadio\([\s\S]{0,400}(?:domain|index)/iu);
    expect(source).toMatch(/bindCheck\([\s\S]{0,400}(?:selected|flags|domain)/iu);
  });

  test('should teach synchronous field and form validation without hiding Zod issue identity', () => {
    expect(source).toMatch(/field.+error\(\)[\s\S]{0,350}(?:ZodIssue|synchronous)[\s\S]{0,250}(?:first|path)/iu);
    expect(source).toMatch(/form\.errors\(\)[\s\S]{0,400}(?:path-less|cross-field|object-level)/iu);
    expect(source).toMatch(/(?:refine|superRefine)[\s\S]{0,450}(?:cross-field|form-level|path)/iu);
    expect(source).toMatch(/error\(\)[\s\S]{0,350}(?:not gated|independent)[\s\S]{0,200}touched/iu);
    expect(source).toMatch(/FormFieldError[\s\S]{0,350}(?:unknown|foreign)[\s\S]{0,250}field/iu);
    expect(source).toMatch(
      /(?:async refinement|safeParseAsync)[\s\S]{0,450}(?:unsupported|do not|cannot)[\s\S]{0,250}asyncValidators/iu,
    );
  });

  test('should teach submit, reset, atomic latest-wins load, and distinct busy states', () => {
    expect(source).toMatch(/submit\([\s\S]{0,450}(?:touches|mark)[\s\S]{0,250}(?:every|all)[\s\S]{0,200}field/iu);
    expect(source).toMatch(
      /(?:sync-invalid|synchronously invalid)[\s\S]{0,400}(?:short-circuit|does not run)[\s\S]{0,250}async/iu,
    );
    expect(source).toMatch(/onValid[\s\S]{0,350}(?:coerced|typed)[\s\S]{0,250}(?:await|Promise)/iu);
    expect(source).toMatch(
      /submitting\(\)[\s\S]{0,450}(?:synchronously|immediately)[\s\S]{0,250}(?:finally|all paths)/iu,
    );
    expect(source).toMatch(
      /reset\(\)[\s\S]{0,400}baseline[\s\S]{0,250}(?:touched|dirty)[\s\S]{0,180}(?:clear|false)/iu,
    );
    expect(source).toMatch(
      /load\([\s\S]{0,400}(?:atomic|whole record)[\s\S]{0,300}(?:rebase|baseline)[\s\S]{0,250}pristine/iu,
    );
    expect(source).toMatch(/load\([\s\S]{0,500}(?:latest|newer|supersed)[\s\S]{0,300}(?:abort|stale|drop)/iu);
    expect(source).toMatch(
      /loading\(\)[\s\S]{0,400}validating\(\)[\s\S]{0,400}submitting\(\)[\s\S]{0,250}(?:distinct|different)/iu,
    );
  });

  test('should teach async debounce, forced validation, rejection safety, and disposal', () => {
    expect(source).toMatch(/AsyncValidator[\s\S]{0,350}(?:raw|editing).+AbortSignal/iu);
    expect(source).toMatch(/asyncDebounceMs[\s\S]{0,300}(?:300|default)[\s\S]{0,300}(?:coalesce|debounce)/iu);
    expect(source).toMatch(/(?:generation|supersed)[\s\S]{0,450}abort[\s\S]{0,300}(?:stale|drop|ignore)/iu);
    expect(source).toMatch(/asyncError\(\)[\s\S]{0,350}(?:separate|distinct)[\s\S]{0,250}error\(\)/iu);
    expect(source).toMatch(/isValid\(\)[\s\S]{0,450}optimistic[\s\S]{0,250}(?:pending|in flight)/iu);
    expect(source).toMatch(/submit\([\s\S]{0,500}(?:force-runs|forced)[\s\S]{0,250}async[\s\S]{0,250}(?:await|gate)/iu);
    expect(source).toMatch(
      /(?:reject|throw)[\s\S]{0,450}(?:validator|AsyncValidator)[\s\S]{0,350}(?:no async error|clean)[\s\S]{0,350}(?:catch|safe failure|Could not verify)/iu,
    );
    expect(source).toMatch(/onValid[\s\S]{0,400}(?:reject|throw)[\s\S]{0,300}(?:rethrow|propagat)[\s\S]{0,250}retry/iu);
    expect(source).toMatch(/dispose\(\)[\s\S]{0,400}(?:idempotent|more than once)[\s\S]{0,300}(?:dialog|async)/iu);
  });

  test('should keep snippets public, focused, typed, and lifecycle-safe', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(
        /(?:demoApp|Template1Dialog|defineExample|packages\/(?:forms|ui|core)\/src|@jsvision\/forms\/src)/u,
      );
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/forms', '@jsvision/ui', 'zod']).toContain(imported[1]);
      }
    }
    const joined = code.join('\n');
    for (const publicName of [
      'createForm',
      'bindField',
      'bindRadio',
      'bindCheck',
      'FormFieldError',
      'formDialog',
      'z',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${publicName}\\b`, 'u'));
    }
    expect(code.some((snippet) => /z\.coerce\.[a-z]+[\s\S]*rawValues\(\)[\s\S]*values\(\)/u.test(snippet))).toBe(true);
    expect(
      code.some((snippet) => /asyncValidators[\s\S]*AbortSignal|async\s*\(.+,\s*\{\s*signal\s*\}/u.test(snippet)),
    ).toBe(true);
    expect(
      code.some((snippet) => /try[\s\S]*await[\s\S]*catch[\s\S]*(?:verify|availability|retry)/iu.test(snippet)),
    ).toBe(true);
    expect(code.some((snippet) => /dispose\(\)/u.test(snippet))).toBe(true);
    expect(source).not.toMatch(/\b[A-Za-z_$][\w$]*\.disabled\s*=/u);
    expect(source).toMatch(/new Button\(['"]~S~ave['"][\s\S]{0,250}disabled:\s*\(\)\s*=>\s*form\.submitting\(\)/u);
  });

  test('should diagnose failures and close with safe, accessible practice and owning links', () => {
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    for (const failure of [
      /values\(\).+null[\s\S]{0,400}(?:rawValues|field.+error)/iu,
      /(?:error hidden|no error)[\s\S]{0,400}(?:touched|blur|submit)/iu,
      /(?:stale|wrong)[\s\S]{0,400}(?:generation|AbortSignal|supersed)/iu,
      /(?:reset|baseline)[\s\S]{0,400}(?:load|rebase)/iu,
      /(?:stuck|forever)[\s\S]{0,400}(?:validating|submitting|loading)[\s\S]{0,250}(?:settle|finally|cleanup)/iu,
    ]) {
      expect(source).toMatch(failure);
    }
    expect(source).toMatch(/sanitize\([\s\S]{0,400}(?:untrusted|host|display)/iu);
    expect(source).toMatch(/(?:bound|truncate|limit)[\s\S]{0,350}(?:validation|submit).+diagnostic/iu);
    expect(source).toMatch(/(?:secret|token|payload)[\s\S]{0,450}(?:redact|never|do not leak)/iu);
    expect(source).toMatch(/(?:network|filesystem|clipboard)[\s\S]{0,450}(?:explicit|authorized|no implicit)/iu);
    expect(source).toMatch(
      /(?:first invalid field|focus)[\s\S]{0,350}(?:keyboard|submit)[\s\S]{0,250}(?:error|invalid)/iu,
    );
    expect(source).toMatch(/(?:non-colou?r|text label)[\s\S]{0,350}(?:error|invalid|busy)/iu);
    expect(source).toMatch(/(?:monochrome|ASCII)[\s\S]{0,350}(?:fallback|cue|label)/iu);
    expect(source).toMatch(/(?:reduced|small)[ -](?:geometry|viewport)[\s\S]{0,400}(?:wrap|clip|resize)/iu);
    expect(source).toMatch(/(?:exercise|experiment)[\s\S]{0,700}(?:invalid|async|load|dispose)/iu);
    expect(source).toContain('](/components/controls/form-dialog)');
    expect(source).toContain('](/guide/reactive-state)');
    expect(source).toContain('](/guide/dialogs-and-modality)');
    expect(source).toContain('](/guide/async-work)');
    expect(source).toContain('](/api/forms/functions/createForm)');
    expect(source).toMatch(/formDialog[\s\S]{0,450}(?:owns|specialist|modal sealing)[\s\S]{0,350}(?:link|component)/iu);
  });
});

describe('public form building blocks taught by the course', () => {
  test('should keep raw signals stable, coerce typed values, route Zod issues, and reset the baseline', async () => {
    const schema = z
      .object({
        name: z.string().min(1, 'Name required'),
        port: z.coerce.number().int().min(1).max(65535),
      })
      .refine((value) => value.name !== 'admin' || value.port === 443, {
        message: 'Admin requires port 443',
      });
    const form = createForm({ schema, initial: { name: '', port: '8080' } });
    const name = form.field('name');
    expect(form.field('name').value).toBe(name.value);
    expect(form.rawValues()).toEqual({ name: '', port: '8080' });
    expect(form.values()).toBeNull();
    expect(name.error()?.message).toBe('Name required');
    expect(name.touched()).toBe(false);

    name.value.set('db');
    expect(form.values()).toEqual({ name: 'db', port: 8080 });
    expect(typeof form.values()?.port).toBe('number');
    form.field('port').value.set('9000');
    expect(form.dirty()).toBe(true);
    await form.submit(() => {});
    expect(name.touched()).toBe(true);
    form.reset();
    expect(form.rawValues()).toEqual({ name: '', port: '8080' });
    expect(form.dirty()).toBe(false);
    expect(name.touched()).toBe(false);

    name.value.set('admin');
    expect(form.errors().map((issue) => issue.message)).toContain('Admin requires port 443');
    expect(name.error()).toBeNull();
    form.dispose();
  });

  test('should bind text on blur, adapt domain choices, and reject unknown fields', () => {
    const form = createForm({
      schema: z.object({
        name: z.string(),
        align: z.enum(['left', 'right']),
        flags: z.array(z.enum(['bold', 'italic'])),
      }),
      initial: { name: '', align: 'left', flags: ['bold'] as Array<'bold' | 'italic'> },
    });
    const name = form.field('name');
    const input = new Input({ value: name.value });
    const other = new Input({ value: name.value });
    input.setLayout({ size: { kind: 'fixed', cells: 1 } });
    other.setLayout({ size: { kind: 'fixed', cells: 1 } });
    bindField(name, input);
    const root = new Group();
    root.setLayout({ direction: 'col' });
    root.add(input);
    root.add(other);
    const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
    const loop = createEventLoop({ width: 20, height: 4 }, { caps });
    loop.mount(root);
    loop.focusView(input);
    expect(name.touched()).toBe(false);
    loop.dispatch(key('d'));
    loop.dispatch(key('b'));
    expect(name.value()).toBe('db');
    loop.focusView(other);
    expect(name.touched()).toBe(true);

    const radio = bindRadio(form.field('align'), ['left', 'right']);
    expect(radio()).toBe(0);
    radio.set(1);
    expect(form.field('align').value()).toBe('right');
    const checks = bindCheck(form.field('flags'), ['bold', 'italic']);
    expect(checks()).toEqual([true, false]);
    checks.set([false, true]);
    expect(form.field('flags').value()).toEqual(['italic']);
    expect(() => form.field('missing' as never)).toThrow(FormFieldError);
    expect(typeof formDialog).toBe('function');
    loop.dispose();
    form.dispose();
  });

  test('should force async validation on submit, expose submitting synchronously, and rethrow save failure', async () => {
    const invalidValidator = vi.fn(() => Promise.resolve(null));
    const invalid = createForm({
      schema: z.object({ username: z.string().min(3, 'Min 3') }),
      initial: { username: 'x' },
      asyncValidators: { username: invalidValidator },
    });
    const invalidSubmit = invalid.submit(() => {});
    // A synchronously invalid submission completes its short-circuit before submit() returns.
    expect(invalid.submitting()).toBe(false);
    await expect(invalidSubmit).resolves.toBe(false);
    expect(invalidValidator).not.toHaveBeenCalled();
    expect(invalid.field('username').touched()).toBe(true);
    expect(invalid.submitting()).toBe(false);

    const validation = controlledValidator();
    const persistence = deferred<void>();
    const valid = createForm({
      schema: z.object({ username: z.string().min(3) }),
      initial: { username: 'free' },
      asyncValidators: { username: validation.validator },
    });
    const observed: unknown[] = [];
    const submission = valid.submit(async (values) => {
      observed.push(values);
      await persistence.promise;
    });
    expect(valid.submitting()).toBe(true);
    expect(valid.validating()).toBe(true);
    expect(validation.values).toEqual(['free']);
    expect(validation.signals[0]).toBeInstanceOf(AbortSignal);
    validation.resolve(0, null);
    await settle();
    expect(valid.validating()).toBe(false);
    expect(valid.submitting()).toBe(true);
    expect(observed).toEqual([{ username: 'free' }]);
    persistence.resolve();
    await expect(submission).resolves.toBe(true);
    expect(valid.submitting()).toBe(false);

    const failing = createForm({
      schema: z.object({ username: z.string() }),
      initial: { username: 'free' },
    });
    const rejected = failing.submit(async () => {
      throw new Error('save failed');
    });
    expect(failing.submitting()).toBe(true);
    await expect(rejected).rejects.toThrow('save failed');
    expect(failing.submitting()).toBe(false);
    invalid.dispose();
    valid.dispose();
    failing.dispose();
  });

  test('should debounce, abort superseded validation, drop stale verdicts, and expose rejection semantics', async () => {
    vi.useFakeTimers();
    const controlled = controlledValidator();
    const form = createForm({
      schema: z.object({ username: z.string().min(1) }),
      initial: { username: '' },
      asyncValidators: { username: controlled.validator },
    });
    const field = form.field('username');
    field.value.set('older');
    expect(field.validating()).toBe(false);
    expect(form.isValid()).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(field.validating()).toBe(true);
    field.value.set('newer');
    expect(controlled.signals[0]?.aborted).toBe(true);
    expect(field.validating()).toBe(false);
    await vi.advanceTimersByTimeAsync(300);
    controlled.resolve(1, 'Unavailable');
    await vi.advanceTimersByTimeAsync(0);
    expect(field.asyncError()).toBe('Unavailable');
    expect(field.error()).toBeNull();
    expect(form.isValid()).toBe(false);
    controlled.resolve(0, null);
    await vi.advanceTimersByTimeAsync(0);
    expect(field.asyncError()).toBe('Unavailable');
    form.dispose();

    const rejected = createForm({
      schema: z.object({ username: z.string() }),
      initial: { username: 'free' },
      asyncValidators: { username: () => Promise.reject(new Error('transport unavailable')) },
    });
    const accepted: unknown[] = [];
    await expect(
      rejected.submit((values) => {
        accepted.push(values);
      }),
    ).resolves.toBe(true);
    expect(rejected.field('username').asyncError()).toBeNull();
    expect(accepted).toEqual([{ username: 'free' }]);
    rejected.dispose();
  });

  test('should load atomically with latest-wins baseline rebasing and abort on idempotent disposal', async () => {
    const form = createForm({
      schema: z.object({ name: z.string().min(1), port: z.coerce.number() }),
      initial: { name: 'initial', port: '8080' },
    });
    await form.submit(() => {});
    form.field('name').value.set('edited');
    expect(form.dirty()).toBe(true);

    const loads: Array<ReturnType<typeof deferred<{ name: string; port: string }>>> = [];
    const signals: AbortSignal[] = [];
    const loader = ({ signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      const load = deferred<{ name: string; port: string }>();
      loads.push(load);
      return load.promise;
    };
    const older = form.load(loader);
    expect(form.loading()).toBe(true);
    const newer = form.load(loader);
    expect(signals[0]?.aborted).toBe(true);
    loads[1]?.resolve({ name: 'latest', port: '9090' });
    await expect(newer).resolves.toBe(true);
    expect(form.rawValues()).toEqual({ name: 'latest', port: '9090' });
    expect(form.values()).toEqual({ name: 'latest', port: 9090 });
    expect(form.dirty()).toBe(false);
    expect(form.field('name').touched()).toBe(false);
    loads[0]?.resolve({ name: 'stale', port: '1' });
    await older;
    expect(form.rawValues().name).toBe('latest');
    form.field('name').value.set('changed');
    form.reset();
    expect(form.rawValues().name).toBe('latest');

    const beforeFailure = form.rawValues();
    await expect(
      form.load(async () => {
        throw new Error('load failed');
      }),
    ).resolves.toBe(false);
    expect(form.rawValues()).toEqual(beforeFailure);

    const pending = form.load(loader);
    const pendingSignal = signals.at(-1);
    form.dispose();
    form.dispose();
    expect(pendingSignal?.aborted).toBe(true);
    loads.at(-1)?.resolve({ name: 'too late', port: '2' });
    await pending;
    expect(form.rawValues()).toEqual(beforeFailure);
  });
});

describe('Form-state and async-submit laboratory contract', () => {
  test('should register two applications with objective-specific titles and blurbs', async () => {
    expect(registryEntry(stateLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/form-state-validation.ts',
    });
    expect(registryEntry(asyncLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/form-async-submit.ts',
    });
    const state = await loadDefinition(stateLabId);
    const asyncSubmit = await loadDefinition(asyncLabId);
    expect(state.title).toMatch(/Form State (?:and|&) Validation (?:Laboratory|Workshop)/iu);
    expect(state.blurb).toMatch(/raw[\s\S]*coerc[\s\S]*(?:touched|dirty)[\s\S]*(?:submit|reset)/iu);
    expect(asyncSubmit.title).toMatch(/Async Form (?:Submission|Workflow) (?:Laboratory|Workshop)/iu);
    expect(asyncSubmit.blurb).toMatch(/validat[\s\S]*(?:supersed|abort)[\s\S]*(?:failure|retry)[\s\S]*cleanup/iu);
  });

  test.each(labIds)('should open %s in a compact centered Classic shell at 80x24', async (id) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition);
      const evidence = collectTemplate1Evidence(app, dialog);
      expect(evidence.viewport).toEqual({ width: 80, height: 24 });
      expect(evidence.dialogRect.width).toBeLessThan(evidence.viewport.width);
      expect(evidence.dialogRect.height).toBeLessThan(evidence.viewport.height - 2);
      expect(dialog.closable).toBe(false);
      expect(dialog.background).toBeUndefined();
      expect(evidence.dialogInterior.join('\n')).toMatch(/(?:Alt|Enter|mouse|click)/iu);
      app.loop.dispose();
      expect(dialog.mounted).toBe(false);
      dispose();
    });
  });

  test.each(labIds)('should keep %s padded and unclipped through resize, maximize, and restore', async (id) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      const authored = { ...dialog.bounds };
      resizeDialog(app, dialog);
      expect(dialog.bounds.width).toBeGreaterThan(authored.width);
      expect(dialog.bounds.height).toBeGreaterThan(authored.height);
      const resized = { ...dialog.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      app.loop.dispose();
      dispose();
    });
  });

  test('should expose real bound inputs and complete invalid, valid, dirty, and reset workflows', async () => {
    const definition = await loadDefinition(stateLabId);
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample(stateLabId, definition);
      const panel = statePanelIn(dialog);
      expect(panel.nameInput.mounted).toBe(true);
      expect(panel.portInput.mounted).toBe(true);
      expect(viewsIn(dialog).filter((view) => view instanceof Input)).toHaveLength(2);
      expect(frameText(app)).toMatch(
        /Raw name:\s*(?:empty|""|—)[\s\S]*Raw port:\s*8080[\s\S]*Typed:\s*(?:null|unavailable)/iu,
      );

      app.loop.dispatch(key('s', { alt: true }));
      expect(panel.invalidSubmissions).toBe(1);
      expect(panel.validSubmissions).toBe(0);
      expect(app.loop.getFocused()).toBe(panel.nameInput);
      expect(frameText(app)).toMatch(/Touched:\s*(?:name.+port|all)[\s\S]*(?:Name required|invalid)/iu);

      app.loop.dispatch(key('f', { alt: true }));
      expect(frameText(app)).toMatch(/Raw name:\s*db[\s\S]*Raw port:\s*9090[\s\S]*Typed port:\s*9090/iu);
      app.loop.dispatch(key('s', { alt: true }));
      await settle();
      expect(panel.validSubmissions).toBe(1);
      expect(frameText(app)).toMatch(/Submit:\s*success[\s\S]*(?:coerced|number)/iu);

      app.loop.dispatch(key('e', { alt: true }));
      expect(frameText(app)).toMatch(/Dirty:\s*yes/iu);
      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.resetCount).toBe(1);
      expect(frameText(app)).toMatch(/Dirty:\s*no[\s\S]*Touched:\s*(?:none|no)/iu);
      clickButton(app, dialog, 'Fill valid');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should suppress stale validation and carry forced submit through failure and successful retry', async () => {
    const definition = await loadDefinition(asyncLabId);
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample(asyncLabId, definition);
      const panel = asyncPanelIn(dialog);
      const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
      const button = (label: string): Button => {
        const match = buttons.find((candidate) => candidate.activation.label === label);
        if (match === undefined) throw new Error(`Async form laboratory is missing "${label}"`);
        return match;
      };
      const newer = button('Newer');
      const older = button('Settle older');
      const newest = button('Newest done');
      const submit = button('Submit');
      const allow = button('Allow');
      const persist = button('Persist');
      const retry = button('Retry');
      expect(frameText(app)).toMatch(/Validating:\s*no[\s\S]*Submitting:\s*no[\s\S]*Result:\s*(?:none|idle)/iu);
      expect(newest.accelerators()).toEqual(['o']);
      expect(newer.state.disabled).toBe(true);
      expect(older.state.disabled).toBe(true);
      expect(newest.state.disabled).toBe(true);
      expect(submit.state.disabled).toBe(false);
      expect(allow.state.disabled).toBe(true);
      expect(persist.state.disabled).toBe(true);
      expect(retry.state.disabled).toBe(true);

      app.loop.dispatch(key('v', { alt: true }));
      expect(panel.validationRuns).toBe(1);
      expect(frameText(app)).toMatch(/Validating:\s*yes[\s\S]*(?:pending|value 1)/iu);
      expect(newer.state.disabled).toBe(false);
      app.loop.dispatch(key('n', { alt: true }));
      expect(panel.validationRuns).toBe(2);
      expect(panel.abortedValidations).toBe(1);
      expect(frameText(app)).toMatch(/(?:newer|value 2)[\s\S]*Validating:\s*yes/iu);
      expect(older.state.disabled).toBe(false);
      expect(newest.state.disabled).toBe(false);
      app.loop.dispatch(key('l', { alt: true }));
      await settle();
      expect(panel.staleValidationResults).toBe(1);
      expect(panel.acceptedValidationResults).toBe(0);
      expect(frameText(app)).toMatch(/(?:stale|older).+(?:dropped|suppressed)/iu);
      app.loop.dispatch(key('o', { alt: true }));
      await settle();
      expect(panel.acceptedValidationResults).toBe(1);
      expect(frameText(app)).toMatch(/(?:stale|older).+(?:dropped|suppressed)[\s\S]*(?:available|clean|accepted)/iu);

      app.loop.dispatch(key('f', { alt: true }));
      expect(frameText(app)).toMatch(/Next persistence:\s*fail/iu);
      app.loop.dispatch(key('s', { alt: true }));
      expect(panel.validationRuns).toBe(3);
      expect(frameText(app)).toMatch(/Submitting:\s*yes[\s\S]*Validating:\s*yes/iu);
      expect(submit.state.disabled).toBe(true);
      expect(allow.state.disabled).toBe(false);
      expect(persist.state.disabled).toBe(true);
      app.loop.dispatch(key('a', { alt: true }));
      await settle();
      expect(frameText(app)).toMatch(/Submitting:\s*yes[\s\S]*Persistence:\s*pending/iu);
      expect(allow.state.disabled).toBe(true);
      expect(persist.state.disabled).toBe(false);
      app.loop.dispatch(key('p', { alt: true }));
      await settle();
      expect(panel.failedSubmissions).toBe(1);
      expect(panel.successfulSubmissions).toBe(0);
      expect(frameText(app)).toMatch(/Submitting:\s*no[\s\S]*(?:failed|error)[\s\S]*Retry:\s*available/iu);
      expect(retry.state.disabled).toBe(false);

      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.validationRuns).toBe(4);
      expect(frameText(app)).toMatch(/Submitting:\s*yes[\s\S]*Validating:\s*yes/iu);
      app.loop.dispatch(key('a', { alt: true }));
      await settle();
      app.loop.dispatch(key('p', { alt: true }));
      await settle();
      expect(panel.successfulSubmissions).toBe(1);
      expect(panel.failedSubmissions).toBe(1);
      expect(frameText(app)).toMatch(/Submitting:\s*no[\s\S]*(?:success|saved)/iu);
      clickButton(app, dialog, 'Validate');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should abort and settle a pending validator without publishing after disposal', async () => {
    const definition = await loadDefinition(asyncLabId);
    let panel: FormAsyncSubmitPanel | undefined;
    createRoot((dispose) => {
      const built = buildLabExample(asyncLabId, definition);
      panel = asyncPanelIn(built.dialog);
      built.app.loop.dispatch(key('v', { alt: true }));
      expect(panel.validationRuns).toBe(1);
      expect(panel.pendingManualRuns()).toBe(1);
      built.app.loop.dispose();
      dispose();
    });
    await settle();
    expect(panel?.abortedValidations).toBe(1);
    expect(panel?.cleanupCount).toBe(1);
    expect(panel?.pendingManualRuns()).toBe(0);
    expect(panel?.staleValidationResults).toBe(0);
    expect(panel?.acceptedValidationResults).toBe(0);
  });

  test('should expose bounded, keyboard-and-mouse-complete, non-colour teaching surfaces', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      let mounted: View[] = [];
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(id, definition);
        mounted = viewsIn(dialog);
        expect(frameText(app)).toMatch(/Alt\+[A-Z]/u);
        expect(frameText(app)).toMatch(/(?:Raw|Typed|Touched|Dirty|Validating|Submitting|Result|Action):/iu);
        expect(frameText(app)).toMatch(/(?:idle|none|yes|no|pending|success|invalid|bounded)/iu);
        expect(frameText(app)).toMatch(/(?:deterministic|in-memory|No network|bounded fixture)/iu);
        expect(frameText(app)).toMatch(/(?:ASCII|monochrome|text status|non-colou?r)/iu);
        const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons.every((button) => button.focusable)).toBe(true);
        app.loop.dispose();
        dispose();
      });
      expect(mounted.every((view) => !view.mounted && view.scope === null)).toBe(true);
    }
  });
});
