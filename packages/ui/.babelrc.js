const { version: corejsVersion } = require('core-js/package')

module.exports = {
  sourceType: 'module',
  sourceMaps: 'both',
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage',
        corejs: {
          version: corejsVersion,
          proposals: true
        }
      }
    ],
    '@ditojs/babel-preset'
  ],
  comments: false
}
