import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// Relative asset URLs, so the build works from any folder, such as a GitHub Pages project site.
// The page itself is the only URL: views live in the hash.
export default defineConfig({
  base: './',
  plugins: [solid()],
});
