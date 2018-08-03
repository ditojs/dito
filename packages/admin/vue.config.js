const path = require('path')
const { getExternalsFromDependencies } = require('@ditojs/webpack')

const maxSize = 1024 * 1024

module.exports = {
  configureWebpack: {
    externals: process.env.NODE_ENV === 'production'
      ? getExternalsFromDependencies()
      : {},
    performance: {
      maxEntrypointSize: maxSize,
      maxAssetSize: maxSize
    },
    resolve: {
      alias: {
        '@ditojs': path.resolve('..'),
        // This is required for sym-linked dev folder to work during yarn serve:
        '@ditojs/admin': path.resolve('./src')
      }
    }
  },

  css: {
    loaderOptions: {
      sass: {
        includePaths: ['./src/styles'],
        data: `@import './src/styles/_imports';`
      }
    }
  }
}
