import { getExternalsFromDependencies } from './webpack'
import { getNpmArgs } from './npm'
import { merge } from '@ditojs/utils'

export function getVueConfig(config) {
  return merge({
    css: {
      extract: false,
      loaderOptions: {
        sass: {
          includePaths: ['./src/styles'],
          data: `@import './src/styles/_imports';`
        }
      }
    },

    configureWebpack: {
      externals: process.env.NODE_ENV === 'production'
        ? getExternalsFromDependencies()
        : {}
    },

    chainWebpack: config => {
      // When in watch mode, configure webpack a bit differently:
      if (getNpmArgs().includes('watch')) {
        // - Disable 'compact' option in babel-loader:
        config.module.rule('js')
          .use('babel-loader')
          .options({ compact: false })
        // - Disable eslint, as it somehow complains about compressed imports:
        config.module.rules.delete('eslint')
      }
    }
  }, config)
}
