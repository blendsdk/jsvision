import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import PlayExample from './components/PlayExample.vue';
import PlayComingSoon from './components/PlayComingSoon.vue';
import './custom.css';

// The JSVision docs theme is the VitePress default theme with brand tokens layered
// on via custom.css, plus the globally-registered live-demo components used across
// the component/app pages: <PlayExample> (a runnable terminal demo) and
// <PlayComingSoon> (the placeholder for pages whose demo isn't built yet).
const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PlayExample', PlayExample);
    app.component('PlayComingSoon', PlayComingSoon);
  },
};

export default theme;
