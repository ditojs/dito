const { getVueConfig } = require('@ditojs/build')

module.exports = getVueConfig({
  configureWebpack: {
    devtool: 'source-map',
    performance: false,
    resolve: {
      fallback: {
        os: require.resolve('os-browserify/browser')
      }
    }
  }
})
