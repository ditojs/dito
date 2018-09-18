import path from 'path'
import Koa from 'koa'
import mount from 'koa-mount'
import koaWebpack from 'koa-webpack'
import historyApiFallback from 'koa-connect-history-api-fallback'
import VueService from '@vue/cli-service'
import vuePluginBabel from '@vue/cli-plugin-babel'
import vuePluginEslint from '@vue/cli-plugin-eslint'
import { ControllerError } from '@/errors'
import { Controller } from './Controller'

export class AdminController extends Controller {
  // @override
  compose() {
    const config = { ...this.app.config.admin, ...this.config }
    if (!config.build) {
      throw new ControllerError(this, 'Missing build configuration.')
    }
    this.koa = new Koa()

    const authorization = this.processAuthorize(this.authorize)
    // Shield admin views against unauthorized access.
    this.koa.use(async (ctx, next) => {
      if (/\/views/.test(ctx.request.url)) {
        await this.handleAuthorization(authorization, ctx)
      }
      return next()
    })
    if (config.build.disabled !== true) {
      this.app.once('after:start', () => this.setupWebpack(config))
      // TODO: Consider implementing static serving of built resources from
      // `config.path`, for production hosting:
      // if (this.app.config.env === 'development') {
      //   this.app.once('after:start', () => this.setupWebpack())
      // } else {
      //    ...
      // }
    }
    return mount(this.url, this.koa)
  }

  async setupWebpack(config) {
    // https://webpack.js.org/configuration/stats/#stats
    const stats = {
      all: false,
      errors: true,
      errorDetails: true
    }
    const middleware = await koaWebpack({
      config: this.getWebpackConfig(config),
      devMiddleware: {
        publicPath: '/',
        stats
      },
      hotClient: {
        stats
      }
    })
    this.koa.use(historyApiFallback())
    this.koa.use(middleware)
  }

  getWebpackConfig(config, mode = 'development') {
    const { build = {}, api = {}, settings } = config
    const resolvedPath = path.resolve(build.path)
    // Use VueCliService to create full webpack config for us:
    const plugins = [{ id: '@vue/cli-plugin-babel', apply: vuePluginBabel }]
    if (build.eslint) {
      plugins.push({ id: '@vue/cli-plugin-eslint', apply: vuePluginEslint })
    }
    const service = new VueService(resolvedPath, {
      inlineOptions: {
        runtimeCompiler: true,
        configureWebpack: {
          entry: [resolvedPath],
          output: {
            filename: '[name].[hash].js',
            publicPath: `${this.url}/`
          },
          optimization: {
            splitChunks: {
              // Split dependencies into two chunks, one for all common
              // libraries, and one for all views, so they can be loaded
              // separately, and only once authentication was successful.
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
          }
        },
        chainWebpack: conf => {
          // Change the location of the HTML template:
          const { template = 'index.html' } = build
          conf.plugin('html').tap(args => {
            args[0].template = /^[./]/.test(template)
              ? path.resolve(template)
              : path.join(resolvedPath, template)
            return args
          })
          // Expose api config and definitions to browser side:
          // Pass on the `config.app.normalizePaths` setting to Dito.js Admin:
          api.normalizePaths = this.app.config.app.normalizePaths
          conf.plugin('define').tap(args => {
            args[0]['window.dito'] = JSON.stringify({
              url: this.url,
              api,
              settings
            })
            return args
          })
          // Remove HotModuleReplacementPlugin as it gets added by koaWebpack:
          conf.plugins.delete('hmr')
        }
      },
      plugins
    })
    service.init(mode)
    return service.resolveWebpackConfig()
  }
}
