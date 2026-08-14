import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node, not jsdom: src/core must be usable with no DOM at all. A test that reached
    // for Phaser or `document` fails here, which is how invariant 1 stays honest.
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
