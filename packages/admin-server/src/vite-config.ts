import path from 'path'
import { createRequire } from 'module'
import Koa from 'koa'
import serve from 'koa-static'
import { assignDeeply, isString } from '@ditojs/utils'
import { Controller } from './Controller.js'
import { UsersController } from './UsersController.js'
import { handleConnectMiddleware } from '../middleware/index.js'
import { ControllerError } from '../errors/index.js'
import { formatJson } from '../utils/json.js'
import { importPeer } from '../utils/module.js'

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
    this.mode = (
      this.config.mode ||
      (this.app.config.env === 'development' ? 'development' : 'production')
    )
    this.isClosed = false
  }

  resolveConfigPath(name) {
    const { config } = this
    const str = config[name]
    if (!str) {
      throw new ControllerError(
        this,
        `Missing \`config.admin.${name}\` configuration.`
      )
    }
    return path.resolve(str)
  }

  getGlobalConfig() {
    // Expose api config and definitions to browser side:
    // Pass on the `config.app.normalizePaths` setting to Dito.js Admin:
    const { api = {}, settings = {} } = this.config
    // The admin logs in through the users controller at `api.users`, which it
    // reaches inside `api.url` like `getApiUrl()`:
    const { url = '/', users } = api
    const usersPath = (isString(users) ? users : users?.path) ?? ''
    const { pathname } = new URL(
      `${url.replace(/\/+$/, '')}/${usersPath.replace(/^\/+/, '')}`,
      'http://localhost'
    )
    const controller = this.app.getController(pathname.replace(/\/$/, ''))
    return {
      base: this.url,
      api: {
        ...api,
        normalizePaths: api.normalizePaths ?? this.app.config.app.normalizePaths
      },
      settings,
      authentication:
        controller instanceof UsersController
          ? controller.getAuthenticationFeatures()
          : {
              hasPasskeys: false,
              hasTotp: false,
              hasPasswordChange: false,
              hasPasswordReset: false
            }
    }
  }

  sendGlobalConfig(ctx) {
    // Send back the global dito object as JavaScript code.
    ctx.type = 'text/javascript'
    ctx.body = `window.dito = ${formatJson(this.getGlobalConfig())}`
  }

  middleware() {
    // Shield admin views against unauthorized access.
    const authorization = this.processAuthorize(this.authorize)
    return async (ctx, next) => {
      if (this.isClosed) {
        // Avoid strange behavior during shut-down of the vite dev server.
        // Sending back a 408 response seems to work best, while a 503 sadly
        // would put the client into a state that prevents the server from a
        // proper shut-down, and a 205 would kill future hot-reloads.
        ctx.status = 408 // Request Timeout
      } else if (ctx.url === '/dito.js') {
        // Don't call `next()`
        this.sendGlobalConfig(ctx)
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
      // resolveConfigPath() throws if `config.admin.root` is not defined:
      if (this.resolveConfigPath('root')) {
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
      this.koa.use(serve(this.resolveConfigPath('dist')))
    }
    return this.koa
  }

  async setupViteServer() {
    const defaultConfig = {
      server: {
        middlewareMode: true,
        // Serve HMR through the app's server, instead of on a port of its own:
        ws: { server: this.app.server },
        ...(this.mode === 'development' && {
          watch: {
            // Watch the @ditojs packages while in dev mode, although they are
            // inside the node_modules folder.
            ignored: ['!**/node_modules/@ditojs/**']
          }
        })
      }
    }

    const viteConfig = (
      (await this.app.loadAdminViteConfig()) ||
      (await this.defineViteConfig())
    )

    const { createServer } = await importPeer(this, 'vite')
    const config = assignDeeply(defaultConfig, viteConfig)
    const server = await createServer(config)

    this.isClosed = false

    // Close before the app's server, which waits for the upgraded sockets of
    // the HMR clients to end:
    this.app.once('before:stop', () => {
      // For good timing it seems crucial to not add more ticks with async
      // signature, so we directly return the `server.close()` promise instead.
      if (!this.isClosed) {
        this.isClosed = true
        return server.close()
      }
    })

    this.koa.use(
      handleConnectMiddleware(server.middlewares, {
        expandMountPath: true
      })
    )
  }

  async defineViteConfig(config = {}) {
    // The build tools are only needed to build or develop the admin:
    const { defineConfig } = await importPeer(this, 'vite')
    const { default: createVuePlugin } = await importPeer(
      this,
      '@vitejs/plugin-vue'
    )
    const { testModuleIdentifier, getPostCssConfig } = await importPeer(
      this,
      '@ditojs/build'
    )
    const isDevelopment = this.mode === 'development'

    const root = this.resolveConfigPath('root')
    const base = `${this.url}/`
    const views = path.join(root, 'views')
    const linkedSources = isDevelopment ? getLinkedSources(root) : {}

    return defineConfig(
      assignDeeply(
        {
          root,
          base,
          mode: this.mode,
          envDir: false,
          configFile: false,
          plugins: [
            createVuePlugin(),
            {
              // Private plugin to inject script tag above main module that
              // loads the `dito` object through its own end-point, see:
              // `sendGlobalConfig()`
              name: 'inject-dito-object',
              transformIndexHtml: {
                order: 'post',
                handler(html) {
                  return html.replace(
                    /(\s*)(<script type="module"[^>]*?><\/script>)/,
                    `$1<script src="${base}dito.js"></script>$1$2`
                  )
                }
              }
            },
            {
              // Private plugin to resolve linked Dito.js packages to their
              // sources, see `getLinkedSources()`:
              name: 'resolve-linked-sources',
              enforce: 'pre',
              resolveId: id => linkedSources[id],
              load: id => (id === emptyModule ? '' : null)
            }
          ],
          build: isDevelopment
            ? {}
            : {
                outDir: this.resolveConfigPath('dist'),
                assetsDir: '.',
                emptyOutDir: true,
                chunkSizeWarningLimit: 1000,
                rollupOptions: {
                  output: {
                    manualChunks: id => {
                      if (id.startsWith(views)) {
                        return 'views'
                      } else if (id.startsWith(this.app.basePath)) {
                        return 'common'
                      } else {
                        const module = id.match(
                          /node_modules\/((?:@[^/]*\/)?[^/$]*)/
                        )?.[1]
                        // Internal ids (vite modules) don't come from
                        // node_modules, and the ids actually start with \0x00.
                        return (
                          !module ||
                          testModuleIdentifier(module, coreDependencies)
                        )
                          ? 'core'
                          : 'vendor'
                      }
                    }
                  }
                }
              },
          css: {
            postcss: getPostCssConfig(),
            devSourcemap: isDevelopment,
            preprocessorOptions: {
              scss: {
                // https://sass-lang.com/documentation/breaking-changes/legacy-js-api/
                // TODO: Remove once vite has been updated to new API:
                silenceDeprecations: ['legacy-js-api']
              }
            }
          },
          optimizeDeps: {
            exclude: isDevelopment ? ditoPackages : [],
            include: [
              ...(
                isDevelopment
                  ? // https://discuss.prosemirror.net/t/rangeerror-adding-different-instances-of-a-keyed-plugin-plugin/4242/13
                    [
                      'prosemirror-state',
                      'prosemirror-transform',
                      'prosemirror-model',
                      'prosemirror-view'
                    ]
                  : ditoPackages
              )
            ]
          },
          resolve: {
            extensions: [
              '.js', '.mjs', '.jsx', '.ts', '.mts', '.tsx', '.json', '.vue'
            ],
            preserveSymlinks: false,
            alias: [
              {
                find: '@',
                replacement: root
              }
            ]
          }
        },
        config
      )
    )
  }
}

const emptyModule = '\0dito-empty-module'

const ditoPackages = [
  '@ditojs/admin',
  '@ditojs/ui',
  '@ditojs/utils'
]

const coreDependencies = [
  ...ditoPackages,

  // TODO: Figure out a way to generate this automatically for the current
  // dito-admin dependencies, e.g. similar to
  // `getRollupExternalsFromDependencies()`, perhaps as a script to persist to
  // a json file?

  'vue',
  '@vue/*',
  '@vueuse/*',
  'vue-color',
  '@kyvg/vue3-notification',
  'vue-multiselect',
  'vue-router',
  'vue-upload-component',
  'focus-trap',
  'tabbable',
  'sortablejs',
  'tippy.js',
  '@tiptap/*',
  'tiptap-*',
  'prosemirror-*',
  'linkifyjs',
  'codeflask',
  'nanoid',
  'punycode',
  'rope-sequence',
  'tslib', // ?
  'orderedmap',
  'w3c-keyname'
]

// When the app links Dito.js from a checkout, resolve its admin and UI to their
// sources, also for the app's own imports: their builds would be stale, and
// second copies next to the sources. The source components bring their styles.
function getLinkedSources(root) {
  const admin = createRequire(path.join(root, 'index.js')).resolve(
    '@ditojs/admin/src'
  )
  // Installed packages resolve inside `node_modules`, also in pnpm's store:
  return admin.split(path.sep).includes('node_modules')
    ? {}
    : {
        '@ditojs/admin': admin,
        '@ditojs/ui': createRequire(admin).resolve('@ditojs/ui/src'),
        '@ditojs/admin/style.css': emptyModule,
        '@ditojs/ui/style.css': emptyModule
      }
}
