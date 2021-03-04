import path from 'path'
import Koa from 'koa'
import mount from 'koa-mount'
import serve from 'koa-static'
import koaWebpack from 'koa-webpack'
import historyApiFallback from 'koa-connect-history-api-fallback'
import VueService from '@vue/cli-service'
import HtmlWebpackTagsPlugin from 'html-webpack-tags-plugin'
import { ControllerError } from '@/errors'
import { Controller } from './Controller'
import { isString, isObject } from '@ditojs/utils'

export class AdminController extends Controller {
  // @override
  constructor(app, namespace) {
    super(app, namespace)
    // Merge `this.app.config.admin` into config as default, but allow overrides
    // on the controller itself:
    this.config = {
      ...this.app.config.admin,
      ...this.config
    }
    // If no mode is specified, use `production` since that's just the hosting
    // of the pre-built admin files. `development` serves the admin directly
    // sources with HRM, and thus should be explicitely activated.
    this.mode = this.config.mode || (
      this.app.config.env === 'development' ? 'development' : 'production'
    )
  }

  getPath(name) {
    const str = this.config[name]?.path
    if (!str) {
      throw new ControllerError(
        this,
        `Missing admin.${name}.path configuration.`
      )
    }
    return path.resolve(str)
  }

  getDitoObject() {
    // Expose api config and definitions to browser side:
    // Pass on the `config.app.normalizePaths` setting to Dito.js Admin:
    const {
      api = {},
      settings = {}
    } = this.config
    if (api.normalizePaths == null) {
      api.normalizePaths = this.app.config.app.normalizePaths
    }
    return {
      base: this.url,
      api,
      settings
    }
  }

  sendDitoObject(ctx) {
    // Send back the global dito object as JavaScript code.
    ctx.type = 'text/javascript'
    ctx.body = `window.dito = ${JSON.stringify(this.getDitoObject())}`
  }

  middleware() {
    // Shield admin views against unauthorized access.
    const authorization = this.processAuthorize(this.authorize)
    return async (ctx, next) => {
      if (/^\/dito\b/.test(ctx.url)) {
        // Return without calling `next()`
        return this.sendDitoObject(ctx)
      } else if (/\/views\b/.test(ctx.url)) {
        await this.handleAuthorization(authorization, ctx)
      }
      await next()
    }
  }

  compose() {
    this.koa = new Koa()
    this.koa.use(this.middleware())
    if (this.mode === 'development') {
      // Calling getPath() throws exception if admin.build.path is not defined:
      if (this.getPath('build')) {
        this.app.once('after:start', () => this.setupKoaWebpack())
      }
    } else {
      // Statically serve the pre-built admin SPA. But in order for vue-router
      // routes inside the SPA to work, use a tiny rewriting middleware:
      this.koa.use(async (ctx, next) => {
        // // Exclude asset requests (css, js, app)
        if (!ctx.url.match(/^\/(app\.|css\/|js\/)/)) {
          ctx.url = '/'
        }
        await next()
      })
      this.koa.use(serve(this.getPath('dist')))
    }
    return mount(this.url, this.koa)
  }

  async setupKoaWebpack() {
    // https://webpack.js.org/configuration/stats/#stats
    const stats = {
      all: false,
      errors: true,
      errorDetails: true
    }

    const middleware = await koaWebpack({
      config: this.getWebpackConfig(),
      devMiddleware: {
        publicPath: '/',
        stats
      },
      hotClient: this.config.hotReload !== false && {
        // The only way to not log `Failed to parse source map` warnings is
        // sadly to ignore all warnings:
        // https://github.com/webpack-contrib/webpack-hot-client/issues/94
        logLevel: 'error',
        stats
      }
    })
    this.koa.use(historyApiFallback())
    this.koa.use(middleware)
  }

  getVueConfig() {
    const development = this.mode === 'development'
    const {
      build = {},
      devtool = development ? 'source-map' : false
    } = this.config
    return {
      runtimeCompiler: true,
      publicPath: `${this.url}/`,
      configureWebpack: {
        devtool,
        // We always need the source build path as entry, even for production,
        // for things like .babelrc to work when building for dist:
        entry: [this.getPath('build')],
        resolve: {
          alias: {
            // See https://github.com/webpack-contrib/webpack-hot-client/pull/62
            'webpack-hot-client/client':
              require.resolve('webpack-hot-client/client')
          }
        },
        output: {
          filename: '[name].[hash].js'
        },
        optimization: {
          splitChunks: {
            // Split dependencies into two chunks, one for all common libraries,
            // and one for all views, so they can be loaded separately, and only
            // once authentication was successful.
            cacheGroups: {
              common: {
                name: 'common',
                test: /\/node_modules\//,
                chunks: 'all'
              },
              views: {
                name: 'views',
                test: /\/views\//,
                chunks: 'all'
              }
            }
          }
        },
        module: development
          // Preserve source-maps in third party dependencies, but do not log
          // warnings about dependencies that don't come with source-maps.
          // https://webpack.js.org/loaders/source-map-loader/#ignoring-warnings
          ? {
            rules: [
              {
                test: /\.(js|css)$/,
                enforce: 'pre',
                // Use `require.resolve()` here too, to avoid issues similar to
                // 'webpack-hot-client/client' above.
                use: [require.resolve('source-map-loader')]
              }
            ]
          }
          : {},
        plugins: [
          // Use `HtmlWebpackTagsPlugin` plugin to inject a script tag that
          // load the dito object from the controller, including `dito.settings`
          new HtmlWebpackTagsPlugin({
            scripts: ['dito.js'],
            useHash: true,
            addHash: (path, hash) => path.replace(/\.js$/, `.${hash}.js`),
            append: false
          })
        ],
        stats: {
          warningsFilter: /Failed to parse source map/
        }
      },

      chainWebpack: conf => {
        // Change the location of the HTML template:
        const { template = 'index.html' } = build
        conf.plugin('html').tap(args => {
          args[0].template = /^[./]/.test(template)
            ? path.resolve(template)
            : path.join(this.getPath('build'), template)
          return args
        })
        if (development) {
          // Disable the 'compact' option in babel-loader during development to
          // prevent complaints when working with the `yarn watch` versions of
          // dito-admin.umd.min.js and dito-ui.umd.min.js
          const jsRule = conf.module.rule('js')
          const hasBabel = jsRule.toConfig().use?.some(
            ({ loader }) => /\bbabel-loader\b/.test(loader)
          )
          if (hasBabel) {
            jsRule.use('babel-loader').options({ compact: false })
          }
          // Make `stats.warningsFilter` work, see:
          // https://forum.vuejs.org/t/sppress-warnings-in-vue-cli-3/45905/4
          conf.plugins.delete('friendly-errors')
        }
      }
    }
  }

  getVuePlugins() {
    return this.config.plugins?.map(definition => {
      const plugin = isString(definition)
        ? { id: definition }
        : isObject(definition)
          ? definition
          : {}
      const {
        id,
        apply = require(id)
      } = plugin
      if (!id) {
        throw new ControllerError(
          this,
          `Invalid plugin definition: ${definition}`
        )
      }
      return { id, apply }
    })
  }

  getWebpackConfig() {
    const service = new VueService(this.getPath('build'), {
      inlineOptions: this.getVueConfig(),
      plugins: this.getVuePlugins()
    })
    service.init(this.mode)
    return service.resolveWebpackConfig()
  }
}
