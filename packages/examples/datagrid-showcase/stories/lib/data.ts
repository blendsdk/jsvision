/**
 * Shared demo data for the datagrid showcase — a handful of small, typed row sets reused across demos.
 *
 * Each set is exposed through a **factory** (`people()`, `sales()`, `tasks()`) that returns a fresh
 * `Signal<T[]>` over copied records, so a demo that edits in place never mutates the shared source and
 * two demos never share reactive state. Every row carries a stable numeric `id` for `rowKey`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';

/** A person — the everyday row for foundation, editing, and editor demos. */
export interface Person {
  readonly id: number;
  name: string;
  age: number;
  role: string;
  city: string;
  active: boolean;
}

/** A sale — the numeric/currency/date row for formatting, sorting, and filtering demos. */
export interface Sale {
  readonly id: number;
  region: string;
  product: string;
  qty: number;
  unitPrice: number;
  /** Fraction 0..1 — shown via `fmt.percent`. */
  margin: number;
  closedOn: Date;
  won: boolean;
}

/** A task — the enum/boolean/date row for editor demos. */
export interface Task {
  readonly id: number;
  title: string;
  /** One of `PRIORITIES`. */
  priority: string;
  done: boolean;
  due: Date;
}

/** The allowed task priorities (the `enum` editor's option set). */
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const PEOPLE: readonly Person[] = [
  { id: 1, name: 'Alice Johnson', age: 30, role: 'Engineer', city: 'New York', active: true },
  { id: 2, name: 'Bob Smith', age: 25, role: 'Designer', city: 'Los Angeles', active: true },
  { id: 3, name: 'Carol White', age: 42, role: 'Manager', city: 'San Francisco', active: false },
  { id: 4, name: 'Dave Brown', age: 28, role: 'Engineer', city: 'Seattle', active: true },
  { id: 5, name: 'Eve Davis', age: 35, role: 'Analyst', city: 'Chicago', active: true },
  { id: 6, name: 'Frank Miller', age: 51, role: 'Director', city: 'Boston', active: false },
  { id: 7, name: 'Grace Lee', age: 23, role: 'Intern', city: 'Austin', active: true },
  { id: 8, name: 'Heidi Clark', age: 39, role: 'Engineer', city: 'Denver', active: true },
  { id: 9, name: 'Ivan Petrov', age: 46, role: 'Architect', city: 'Portland', active: false },
  { id: 10, name: 'Judy Nguyen', age: 33, role: 'Designer', city: 'Miami', active: true },
];

const SALES: readonly Sale[] = [
  {
    id: 1,
    region: 'EMEA',
    product: 'Widget',
    qty: 120,
    unitPrice: 9.99,
    margin: 0.32,
    closedOn: new Date('2026-01-14'),
    won: true,
  },
  {
    id: 2,
    region: 'APAC',
    product: 'Gadget',
    qty: 40,
    unitPrice: 24.5,
    margin: 0.18,
    closedOn: new Date('2026-02-03'),
    won: false,
  },
  {
    id: 3,
    region: 'AMER',
    product: 'Widget',
    qty: 200,
    unitPrice: 9.99,
    margin: 0.41,
    closedOn: new Date('2026-02-27'),
    won: true,
  },
  {
    id: 4,
    region: 'EMEA',
    product: 'Sprocket',
    qty: 75,
    unitPrice: 14.0,
    margin: 0.25,
    closedOn: new Date('2026-03-11'),
    won: true,
  },
  {
    id: 5,
    region: 'APAC',
    product: 'Widget',
    qty: 60,
    unitPrice: 9.99,
    margin: 0.29,
    closedOn: new Date('2026-03-19'),
    won: false,
  },
  {
    id: 6,
    region: 'AMER',
    product: 'Gadget',
    qty: 150,
    unitPrice: 24.5,
    margin: 0.37,
    closedOn: new Date('2026-04-02'),
    won: true,
  },
  {
    id: 7,
    region: 'EMEA',
    product: 'Gadget',
    qty: 30,
    unitPrice: 24.5,
    margin: 0.12,
    closedOn: new Date('2026-04-22'),
    won: false,
  },
  {
    id: 8,
    region: 'AMER',
    product: 'Sprocket',
    qty: 90,
    unitPrice: 14.0,
    margin: 0.34,
    closedOn: new Date('2026-05-08'),
    won: true,
  },
];

const TASKS: readonly Task[] = [
  { id: 1, title: 'Draft the spec', priority: 'high', done: true, due: new Date('2026-01-20') },
  { id: 2, title: 'Review the plan', priority: 'normal', done: false, due: new Date('2026-02-10') },
  { id: 3, title: 'Ship the release', priority: 'urgent', done: false, due: new Date('2026-03-01') },
  { id: 4, title: 'Write the docs', priority: 'low', done: false, due: new Date('2026-03-15') },
  { id: 5, title: 'Fix the flaky test', priority: 'high', done: true, due: new Date('2026-02-28') },
];

/** A fresh, independently-editable `Signal<Person[]>` (records copied). */
export function people(): Signal<Person[]> {
  return signal(PEOPLE.map((p) => ({ ...p })));
}

/** A fresh, independently-editable `Signal<Sale[]>` (records + `Date`s copied). */
export function sales(): Signal<Sale[]> {
  return signal(SALES.map((s) => ({ ...s, closedOn: new Date(s.closedOn) })));
}

/** A fresh, independently-editable `Signal<Task[]>` (records + `Date`s copied). */
export function tasks(): Signal<Task[]> {
  return signal(TASKS.map((t) => ({ ...t, due: new Date(t.due) })));
}
