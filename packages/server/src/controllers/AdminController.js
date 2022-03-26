import path from 'path'
import fs from 'fs'
import Koa from 'koa'
import serve from 'koa-static'
import { defineConfig, createServer } from 'vite'
import { createVuePlugin } from 'vite-plugin-vue2'
import {
  viteCommonjs as createCommonJsPlugin
} from '@originjs/vite-plugin-commonjs'
import { findUpSync } from 'find-up'
import { merge } from '@ditojs/utils'
import { Controller } from './Controller.js'
import { handleConnectMiddleware } from '../middleware/index.js'
import { ControllerError } from '../errors/index.js'
import { formatJson, deprecate } from '../utils/index.js'

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
      if (ctx.url === '/dito.js') {
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

  getViteConfig(config = {}) {
    const development = this.mode === 'development'

    const cwd = path.resolve('.')
    const root = this.getPath('root')
    const base = `${this.url}/`
    const views = path.join(root, 'views')

    // Read `package.json` from the closest package.json, so we can emulate
    // ESM-style imports mappings in rollup / vite.
    const pkg = findUpSync('package.json', { cwd: root })
    const { imports = {} } = JSON.parse(fs.readFileSync(pkg, 'utf8'))

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
        ...(development
          ? {}
          : {
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
                    const module = id.match(/node_modules\/([^/$]*)/)?.[1] || ''
                    const match = CORE_DEPENDENCIES.some(
                      id => matchIdentifier(module, id).match
                    )
                    return match ? 'core' : 'vendor'
                  }
                }
              }
            }
          }
        )
      },
      optimizeDeps: {
        exclude: development ? DITO_PACKAGES : [],
        include: [
          ...(development ? [] : DITO_PACKAGES),
          ...NON_ESM_DEPENDENCIES
        ]
      },
      resolve: {
        extensions: ['.js', '.json', '.vue'],
        preserveSymlinks: true,
        alias: [
          {
            find: '@',
            replacement: root
          },
          {
            // Use a custom rollup resolver to emulate ESM-style imports
            // mappings in vite, as read from `package.json` above:
            find: /^#/,
            replacement: '#',
            customResolver(id) {
              for (const [find, replacement] of Object.entries(imports)) {
                const { match, capture } = matchIdentifier(id, find)
                if (match) {
                  const replacementPath = path.resolve(replacement)
                  id = capture
                    ? replacementPath.replace('*', capture)
                    : replacementPath
                }
              }
              return id
            }
          }
        ]
      }
    }, config))
  }
}

function matchIdentifier(id, pattern) {
  const regexp = new RegExp(`^${pattern.replace('*', '(.*)')}$`)
  const match = id.match(regexp)
  return {
    match: !!match,
    capture: match?.[1]
  }
}

const DITO_PACKAGES = [
  '@ditojs/admin',
  '@ditojs/ui',
  '@ditojs/utils'
]

const NON_ESM_DEPENDENCIES = [
  // All non-es modules need to be explicitly included here, and some of
  // them only work due to the use of `createCommonJsPlugin()`.
  'vue-color',
  'vue-js-modal',
  'vue-multiselect',
  'vue-notification',
  'lowlight'
]

const CORE_DEPENDENCIES = [
  ...DITO_PACKAGES,

  // TODO: Figure out a way to generate this automatically for the current
  // dito-admin dependencies, e.g. similar to
  // `getRollupExternalsFromDependencies()`, perhaps as a script to persist to
  // a json file?

  'vue',
  'vue-color',
  'vue-js-modal',
  'vue-multiselect',
  'vue-notification',
  'vue-router',
  'vue-upload-component',
  'vuedraggable',

  'axios',
  'core-js',
  'lowlight',
  'sortablejs',
  'tiptap',
  'tiptap-*',
  'tslib',
  'prosemirror-*',
  'codeflask',
  'rope-sequence',
  'tinycolor2',
  'fault',
  'filesize',
  'filesize-parser',
  'format',
  'highlight.js',
  'orderedmap',
  'w3c-keyname'
]
