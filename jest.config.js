module.exports = {
  projects: [
    // '<rootDir>/packages/*' <- Use this once all projects have tests.
    '<rootDir>/packages/utils',
    '<rootDir>/packages/router',
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
