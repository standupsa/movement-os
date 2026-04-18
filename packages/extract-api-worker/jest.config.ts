/* eslint-disable */
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const swcJestConfig = JSON.parse(readFileSync(`${here}/.spec.swcrc`, 'utf-8'));

swcJestConfig.swcrc = false;

export default {
  displayName: '@wsa/extract-api-worker',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
