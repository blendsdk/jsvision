import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import AppsGallery from './components/AppsGallery.vue';
import PlayExample from './components/PlayExample.vue';
import './custom.css';

// The JSVision docs theme is the VitePress default theme with brand tokens layered
// on via custom.css, plus the globally registered live-demo component used across
// the component and application pages.
const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('AppsGallery', AppsGallery);
    app.component('PlayExample', PlayExample);
  },
};

export default theme;
