import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import PlayExample from './components/PlayExample.vue';
import './custom.css';

// The JSVision docs theme is the VitePress default theme with brand tokens layered
// on via custom.css, plus the globally-registered <PlayExample> live-demo component
// used across the component/app pages.
const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PlayExample', PlayExample);
  },
};

export default theme;
