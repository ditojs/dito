import path from 'path'
import Koa from 'koa'
import serve from 'koa-static'
import { defineConfig, createServer } from 'vite'
import createVuePlugin from '@vitejs/plugin-vue'
import {
  viteCommonjs as createCommonJsPlugin
} from '@originjs/vite-plugin-commonjs'
import { testModuleIdentifier, getPostCssConfig } from '@ditojs/build'
import { merge } from '@ditojs/utils'
import { Controller } from './Controller.js'
import { handleConnectMiddleware } from '../middleware/index.js'
import { ControllerError } from '../errors/index.js'
import { getRandomFreePort } from '../utils/net.js'
import { formatJson } from '../utils/json.js'
import { deprecate } from '../utils/deprecate.js'

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
    // sources with HRM, and thus should be explicitly activated.
    this.mode = this.config.mode || (
      this.app.config.env === 'development' ? 'development' : 'production'
    )
    this.closed = false
  }

  getPath(name) {
    const { config } = this
    let str = config[name]
    if (config.build?.path || config.dist?.path) {
      deprecate(`config.admin.build.path and config.admin.dist.path are deprecated. Use config.admin.root and config.admin.dist instead.`)

      str = name === 'root' ? config.build?.path
        : name === 'dist' ? config.dist?.path
        : null
    }
    if (!str) {
      throw new ControllerError(
        this,
        `Missing \`config.admin.${name}\` configuration.`
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
      if (this.closed) {
        // Avoid strange behavior during shut-down of the vite dev server.
        // Sending back a 408 response seems to work best, while a 503 sadly
        // would put the client into a state that prevents the server from a
        // proper shut-down, and a 205 would kill future hot-reloads.
        ctx.status = 408 // Request Timeout
      } else if (ctx.url === '/dito.js') {
        // Don't call `next()`
        this.sendDitoObject(ctx)
      } else {
        if (/\/views\b/.test(ctx.url)) {
          await this.handleAuthorization(authorization, ctx)
        }
        await next()
      }
    }
  }

  // @override
  compose() {
    this.koa = new Koa()
    this.koa.use(this.middleware())
    if (this.mode === 'development') {
      // Calling getPath() throws exception if config.admin.root is not defined:
      if (this.getPath('root')) {
        this.app.once('after:start', () => this.setupViteServer())
      }
    } else {
      // Statically serve the pre-built admin SPA. But in order for vue-router
      // routes inside the SPA to work for sub-routes, use a tiny rewriting
      // middleware that serves up the `index.html` fur sub-routes:
      this.koa.use(async (ctx, next) => {
        // // Exclude asset requests (css, js)
        if (!ctx.url.match(/\.(?:css|js)$/)) {
          ctx.url = '/'
        }
        await next()
      })
      this.koa.use(serve(this.getPath('dist')))
    }
    return this.koa
  }

  async setupViteServer() {
    const config = this.getViteConfig()
    const development = this.mode === 'development'
    const server = await createServer({
      ...config,
      server: {
        middlewareMode: true,
        hmr: {
          // Use a random free port instead of vite's default 24678, since we
          // may be running multiple servers in parallel (e.g. e2e and dev).
          port: await getRandomFreePort()
        },
        ...(development && {
          watch: {
            // Watch the @ditojs packages while in dev mode, although they are
            // inside the node_modules folder.
            ignored: ['!**/node_modules/@ditojs/**']
          }
        })
      }
    })

    this.closed = false

    this.app.once('after:stop', () => {
      // For good timing it seems crucial to not add more ticks with async
      // signature, so we directly return the `server.close()` promise instead.
      if (!this.closed) {
        this.closed = true
        return server.close()
      }
    })

    this.koa.use(handleConnectMiddleware(server.middlewares, {
      expandMountPath: true
    }))
  }

  getViteConfig(config = {}) {
    const development = this.mode === 'development'

    const cwd = process.cwd()
    const root = this.getPath('root')
    const base = `${this.url}/`
    const views = path.join(root, 'views')

    return defineConfig(merge({
      root,
      base,
      mode: this.mode,
      envFile: false,
      configFile: false,
      plugins: [
        createVuePlugin(),
        createCommonJsPlugin(),
        {
          // Private plugin to inject script tag above main module that loads
          // the `dito` object through its own end-point, see `sendDitoObject()`
          name: 'inject-dito-object',
          transformIndexHtml: {
            enforce: 'post',
            transform(html) {
              return html.replace(
                /(\s*)(<script type="module"[^>]*?><\/script>)/,
                `$1<script src="${base}dito.js"></script>$1$2`
              )
            }
          }
        }],
      build: {
        ...(!development && {
          outDir: this.getPath('dist'),
          assetsDir: '.',
          emptyOutDir: true,
          chunkSizeWarningLimit: 1000,
          rollupOptions: {
            output: {
              manualChunks(id) {
                if (id.startsWith(views)) {
                  return 'views'
                } else if (id.startsWith(cwd)) {
                  return 'common'
                } else {
                  const module = (
                    id.match(/node_modules\/((?:@[^/]*\/)?[^/$]*)/)?.[1] || ''
                  )
                  return testModuleIdentifier(module, coreDependencies)
                    ? 'core'
                    : 'vendor'
                }
              }
            }
          }
        })
      },
      css: {
        postcss: getPostCssConfig()
      },
      optimizeDeps: {
        exclude: development ? ditoPackages : [],
        include: [
          ...(development
            // https://discuss.prosemirror.net/t/rangeerror-adding-different-instances-of-a-keyed-plugin-plugin/4242/13
            ? [
              'prosemirror-state',
              'prosemirror-transform',
              'prosemirror-model',
              'prosemirror-view'
            ]
            : ditoPackages
          ),
          ...nonEsmDependencies
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
    }, config))
  }
}

const ditoPackages = [
  '@ditojs/admin',
  '@ditojs/ui',
  '@ditojs/utils'
]

const nonEsmDependencies = [
  // All non-es modules need to be explicitly included here, and some of
  // them only work due to the use of `createCommonJsPlugin()`.
  '@lk77/vue3-color'
]

const coreDependencies = [
  ...ditoPackages,

  // TODO: Figure out a way to generate this automatically for the current
  // dito-admin dependencies, e.g. similar to
  // `getRollupExternalsFromDependencies()`, perhaps as a script to persist to
  // a json file?

  'vue',
  '@vue/*',
  '@lk77/vue3-color',
  '@kyvg/vue3-notification',
  'vue-draggable-plus',
  'vue-multiselect',
  'vue-router',
  'vue-upload-component',
  'tinycolor2',
  '@tiptap/*',
  'prosemirror-*',
  'linkifyjs',
  'codeflask',
  'punycode',
  'rope-sequence',
  'filesize',
  'filesize-parser',
  'tslib',
  'orderedmap',
  'w3c-keyname'
]
