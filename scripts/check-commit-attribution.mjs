#!/usr/bin/env node
/**
 * Reject commit messages that attribute additional co-authors.
 *
 * The default mode scans every commit reachable from `HEAD`, which makes the checker suitable for
 * CI. The commit-message hook validates a message before Git creates the commit, while the pre-push
 * hook scans every revision being sent. All modes use the same line matcher so their behavior
 * cannot drift.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const CO_AUTHOR_TRAILER = /^[\t ]*co-authored-by[\t ]*:/iu;
const COMMIT_ID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u;
const ZERO_COMMIT_ID = /^0+$/u;

/**
 * Describe a prohibited attribution line in a commit message.
 *
 * @typedef {object} AttributionFinding
 * @property {number} lineNumber One-based line number in the commit message.
 * @property {string} line The offending line, trimmed for diagnostic output.
 */

/**
 * Find the first prohibited co-author attribution in a commit message.
 *
 * Matching is case-insensitive and permits surrounding horizontal whitespace because Git trailer
 * producers do not all use identical capitalization or spacing.
 *
 * @param {string} message Complete commit message.
 * @returns {AttributionFinding | undefined} The first prohibited line, when present.
 * @example
 * findCoAuthorAttribution('fix: correct layout'); // undefined
 */
export function findCoAuthorAttribution(message) {
  const lines = message.split(/\r?\n/u);
  const index = lines.findIndex((line) => CO_AUTHOR_TRAILER.test(line));
  if (index === -1) return undefined;
  return { lineNumber: index + 1, line: lines[index].trim() };
}

/**
 * Parse the NUL-delimited `git log` representation used by the history scanner.
 *
 * @param {string} output Alternating commit hashes and complete messages.
 * @returns {Array<{ sha: string; message: string }>} Parsed history records.
 * @throws {Error} When Git returns a truncated record.
 */
export function parseHistoryRecords(output) {
  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length % 2 !== 0) throw new Error('Git returned an incomplete commit-message record.');

  const records = [];
  for (let index = 0; index < fields.length; index += 2) {
    records.push({ sha: fields[index], message: fields[index + 1] });
  }
  return records;
}

/**
 * Extract the local commit IDs from Git's pre-push standard input.
 *
 * Deletions have an all-zero local ID and need no history validation. Every non-zero value is
 * allowlisted as a SHA-1 or SHA-256 object ID before it can be passed to Git as an argument.
 *
 * @param {string} input Lines supplied to a `pre-push` hook on standard input.
 * @returns {string[]} Unique local commit IDs being pushed.
 * @throws {Error} When Git supplies an incomplete or invalid reference update.
 */
export function parsePushedRevisions(input) {
  const revisions = new Set();
  for (const line of input.split(/\r?\n/u)) {
    if (line.length === 0) continue;
    const fields = line.split(' ');
    if (fields.length !== 4) throw new Error('Git supplied an invalid pre-push reference update.');

    const localCommit = fields[1];
    if (ZERO_COMMIT_ID.test(localCommit)) continue;
    if (!COMMIT_ID.test(localCommit)) throw new Error('Git supplied an invalid local commit ID.');
    revisions.add(localCommit);
  }
  return [...revisions];
}

/**
 * Print one stable rejection message.
 *
 * @param {string} location Message file or commit identifier being rejected.
 * @param {AttributionFinding} finding Prohibited line found in the message.
 * @returns {number} A failing process exit status.
 */
function reportFinding(location, finding) {
  process.stderr.write(
    `commit attribution check: ${location}, line ${finding.lineNumber}: ${finding.line}\n` +
      'Remove all co-author attribution trailers before committing.\n',
  );
  return 1;
}

/**
 * Validate the message file supplied by Git's commit-message hook.
 *
 * @param {string} path Commit-message file path supplied by Git.
 * @returns {number} Process exit status for the validation.
 */
function checkMessageFile(path) {
  const message = readFileSync(path, 'utf8');
  const finding = findCoAuthorAttribution(message);
  if (finding === undefined) return 0;
  return reportFinding(path, finding);
}

/**
 * Validate every commit reachable from the supplied revisions.
 *
 * @param {string[]} revisions Allowlisted commit IDs or the internal `HEAD` default.
 * @returns {number} Process exit status for the validation.
 */
function checkHistory(revisions) {
  if (revisions.length === 0) return 0;
  const result = spawnSync('git', ['log', '-z', '--format=%H%x00%B', ...revisions], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    return result.status ?? 1;
  }

  for (const record of parseHistoryRecords(result.stdout)) {
    const finding = findCoAuthorAttribution(record.message);
    if (finding !== undefined) return reportFinding(`commit ${record.sha}`, finding);
  }

  process.stdout.write('commit attribution check: no co-author trailers found.\n');
  return 0;
}

/**
 * Parse the deliberately small command-line surface and run the requested check.
 *
 * @param {string[]} args Command-line arguments after the script name.
 * @returns {number} Process exit status for the requested mode.
 */
function main(args) {
  if (args.length === 0) return checkHistory(['HEAD']);
  if (args.length === 2 && args[0] === '--message-file') return checkMessageFile(args[1]);
  if (args.length === 1 && args[0] === '--pushed-refs') {
    return checkHistory(parsePushedRevisions(readFileSync(0, 'utf8')));
  }
  process.stderr.write('Usage: node scripts/check-commit-attribution.mjs [--message-file <path> | --pushed-refs]\n');
  return 2;
}

const isDirectExecution = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) process.exitCode = main(process.argv.slice(2));
