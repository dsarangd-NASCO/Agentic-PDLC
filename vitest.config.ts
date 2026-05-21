import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '.next/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/index.ts',
        'src/main.ts',
      ],
    },
    include: ['tests/**/*.spec.ts', 'app/**/*.spec.ts', 'lib/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@entities': path.resolve(__dirname, './src/entities'),
      '@use-cases': path.resolve(__dirname, './src/use-cases'),
      '@adapters': path.resolve(__dirname, './src/interface-adapters'),
      '@frameworks': path.resolve(__dirname, './src/frameworks'),
      '@common': path.resolve(__dirname, './src/common'),
      '@config': path.resolve(__dirname, './src/config'),
    },
  },
});
