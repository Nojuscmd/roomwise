/** Unit tests cover the pure domain layer (rules engine), which has no React Native dependency. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  globals: {
    'ts-jest': {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        target: 'es2020',
        module: 'commonjs',
        noUncheckedIndexedAccess: true,
      },
    },
  },
};
