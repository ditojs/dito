import path from 'path'
import Koa from 'koa'
import mount from 'koa-mount'
import serve from 'koa-static'
import { defineConfig, createServer } from 'vite'
import { createVuePlugin } from 'vite-plugin-vue2'
import {
  viteCommonjs as createCommonJsPlugin
} from '@originjs/vite-plugin-commonjs'
import { handleConnectMiddleware } from '@/middleware'
import { Controller } from './Controller'
import { ControllerError } from '@/errors'
import { formatJson } from '@/utils'

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
    ctx.body = `window.dito = ${formatJson(this.getDitoObject())}`
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
        this.app.once('after:start', () => this.setupViteServer())
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

  async setupViteServer() {
    const config = this.getViteConfig()
    const server = await createServer({
      ...config,
      server: {
        middlewareMode: 'html',
        watch: {
          // Watch the @ditojs packages while in dev mode, although they are
          // inside the node_modules folder.
          // TODO: This should only really be done if they are symlinked.
          ignored: ['!**/node_modules/@ditojs/**']
        }
      }
    })
    this.koa.use(handleConnectMiddleware(server.middlewares, {
      expandMountPath: true
    }))
  }

  getViteConfig() {
    const development = this.mode === 'development'

    const root = this.getPath('build')

    const ditoDeps = [
      '@ditojs/admin',
      '@ditojs/ui',
      '@ditojs/utils'
    ]

    return defineConfig({
      root,
      base: `${this.url}/`,
      mode: this.mode,
      envFile: false,
      configFile: false,
      plugins: [createVuePlugin(), createCommonJsPlugin()],
      optimizeDeps: {
        exclude: development ? ditoDeps : [],
        include: [
          ...(development ? [] : ditoDeps),
          // All non-es modules need to be explicitly included here, and some of
          // them only work due to the use of `createCommonJsPlugin()`.
          'vue-color',
          'vue-js-modal',
          'vue-multiselect',
          'vue-notification',
          'lowlight'
        ]
      },
      resolve: {
        extensions: ['.js', '.json', '.vue'],
        preserveSymlinks: true,
        alias: [
          {
            find: '@',
            replacement: root
          }
        ]
      }
    })

    /*
    const {
      build: {
        template = 'index.html'
      } = {},
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
        stats: {
          warningsFilter: /Failed to parse source map/
        }
      }
    }
    */
  }
}
