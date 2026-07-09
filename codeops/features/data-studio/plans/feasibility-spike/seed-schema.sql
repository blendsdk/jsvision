-- Data Studio feasibility spike — seed schema.
--
-- A deliberate edge-case matrix for probing schema introspection (Probe 1), CRUD/concurrency
-- (Probe 2), the RecordSet spine (Probe 3), the editable grid (Probe 4), and scale (Probe 7).
--
-- Apply against a THROWAWAY database only:
--   psql "$DATABASE_URL" -f seed-schema.sql
--
-- Covers: serial PK, composite PK, a NO-PK table, FKs, an enum type, numeric/bool/date/timestamptz,
-- jsonb, uuid, an int[] array, a GENERATED column, a CHECK constraint, NOT NULL, defaults, a
-- read-only VIEW, and a large table generator for the perf smoke test.

DROP SCHEMA IF EXISTS app CASCADE;
CREATE SCHEMA app;

-- Enum type — Probe 1 must discover its allowed values (→ a dropdown editor).
CREATE TYPE app.customer_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');

-- Serial PK + a broad column-type spread. Defaults, NOT NULL, CHECK, a generated column.
CREATE TABLE app.customer (
    id            serial PRIMARY KEY,
    name          text            NOT NULL,                       -- NOT NULL → required field
    email         text,                                           -- nullable → NULL-vs-empty test
    tier          app.customer_tier NOT NULL DEFAULT 'bronze',    -- enum → dropdown editor
    is_active     boolean         NOT NULL DEFAULT true,          -- bool → CheckGroup editor
    credit_limit  numeric(12,2)   NOT NULL DEFAULT 0
                    CHECK (credit_limit >= 0),                    -- CHECK → user-presentable error
    balance       numeric(12,2)   NOT NULL DEFAULT 0,
    available     numeric(12,2)   GENERATED ALWAYS AS (credit_limit - balance) STORED, -- read-only
    external_id   uuid            DEFAULT gen_random_uuid(),      -- uuid → hard type
    tags          integer[]       DEFAULT '{}',                   -- array → hard type
    metadata      jsonb           DEFAULT '{}'::jsonb,            -- jsonb → hard type (raw edit?)
    created_at    timestamptz     NOT NULL DEFAULT now()          -- timestamptz → date/time editor
);

-- FK → customer. date + enum-ish status via a CHECK (an alternative to an enum type).
CREATE TABLE app.order (
    id           serial PRIMARY KEY,
    customer_id  integer    NOT NULL REFERENCES app.customer(id) ON DELETE CASCADE, -- FK → dropdown
    ordered_on   date       NOT NULL DEFAULT current_date,        -- date → DatePicker
    status       text       NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'paid', 'shipped', 'cancelled')),
    total        numeric(12,2) NOT NULL DEFAULT 0
);

-- COMPOSITE PRIMARY KEY — Probe 2 must build UPDATE/DELETE keyed on (order_id, line_no).
CREATE TABLE app.order_item (
    order_id    integer     NOT NULL REFERENCES app.order(id) ON DELETE CASCADE,
    line_no     integer     NOT NULL,
    product     text        NOT NULL,
    qty         integer     NOT NULL CHECK (qty > 0),             -- CHECK for the error-mapping test
    unit_price  numeric(12,2) NOT NULL,
    PRIMARY KEY (order_id, line_no)
);

-- NO PRIMARY KEY — Probe 2 must decide: editable (by full-row match) or read-only?
CREATE TABLE app.tag (
    label       text        NOT NULL,
    color       text
);

-- A read-only VIEW — Probe 1 must detect is_updatable = NO and treat as a read-only source.
CREATE VIEW app.customer_summary AS
    SELECT c.id,
           c.name,
           c.tier,
           count(o.id)          AS order_count,
           coalesce(sum(o.total), 0) AS lifetime_total
      FROM app.customer c
      LEFT JOIN app.order o ON o.customer_id = c.id
     GROUP BY c.id, c.name, c.tier;

-- ---------------------------------------------------------------------------
-- Sample data
-- ---------------------------------------------------------------------------
INSERT INTO app.customer (name, email, tier, credit_limit, balance) VALUES
    ('Ada Lovelace',    'ada@example.com',    'gold',     10000, 2500),
    ('Alan Turing',     'alan@example.com',   'platinum', 25000, 9000),
    ('Grace Hopper',    NULL,                 'silver',    5000,    0),
    ('Edsger Dijkstra', 'edsger@example.com', 'bronze',    1000,  750);

INSERT INTO app.order (customer_id, ordered_on, status, total) VALUES
    (1, current_date - 10, 'paid',    120.00),
    (1, current_date - 3,  'open',     55.50),
    (2, current_date - 1,  'shipped', 999.99);

INSERT INTO app.order_item (order_id, line_no, product, qty, unit_price) VALUES
    (1, 1, 'Widget',  2, 30.00),
    (1, 2, 'Gadget',  1, 60.00),
    (2, 1, 'Gizmo',   5, 11.10),
    (3, 1, 'Sprocket',3, 333.33);

INSERT INTO app.tag (label, color) VALUES
    ('vip', 'gold'), ('trial', 'gray'), ('overdue', 'red');

-- ---------------------------------------------------------------------------
-- Large table for the perf smoke test (Probe 7) — 100k rows.
-- ---------------------------------------------------------------------------
CREATE TABLE app.big (
    id      serial PRIMARY KEY,
    label   text        NOT NULL,
    amount  numeric(12,2) NOT NULL,
    flag    boolean     NOT NULL,
    made_on date        NOT NULL
);

INSERT INTO app.big (label, amount, flag, made_on)
SELECT 'row ' || g,
       (g % 100000)::numeric / 100,
       (g % 2 = 0),
       current_date - (g % 3650)
  FROM generate_series(1, 100000) AS g;

-- Helpful indexes for keyset paging experiments (Probe 3).
CREATE INDEX ON app.big (id);
CREATE INDEX ON app.order (customer_id);
