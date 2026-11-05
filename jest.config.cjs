module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/fees/**/*.test.js', '**/tests/attendance/**/*.test.js'],
  transform: {
    '^.+\\.tsx?$': '<rootDir>/tests/esbuild-transform.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/fees/setup.js', '<rootDir>/tests/attendance/setup.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 120000,
};
