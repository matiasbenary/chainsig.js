import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@chain-adapters/(.*)$': '<rootDir>/src/chain-adapters/$1',
    '^@contracts/(.*)$': '<rootDir>/src/contracts/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types$': '<rootDir>/src/types',
    '^@constants$': '<rootDir>/src/constants',
    '^@chains/(.*)$': '<rootDir>/src/chains/$1',
    '^@chains$': '<rootDir>/src/chains',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(bn.js|@account-kit|@noble/curves)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default config
