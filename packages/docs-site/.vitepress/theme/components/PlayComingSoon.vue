<script setup lang="ts">
/**
 * PlayComingSoon — a static placeholder for the "Live example" slot of a component
 * page whose runnable in-browser demo has not been built yet. It is purely
 * presentational (server-rendered, no terminal, no registry entry), so a page can
 * ship its full reference content now and swap in <PlayExample> later with a
 * one-line change.
 */
defineProps<{ title?: string }>();
</script>

<template>
  <div class="play-soon" role="note">
    <span class="play-soon-badge">🚧 Live demo coming soon</span>
    <p class="play-soon-text">
      An interactive, in-browser demo of
      <strong v-if="title">{{ title }}</strong
      ><span v-else>this component</span> lands in a later update. Until then, the reference below covers its full API.
    </p>
  </div>
</template>

<style scoped>
.play-soon {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1rem 0;
  padding: 1rem 1.25rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.play-soon-badge {
  align-self: flex-start;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--vp-c-brand-1, #0e7490);
}

.play-soon-text {
  margin: 0;
  color: var(--vp-c-text-2);
}
</style>
