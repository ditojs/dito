const path = require('path')
const { getVueConfig } = require('@ditojs/build')

module.exports = getVueConfig({
  configureWebpack: {
    devtool: 'source-map',
    performance: false,
    resolve: {
      alias: {
        // @ditojs/utils use 'os' internally, webpack 5 now needs this:
        // TODO: Remove dependency on 'os' in @ditojs/utils.
        'os': require.resolve('os-browserify/browser'),
        // This is required for sym-linked dev folder to work during yarn serve:
        '@ditojs/admin': path.resolve('./src')
      }
    }
  }
})
