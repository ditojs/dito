module.exports = {
  projects: [
    '<rootDir>/packages/*'
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
