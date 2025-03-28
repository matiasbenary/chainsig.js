export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/__tests__"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^@chains$": "<rootDir>/src/chains",
    "^@chains/(.*)$": "<rootDir>/src/chains/$1",
    "^@utils$": "<rootDir>/src/utils",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@constants$": "<rootDir>/src/constants",
    "^@types$": "<rootDir>/src/types",
    "^@contracts$": "<rootDir>/src/contracts",
    "^@contracts/(.*)$": "<rootDir>/src/contracts/$1",
    "^@chain-adapters$": "<rootDir>/src/chain-adapters",
    "^@chain-adapters/(.*)$": "<rootDir>/src/chain-adapters/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};
