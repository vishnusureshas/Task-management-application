// Jest 30 native ESM config. Run via:
//   npm test  (node --experimental-vm-modules ... --runInBand)
export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  testTimeout: 30000,
};
