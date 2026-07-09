<script setup lang="ts">
/**
 * PlayExample — the client-only Play button that runs a live example in an xterm.js
 * terminal inside a modal. All browser-only code (xterm + the play controller) is
 * loaded via dynamic import() inside the Play handler, so the component is SSR-safe
 * and xterm is code-split out of the initial page bundle.
 *
 * Accessibility: the blurb and Play button are server-rendered (in the DOM without
 * JS); the example source lives on the page as a `<<<` block. On open, focus moves
 * into the dialog (the × button) rather than the terminal, so keyboard users are not
 * trapped; on close it returns to the Play button. A touch device with no keyboard
 * is shown a recorded screenshot (or, until that asset exists, a note + the source).
 *
 * Closing: the × button and a backdrop click close the dialog. Escape is deliberately
 * NOT bound here — it flows into the terminal so the hosted TUI keeps its own Escape.
 */
import { ref, onBeforeUnmount, onMounted, nextTick } from 'vue';
import { isNoKeyboardDevice, screenshotPath } from '../../../src/play/no-keyboard';
import { deepLinkTarget } from '../../../src/play/deep-link';

const props = defineProps<{ id: string; title?: string; blurb?: string }>();

const isOpen = ref(false);
const errorMessage = ref<string | null>(null);
const termHost = ref<HTMLElement | null>(null);
const playButton = ref<HTMLButtonElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const root = ref<HTMLElement | null>(null);
const noKeyboard = ref(false);
const screenshotMissing = ref(false);
const size = ref<'80×24' | '100×30'>('80×24');
const highlighted = ref(false);

type SizeSpec = { width: number; height: number };
type Controller = {
  open(el: HTMLElement): Promise<void>;
  close(): void;
  remount(next: { size?: SizeSpec }): Promise<void>;
};
let controller: Controller | null = null;
let focused = false;

const SIZES: Record<'80×24' | '100×30', SizeSpec> = {
  '80×24': { width: 80, height: 24 },
  '100×30': { width: 100, height: 30 },
};

async function buildController(): Promise<Controller | null> {
  const [xterm, fitAddon, webglAddon, playController, registry] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-webgl'),
    import('../../../src/play/play-controller'),
    import('../../../examples/index'),
  ]);
  await import('@xterm/xterm/css/xterm.css');

  const entry = registry.EXAMPLES.find((e) => e.id === props.id);
  if (!entry) {
    errorMessage.value = `Unknown example: ${props.id}`;
    return null;
  }

  return playController.createPlayController({
    entry,
    size: SIZES[size.value],
    createTerminal: (el: HTMLElement) => {
      const term = new xterm.Terminal({ allowProposedApi: true, cursorBlink: true, fontSize: 14 });
      const fit = new fitAddon.FitAddon();
      term.loadAddon(fit);
      term.open(el);
      try {
        term.loadAddon(new webglAddon.WebglAddon()); // crisp box-drawing; falls back to DOM renderer
      } catch {
        /* no WebGL — the DOM renderer still draws Unicode */
      }
      fit.fit();
      term.textarea?.addEventListener('focus', () => (focused = true));
      term.textarea?.addEventListener('blur', () => (focused = false));
      return term;
    },
    // Reclaim browser chords only while the dialog is open AND the terminal has focus.
    isFocused: () => isOpen.value && focused,
    onError: (message: string) => {
      errorMessage.value = message;
    },
  });
}

async function open(): Promise<void> {
  errorMessage.value = null;
  isOpen.value = true;
  await nextTick(); // let the modal (and its terminal host div) render before mounting

  const host = termHost.value;
  if (!host) return;
  controller = await buildController();
  if (!controller) return;
  await controller.open(host);
  // Move focus into the dialog (not the terminal) so keyboard users are not trapped.
  closeButton.value?.focus();
}

function close(): void {
  controller?.close();
  controller = null;
  isOpen.value = false;
  focused = false;
  playButton.value?.focus(); // return focus to the trigger
}

async function reset(): Promise<void> {
  await controller?.remount({});
}

async function toggleSize(): Promise<void> {
  size.value = size.value === '80×24' ? '100×30' : '80×24';
  await controller?.remount({ size: SIZES[size.value] });
}

onMounted(() => {
  noKeyboard.value = isNoKeyboardDevice();
  // Deep-link: open this example if the URL targets it — scroll to + highlight, but never
  // auto-focus the terminal, and never open on a no-keyboard device (it shows the fallback).
  const target = deepLinkTarget(window.location.search, [props.id], noKeyboard.value);
  if (target === props.id) {
    root.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlighted.value = true;
    void open();
  }
});

onBeforeUnmount(close);
</script>

<template>
  <div ref="root" class="play-example" :class="{ highlighted }">
    <p v-if="props.blurb" class="play-blurb">{{ props.blurb }}</p>

    <!-- No-keyboard fallback: a note + a recorded screenshot; if the asset is missing, just the
         note (the example source stays on the page — never a broken image). -->
    <div v-if="noKeyboard" class="play-fallback">
      <p class="play-note">Live interaction needs a hardware keyboard.</p>
      <img
        v-if="!screenshotMissing"
        :src="screenshotPath(props.id)"
        :alt="`${props.title ?? props.id} (recorded demo)`"
        class="play-screenshot"
        @error="screenshotMissing = true"
      />
    </div>

    <!-- Interactive Play button (keyboard-capable devices). -->
    <button
      v-else
      ref="playButton"
      class="play-button"
      type="button"
      :aria-label="`Run the ${props.title ?? props.id} example in a terminal`"
      @click="open"
    >
      ▶ Play
    </button>

    <div v-if="isOpen" class="play-backdrop" @click.self="close">
      <div
        class="play-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="`${props.title ?? props.id} — live terminal`"
      >
        <div class="play-modal-bar">
          <span class="play-hint">Terminal focused — click × or outside to exit; Escape goes to the app.</span>
          <span class="play-controls">
            <button class="play-ctl" type="button" @click="reset">Reset</button>
            <button class="play-ctl" type="button" aria-label="Toggle terminal size" @click="toggleSize">
              {{ size }}
            </button>
            <button ref="closeButton" class="play-close" type="button" aria-label="Close the example" @click="close">
              ×
            </button>
          </span>
        </div>

        <div v-if="errorMessage" class="play-error" role="alert">
          <strong>This example failed to load.</strong>
          <pre>{{ errorMessage }}</pre>
        </div>
        <div v-show="!errorMessage" ref="termHost" class="play-term"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.play-example.highlighted {
  outline: 2px solid var(--vp-c-brand-1, #0e7490);
  outline-offset: 6px;
  border-radius: 6px;
}
.play-blurb {
  margin: 0 0 0.6rem;
  color: var(--vp-c-text-2);
}
.play-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.4em 1em;
  border: 1px solid var(--vp-c-brand-1, #0e7490);
  border-radius: 6px;
  background: var(--vp-c-brand-1, #0e7490);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.play-button:hover {
  background: var(--vp-c-brand-2, #155e75);
}
.play-fallback {
  padding: 0.75rem 1rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 6px;
}
.play-note {
  margin: 0 0 0.5rem;
  font-weight: 600;
}
.play-screenshot {
  max-width: 100%;
  border-radius: 4px;
}
.play-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
}
.play-modal {
  display: flex;
  flex-direction: column;
  max-width: 95vw;
  max-height: 90vh;
  padding: 0.5rem;
  border-radius: 8px;
  background: #0b0b12;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}
.play-modal-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0.25rem 0.4rem;
}
.play-hint {
  font-size: 0.8rem;
  color: #b9c0cc;
}
.play-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.play-ctl {
  padding: 0.15em 0.6em;
  border: 1px solid #33384a;
  border-radius: 4px;
  background: transparent;
  color: #b9c0cc;
  font-size: 0.8rem;
  cursor: pointer;
}
.play-ctl:hover {
  color: #fff;
  border-color: #566;
}
.play-close {
  border: none;
  background: transparent;
  color: #b9c0cc;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
}
.play-close:hover {
  color: #fff;
}
.play-term {
  overflow: hidden;
}
.play-error {
  max-width: 60ch;
  padding: 1rem;
  color: #ffd7d7;
}
.play-error pre {
  white-space: pre-wrap;
  color: #ff9a9a;
}
</style>
