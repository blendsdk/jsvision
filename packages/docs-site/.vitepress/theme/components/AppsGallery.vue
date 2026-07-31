<script setup lang="ts">
/**
 * Responsive application gallery for the Apps overview.
 *
 * Static screenshots make all eight choices immediately scannable. The live links then reuse the
 * existing example deep-link contract, so the terminal runtime remains lazy until a visitor asks
 * to run an application.
 */
import { withBase } from 'vitepress';
import { APP_GALLERY_ENTRIES } from '../../../src/apps/apps-gallery.js';

/** Build a base-aware URL that opens an application's existing detail page and live terminal. */
function liveExampleUrl(page: string, exampleId: string): string {
  return `${withBase(page)}?example=${encodeURIComponent(exampleId)}`;
}
</script>

<template>
  <div class="apps-gallery">
    <article v-for="entry in APP_GALLERY_ENTRIES" :key="entry.exampleId" class="app-card">
      <a class="app-card-image-link" :href="withBase(entry.page)" :aria-label="`Learn about ${entry.title}`">
        <img
          class="app-card-image"
          :src="withBase(entry.screenshot)"
          :alt="entry.screenshotAlt"
          width="1011"
          height="628"
          loading="lazy"
        />
      </a>
      <div class="app-card-body">
        <div class="app-card-heading">
          <h3>{{ entry.title }}</h3>
          <span class="app-card-level">{{ entry.level }}</span>
        </div>
        <p>{{ entry.description }}</p>
        <ul class="app-card-capabilities" :aria-label="`${entry.title} capabilities`">
          <li v-for="capability in entry.capabilities" :key="capability">{{ capability }}</li>
        </ul>
        <div class="app-card-actions">
          <a :href="withBase(entry.page)">Learn more</a>
          <a class="app-card-run" :href="liveExampleUrl(entry.page, entry.exampleId)">▶ Run live</a>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.apps-gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  margin: 1.5rem 0 2.5rem;
}

.app-card {
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.app-card:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

.app-card-image-link {
  display: block;
  border-bottom: 1px solid var(--vp-c-divider);
  background: #0b0b12;
}

.app-card-image {
  display: block;
  width: 100%;
  height: auto;
  margin: 0;
  aspect-ratio: 1011 / 628;
  object-fit: cover;
}

.app-card-body {
  padding: 1rem 1.1rem 1.1rem;
}

.app-card-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.app-card-heading h3 {
  margin: 0;
  border: 0;
  padding: 0;
  font-size: 1.08rem;
}

.app-card-level {
  flex: none;
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  font-weight: 600;
}

.app-card-body p {
  min-height: 3em;
  margin: 0.65rem 0 0.8rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.app-card-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.app-card-capabilities li {
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 0.75rem;
  font-weight: 600;
}

.app-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  font-weight: 600;
}

.app-card-run {
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
}

.app-card-run:hover {
  background: var(--vp-c-brand-2);
  color: var(--vp-c-white);
}

@media (max-width: 720px) {
  .apps-gallery {
    grid-template-columns: 1fr;
  }

  .app-card-body p {
    min-height: 0;
  }
}
</style>
