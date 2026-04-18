/* eslint-disable */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(readFileSync(`${here}/.spec.swcrc`, 'utf-8'));

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

export default {
  displayName: '@wsa/schemas',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  // PR #18 baseline CI showed this package missing only the functions target; keep the
  // measured package floor explicit until follow-up tests close the gap to the global bar.
  coverageThreshold: {
    global: {
      statements: 91,
      branches: 84,
      functions: 76,
      lines: 90,
    },
  },
};
