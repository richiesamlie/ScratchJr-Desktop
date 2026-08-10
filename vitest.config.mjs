import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        globals: false,
        testTimeout: 10000,
    },
});
