import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Phaser is a single ~1.3MB module graph with no meaningful split point, so it will
    // always exceed Vite's 500kB default and manual chunking cannot bring it under.
    // AGENTS.md requires a warning-free build, so the threshold is raised deliberately
    // rather than the warning being tolerated.
    chunkSizeWarningLimit: 2000,
  },
});
