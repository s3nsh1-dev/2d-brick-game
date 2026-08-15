import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Permanent, and measured rather than assumed.
    //
    // Phaser ships prebuilt webpack bundles — `dist/phaser.esm.js` is bundler output, not
    // tree-shakeable ES modules — so nothing this project does at build time can drop the
    // subsystems it never uses. The one real lever is Phaser's own arcade-only variant, and
    // Stage 3 Pass D measured what it would buy: 1344 kB -> 1237 kB minified, 346 kB -> 314
    // kB gzipped. An 8% saving, in exchange for aliasing to a UMD bundle whose shipped types
    // still describe the full build — the type surface would promise a Matter physics that
    // is not there. Not worth it for a static page that loads once.
    //
    // AGENTS.md requires a warning-free build, so the threshold is raised deliberately
    // rather than the warning being tolerated.
    chunkSizeWarningLimit: 2000,
  },
});
