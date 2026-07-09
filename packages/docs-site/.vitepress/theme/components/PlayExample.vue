<script setup lang="ts">
/**
 * PlayExample — the client-only Play button that runs a live example in an xterm.js
 * terminal inside a modal. All browser-only code (xterm + the play controller) is
 * loaded via dynamic import() inside the Play handler, so the component is SSR-safe
 * and xterm is code-split out of the initial page bundle.
 *
 * Closing: the × button and a backdrop click close the dialog. Escape is deliberately
 * NOT bound here — it flows into the terminal so the hosted TUI keeps its own Escape.
 */
import { ref, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps<{ id: string; title?: string }>();

const isOpen = ref(false);
const errorMessage = ref<string | null>(null);
const termHost = ref<HTMLElement | null>(null);

// The controller is browser-only (loaded on first Play); keep it untyped here to avoid
// pulling the browser host types into the SSR graph.
let controller: { open(el: HTMLElement): Promise<void>; close(): void } | null = null;
let focused = false;

async function play(): Promise<void> {
  errorMessage.value = null;
  isOpen.value = true;
  await nextTick(); // let the modal (and its terminal host div) render before mounting

  const host = termHost.value;
  if (!host) return;

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
    return;
  }

  controller = playController.createPlayController({
    entry,
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

  await controller.open(host);
  focused = true;
}

function close(): void {
  controller?.close();
  controller = null;
  isOpen.value = false;
  focused = false;
}

onBeforeUnmount(close);
</script>

<template>
  <div class="play-example">
    <button
      class="play-button"
      type="button"
      :aria-label="`Run the ${props.title ?? props.id} example in a terminal`"
      @click="play"
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
          <button class="play-close" type="button" aria-label="Close the example" @click="close">×</button>
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
