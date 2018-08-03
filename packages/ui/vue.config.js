const { getExternalsFromDependencies } = require('@ditojs/webpack')

module.exports = {
  configureWebpack: {
    externals: process.env.NODE_ENV === 'production'
      ? getExternalsFromDependencies()
      : {}
  },

  css: {
    extract: false,
    loaderOptions: {
      sass: {
        includePaths: ['./src/styles'],
        data: `@import './src/styles/imports';`
      }
    }
  }
}
