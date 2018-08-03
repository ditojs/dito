const path = require('path')
const { getExternalsFromDependencies } = require('@ditojs/webpack')

module.exports = {
  configureWebpack: {
    externals: process.env.NODE_ENV === 'production'
      ? getExternalsFromDependencies()
      : {},
    performance: false,
    resolve: {
      alias: {
        // This is required for sym-linked dev folder to work during yarn serve:
        '@ditojs/admin': path.resolve('./src')
      }
    }
  },

  css: {
    extract: false,
    loaderOptions: {
      sass: {
        includePaths: ['./src/styles'],
        data: `@import './src/styles/_imports';`
      }
    }
  }
}
