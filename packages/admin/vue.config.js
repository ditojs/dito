const path = require('path')
const { getVueConfig } = require('@ditojs/build')

module.exports = getVueConfig({
  configureWebpack: {
    devtool: 'source-map',
    performance: false,
    resolve: {
      alias: {
        // This is required for sym-linked dev folder to work during yarn serve:
        '@ditojs/admin': path.resolve('./src')
      }
    }
  }
})
