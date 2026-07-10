<script setup lang="ts">
/**
 * PlayExample — the client-only Play button that runs a live example in an xterm.js
 * terminal inside a modal. All browser-only code (xterm + the play controller) is
 * loaded via dynamic import() inside the Play handler, so the component is SSR-safe
 * and xterm is code-split out of the initial page bundle.
 *
 * Accessibility: the blurb and Play button are server-rendered (in the DOM without
 * JS). On open, focus moves into the dialog (the × button) rather than the terminal,
 * so keyboard users are not trapped; on close it returns to the Play button. A touch
 * device with no keyboard is shown a recorded screenshot (or, until that asset
 * exists, a short note).
 *
 * Sizing: the modal opens at a comfortable default and is user-resizable (drag the
 * bottom-right corner). The chosen size is remembered (in cells, via localStorage) and
 * restored on the next open; Reset returns it to the default.
 *
 * Closing: only the × button closes the dialog. A backdrop (outside) click does NOT —
 * that would interrupt dragging the modal's resize handle, and the × is always present.
 * Escape is deliberately NOT bound here — it flows into the terminal so the hosted TUI
 * keeps its own Escape.
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
const highlighted = ref(false);

type SizeSpec = { width: number; height: number };
type Controller = {
  open(el: HTMLElement): Promise<void>;
  close(): void;
  remount(next: { size?: SizeSpec }): Promise<void>;
};
let controller: Controller | null = null;
let focused = false;

// Resize wiring: the fit addon (lifted out of createTerminal so the observer can drive it), the
// container observer, the measured cell size (to persist the size in cells), and a rAF debounce guard.
let currentFit: { fit(): void } | null = null;
let resizeObserver: ResizeObserver | null = null;
let cellW = 0;
let cellH = 0;
let rafPending = false;
// The <html> overflow we swap for a scroll-lock while the modal is open (restored verbatim on close).
let prevHtmlOverflow = '';
// Stop the wheel over the terminal from scrolling the page or triggering ctrl+wheel browser zoom,
// while still letting xterm forward it to the app. This MUST be a capture-phase listener: xterm
// calls stopPropagation() on the wheel in the target phase, so a bubble-phase listener on this host
// never sees the event. preventDefault here cancels only the browser's default action (scroll/zoom),
// not xterm's own handling — the terminal still receives the wheel and the app still scrolls.
const preventWheel = (e: WheelEvent): void => e.preventDefault();

/** The modal's default cell grid — comfortably larger than a bare 80×24, and still fits a laptop screen. */
const DEFAULT_CELLS: SizeSpec = { width: 120, height: 36 };

// The modal is user-resizable (CSS `resize: both`); we persist the resulting size in cells so the next
// open restores it. Cells (not pixels) survive font/zoom changes. Reset clears it back to the default.
const SIZE_KEY = 'jsvision:play-modal-size';

/** The remembered modal size in cells, or null when none is saved or storage is unavailable. */
function loadRememberedSize(): SizeSpec | null {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<SizeSpec>;
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return { width: parsed.width, height: parsed.height };
    }
  } catch {
    /* storage blocked (private mode) or malformed JSON — fall back to the default */
  }
  return null;
}

/** Persist the modal size (in cells) so the next open restores it. Best-effort — storage may be blocked. */
function saveRememberedSize(cells: SizeSpec): void {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify(cells));
  } catch {
    /* storage blocked — remembering is best-effort */
  }
}

/** Forget the remembered size so the next open falls back to {@link DEFAULT_CELLS}. */
function clearRememberedSize(): void {
  try {
    localStorage.removeItem(SIZE_KEY);
  } catch {
    /* storage blocked — nothing to clear */
  }
}

/** Save the modal's current cell grid, derived from the host's pixel size and the measured cell size. */
function rememberCurrentSize(): void {
  const host = termHost.value;
  if (host === null || cellW <= 0 || cellH <= 0) return;
  saveRememberedSize({
    width: Math.max(1, Math.round(host.clientWidth / cellW)),
    height: Math.max(1, Math.round(host.clientHeight / cellH)),
  });
}

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
    size: DEFAULT_CELLS,
    createTerminal: (el: HTMLElement) => {
      // Open at the remembered size (or the default) so the modal restores whatever the user last
      // dragged it to. The fit addon then trims it to the viewport if it is larger than the screen.
      const preset = loadRememberedSize() ?? DEFAULT_CELLS;
      const term = new xterm.Terminal({
        cols: preset.width,
        rows: preset.height,
        allowProposedApi: true,
        cursorBlink: true,
        fontSize: 14,
      });
      const fit = new fitAddon.FitAddon();
      term.loadAddon(fit);
      term.open(el);
      try {
        term.loadAddon(new webglAddon.WebglAddon()); // crisp box-drawing; falls back to DOM renderer
      } catch {
        /* no WebGL — the DOM renderer still draws Unicode */
      }
      fit.fit();
      // Lift the fit addon + measure the cell size so the observer can refit and persist the size in cells.
      currentFit = fit;
      cellW = el.clientWidth / Math.max(1, term.cols);
      cellH = el.clientHeight / Math.max(1, term.rows);
      term.textarea?.addEventListener('focus', () => (focused = true));
      term.textarea?.addEventListener('blur', () => (focused = false));
      return term;
    },
    // Reclaim browser chords only while the dialog is open AND the terminal has focus.
    isFocused: () => isOpen.value && focused,
    onError: (message: string) => {
      errorMessage.value = message;
    },
    // The hosted app's own Exit (System ▸ Exit → quit) dismisses the modal, just like the × button.
    onClose: () => close(),
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

  // Freeze the fitted box as the resize handle's starting size, then make it genuinely resizable:
  // a ResizeObserver refits the terminal on every drag, and mountApp routes the terminal's onResize
  // to loop.resize, so the app tracks any size live — no remount, no viewport/terminal desync.
  host.style.width = `${host.clientWidth}px`;
  host.style.height = `${host.clientHeight}px`;
  resizeObserver = new ResizeObserver(() => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      currentFit?.fit();
      rememberCurrentSize(); // persist the dragged size so the next open restores it
    });
  });
  resizeObserver.observe(host);
  // Capture phase (see preventWheel) so the listener runs before xterm stops the event's propagation.
  host.addEventListener('wheel', preventWheel, { capture: true, passive: false });

  // Lock the page scroll behind the modal — conventional modal behaviour, and a robust second line
  // of defence for the wheel: the background cannot scroll no matter how the wheel event is routed.
  prevHtmlOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  // Move focus into the dialog (not the terminal) so keyboard users are not trapped.
  closeButton.value?.focus();
}

function close(): void {
  controller?.close();
  controller = null;
  // Tear down the resize wiring while the terminal host is still mounted (before the v-if unmounts it).
  resizeObserver?.disconnect();
  resizeObserver = null;
  currentFit = null;
  // Restore the page scroll-lock unconditionally (even if the terminal host is already gone).
  document.documentElement.style.overflow = prevHtmlOverflow;
  const host = termHost.value;
  if (host) {
    // The capture flag must match the addEventListener call for removal to take effect.
    host.removeEventListener('wheel', preventWheel, { capture: true });
    host.style.width = '';
    host.style.height = '';
  }
  isOpen.value = false;
  focused = false;
  playButton.value?.focus(); // return focus to the trigger
}

async function reset(): Promise<void> {
  clearRememberedSize(); // Reset restores the default size too, not just the app state
  await controller?.remount({});
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

    <div v-if="isOpen" class="play-backdrop">
      <div
        class="play-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="`${props.title ?? props.id} — live terminal`"
      >
        <div class="play-modal-bar">
          <span class="play-hint"
            >Drag the bottom-right corner to resize. Click × (or press Alt+X) to exit; Escape goes to the app.</span
          >
          <span class="play-controls">
            <button class="play-ctl" type="button" @click="reset">Reset</button>
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
  /* Genuinely resizable: a drag handle in the corner; the ResizeObserver refits the terminal. The
     min floors the terminal near 40×12 so a tiny drag can't collapse the app. */
  resize: both;
  min-width: 360px;
  min-height: 200px;
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
