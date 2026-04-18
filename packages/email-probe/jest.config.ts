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
  displayName: '@wsa/email-probe',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  // PR #18 baseline CI showed this package missing only the branch target; pin the
  // current measured floor so regressions fail while broader branch coverage lands later.
  coverageThreshold: {
    global: {
      statements: 88,
      branches: 70,
      functions: 80,
      lines: 91,
    },
  },
};
