module.exports = {
  transform: {
    '^.+\\.jsx?$': 'babel-jest-nested'
  },
  testMatch: [
    '**/src/**/?(*.)+(test).js'
  ]
}
