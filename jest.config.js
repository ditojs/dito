module.exports = {
  projects: [
    // '<rootDir>/packages/*' <- Use this once all projects have tests.
    '<rootDir>/packages/utils',
    '<rootDir>/packages/server'
  ],
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    '**/src/**/*.js'
  ],
  coverageReporters: [
    'text',
    'lcov'
  ]
}
