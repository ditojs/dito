module.exports = {
  // https://github.com/jsdom/jsdom/issues/2304:
  testURL: 'http://localhost/',
  testMatch: [
    '**/src/**/__tests__/**/*.js',
    '**/src/**/?(*.)+(test).js'
  ]
}
