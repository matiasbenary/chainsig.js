import { type Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(m?ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@chain-adapters/(.*)$': '<rootDir>/src/chain-adapters/$1',
    '^@contracts/(.*)$': '<rootDir>/src/contracts/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@utils/cryptography$': '<rootDir>/__mocks__/utils-cryptography.ts',
    '^@constants$': '<rootDir>/src/constants.ts',
    '^@types$': '<rootDir>/src/types.ts',
    '^@chain-adapters$': '<rootDir>/src/chain-adapters/index.ts',
    '^@contracts$': '<rootDir>/src/contracts/index.ts',
    '^@utils$': '<rootDir>/src/utils/index.ts',
    '^elliptic$': '<rootDir>/__mocks__/elliptic.ts',
    '^js-sha3$': '<rootDir>/__mocks__/js-sha3.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleDirectories: ['node_modules'],
  // For ES modules compatibility
  testRunner: 'jest-circus/runner',
  transformIgnorePatterns: ['/node_modules/(?!(@cosmjs|bitcoinjs-lib)/)'],
  workerThreads: true,
  maxWorkers: 1,
}

export default config
