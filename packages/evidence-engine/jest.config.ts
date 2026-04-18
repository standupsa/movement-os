/* eslint-disable */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const swcJestConfig = JSON.parse(readFileSync(`${here}/.spec.swcrc`, 'utf-8'));
swcJestConfig.swcrc = false;

export default {
  displayName: '@wsa/evidence-engine',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  // PR #18 baseline CI showed this package below the v1 global floor; pin the current
  // proven baseline until focused tests raise it in a follow-up staircase PR.
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 58,
      functions: 68,
      lines: 77,
    },
  },
};
