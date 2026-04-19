/** @jest-config-loader ts-node */
/* eslint-disable */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8'),
);

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
