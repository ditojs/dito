const { version: corejsVersion } = require('core-js/package')

module.exports = {
  config: {
    sourceType: 'module',
    sourceMaps: 'both',
    comments: false
  },

  presets({ loose = true } = {}) {
    return [
      ['@babel/preset-env', {
        useBuiltIns: 'usage',
        loose,
        corejs: {
          version: corejsVersion,
          proposals: true
        }
      }],
      ['@ditojs/babel-preset', {
        loose
      }]
    ]
  },

  plugins({ resolver = false, dynamicImport = false } = {}) {
    const plugins = []
    if (resolver) {
      plugins.push(
        ['module-resolver', {
          cwd: 'babelrc',
          alias: {
            '~': '.',
            '@': './src'
          }
        }]
      )
    }
    if (dynamicImport) {
      plugins.push(
        ['dynamic-import-node']
      )
    }
    return plugins
  },

  env({ loose = true, test = false } = {}) {
    const env = {}
    if (test) {
      env.test = {
        presets: [
          [
            '@babel/preset-env',
            {
              loose,
              targets: {
                node: 'current'
              }
            }
          ]
        ]
      }
    }
    return env
  }
}
