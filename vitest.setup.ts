import '@testing-library/jest-dom';
import { afterEach, beforeAll, afterAll } from 'vitest';

// Only cleanup React components if testing frontend
let isReactTest = false;

beforeAll(() => {
  // Detect if this is a frontend test
  isReactTest = typeof document !== 'undefined';
});

afterEach(() => {
  if (isReactTest) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { cleanup } = require('@testing-library/react');
      cleanup();
    } catch {
      // Not a React test
    }
  }
});

afterAll(async () => {
  // Clean up after all tests
});
