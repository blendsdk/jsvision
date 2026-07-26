#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const REVIEW_MANIFEST_URL = new URL('../tools/i18n-translation-reviews.json', import.meta.url);
const REVIEWED_PACKAGES = ['ui', 'forms', 'files', 'datagrid'];
const REVIEWED_LOCALES = ['nl', 'de', 'fr', 'es', 'it', 'pt-PT', 'pl', 'ro', 'sv'];
const APPROVED_STATUS = 'approved';
const PROFICIENT_ATTESTATION = 'proficient';
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const REVIEW_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Convert JSON-compatible data into a stable representation independent of object insertion
 * order. Arrays retain their order because array position can carry meaning.
 *
 * @param {unknown} value Value to normalize.
 * @returns {unknown} Recursively normalized value.
 */
function normalizeJson(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeJson(entry));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeJson(entry)]),
  );
}

/**
 * Compute the digest bound to one reviewed catalog.
 *
 * Object keys are sorted recursively so semantically identical catalogs have the same digest
 * even when their construction order differs.
 *
 * @param {{ schema: number, locale: string, messages: Readonly<Record<string, unknown>> }} catalog
 * Catalog to digest.
 * @returns {string} Lowercase SHA-256 hexadecimal digest.
 * @example
 * normalizedCatalogDigest({ schema: 1, locale: 'nl', messages: { greeting: 'Hallo' } });
 */
export function normalizedCatalogDigest(catalog) {
  const normalized = JSON.stringify(normalizeJson(catalog));
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Create one machine-readable review problem.
 *
 * @param {string} code Stable issue discriminator.
 * @param {string} packageName Reviewed package or manifest package value.
 * @param {string} locale Reviewed locale or manifest locale value.
 * @param {string} message Human-readable explanation.
 * @returns {{ code: string, packageName: string, locale: string, message: string }} Review issue.
 */
function issue(code, packageName, locale, message) {
  return { code, packageName, locale, message };
}

/** Return true only for a real Gregorian calendar date in `YYYY-MM-DD` form. */
function isReviewDate(value) {
  if (!REVIEW_DATE.test(value)) return false;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Determine whether a review entry contains complete approved proficient evidence.
 *
 * @param {unknown} entry Candidate review entry.
 * @returns {entry is {
 *   package: string,
 *   locale: string,
 *   digest: string,
 *   reviewer: string,
 *   proficiency: string,
 *   reviewedAt: string,
 *   status: string
 * }} True when every required field is well formed.
 */
function isReviewEntry(entry) {
  return (
    entry !== null &&
    typeof entry === 'object' &&
    typeof entry.package === 'string' &&
    typeof entry.locale === 'string' &&
    typeof entry.digest === 'string' &&
    SHA256_HEX.test(entry.digest) &&
    typeof entry.reviewer === 'string' &&
    entry.reviewer.trim().length > 0 &&
    entry.proficiency === PROFICIENT_ATTESTATION &&
    typeof entry.reviewedAt === 'string' &&
    isReviewDate(entry.reviewedAt) &&
    entry.status === APPROVED_STATUS
  );
}

/**
 * Verify digest-bound translation approvals without performing filesystem or module I/O.
 *
 * Every catalog requires exactly one complete, proficient, approved review whose digest matches.
 * Extra manifest entries are rejected because they otherwise conceal misspelled package or locale
 * identities.
 *
 * @param {{
 *   catalogs: readonly {
 *     packageName: string,
 *     catalog: { schema: number, locale: string, messages: Readonly<Record<string, unknown>> }
 *   }[],
 *   manifest: { schema: number, reviews: readonly unknown[] }
 * }} input Catalogs and parsed manifest to verify.
 * @returns {readonly { code: string, packageName: string, locale: string, message: string }[]}
 * Structured issues; an empty array means all evidence is current and approved.
 * @example
 * verifyTranslationReviews({
 *   catalogs: [{ packageName: 'ui', catalog }],
 *   manifest: { schema: 1, reviews: [review] },
 * });
 */
export function verifyTranslationReviews({ catalogs, manifest }) {
  if (manifest?.schema !== 1 || !Array.isArray(manifest.reviews)) {
    return [issue('INVALID_MANIFEST', '*', '*', 'Review manifest must use schema 1 with a reviews array.')];
  }

  const expected = new Set(catalogs.map(({ packageName, catalog }) => `${packageName}\0${catalog.locale}`));
  const issues = [];
  for (const { packageName, catalog } of catalogs) {
    const matches = manifest.reviews.filter(
      (entry) =>
        entry !== null && typeof entry === 'object' && entry.package === packageName && entry.locale === catalog.locale,
    );
    if (matches.length === 0) {
      issues.push(issue('MISSING_REVIEW', packageName, catalog.locale, 'No translation review is recorded.'));
      continue;
    }
    if (matches.length > 1) {
      issues.push(
        issue('DUPLICATE_REVIEW', packageName, catalog.locale, 'Exactly one translation review is required.'),
      );
      continue;
    }
    const review = matches[0];
    if (!isReviewEntry(review)) {
      issues.push(
        issue(
          'UNAPPROVED_REVIEW',
          packageName,
          catalog.locale,
          'Review evidence must be complete, proficient, and approved.',
        ),
      );
      continue;
    }
    if (review.digest !== normalizedCatalogDigest(catalog)) {
      issues.push(
        issue('STALE_REVIEW', packageName, catalog.locale, 'The approved digest does not match the catalog.'),
      );
    }
  }

  for (const entry of manifest.reviews) {
    if (entry === null || typeof entry !== 'object') {
      issues.push(issue('INVALID_REVIEW', '*', '*', 'Review entries must be objects.'));
      continue;
    }
    const packageName = typeof entry.package === 'string' ? entry.package : '*';
    const locale = typeof entry.locale === 'string' ? entry.locale : '*';
    if (!expected.has(`${packageName}\0${locale}`)) {
      issues.push(issue('UNEXPECTED_REVIEW', packageName, locale, 'Review does not match an official catalog.'));
    }
  }
  return issues;
}

/** Convert a locale tag into the suffix used by official catalog exports. */
function localeSuffix(locale) {
  return locale
    .split('-')
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join('');
}

/**
 * Load every official non-English catalog from built package output.
 *
 * @returns {Promise<readonly { packageName: string, catalog: {
 *   schema: number,
 *   locale: string,
 *   messages: Readonly<Record<string, unknown>>
 * } }[]>} All 36 release-reviewed catalog descriptors.
 */
async function loadOfficialCatalogs() {
  const catalogs = [];
  for (const packageName of REVIEWED_PACKAGES) {
    for (const locale of REVIEWED_LOCALES) {
      const url = new URL(`../packages/${packageName}/dist/locales/${locale}.js`, import.meta.url);
      const module = await import(url.href);
      const exportName = `${packageName}${localeSuffix(locale)}`;
      const catalog = module[exportName];
      if (catalog === null || typeof catalog !== 'object') {
        throw new Error(`Built catalog export ${exportName} is missing.`);
      }
      catalogs.push({ packageName, catalog });
    }
  }
  return catalogs;
}

/** Run the repository release-review check and return a process exit code. */
async function main() {
  const manifest = JSON.parse(await readFile(REVIEW_MANIFEST_URL, 'utf8'));
  const issues = verifyTranslationReviews({
    catalogs: await loadOfficialCatalogs(),
    manifest,
  });
  if (issues.length === 0) {
    process.stdout.write('Verified 36 digest-bound translation reviews.\n');
    return 0;
  }
  for (const entry of issues) {
    process.stderr.write(`${entry.code} @jsvision/${entry.packageName} ${entry.locale}: ${entry.message}\n`);
  }
  return 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
