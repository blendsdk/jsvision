// The real Anthropic-backed DraftClient for `yarn plugin:sync` (the automatable AI path).
//
// This is the only file that imports @anthropic-ai/sdk. plugin-sync.mjs loads it LAZILY (a dynamic
// import inside main()), so importing the sync machinery — as the tests do — never pulls in the SDK
// and never needs an API key. Unit tests always inject a fake client; this adapter is exercised only
// by a real `yarn plugin:sync` run with ANTHROPIC_API_KEY set.

import Anthropic from '@anthropic-ai/sdk';

// A small, grounded, low-volume draft (one catalog bullet), so a fast model + tiny token budget fit.
// Override the model via PLUGIN_SYNC_MODEL for higher-quality prose (e.g. claude-sonnet-5).
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 256;

/**
 * Create the real Anthropic-backed draft client. It maps a `{ system, user }` request to a single
 * `messages.create` call and returns the concatenated text of the reply.
 *
 * @param {{ apiKey?: string, model?: string }} [options] Defaults read `ANTHROPIC_API_KEY` and
 *   `PLUGIN_SYNC_MODEL` from the environment.
 * @returns {{ draft(request: { system: string, user: string }): Promise<string> }} The draft client.
 * @throws {Error} When no API key is available.
 * @example
 * const client = createAnthropicClient();
 * const bullet = await client.draft({ system: '...', user: 'Widget: Button ...' });
 */
export function createAnthropicClient({
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.PLUGIN_SYNC_MODEL ?? DEFAULT_MODEL,
} = {}) {
  if (apiKey === undefined || apiKey === '') {
    throw new Error('plugin:sync: ANTHROPIC_API_KEY is not set — see tools/claude-plugin/README.md');
  }
  const anthropic = new Anthropic({ apiKey });
  return {
    async draft(request) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
      });
      return response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
        .trim();
    },
  };
}
