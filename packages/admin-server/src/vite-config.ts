import path from 'node:path'
import { createRequire } from 'node:module'
import type { InlineConfig } from 'vite'
import { assignDeeply } from '@ditojs/utils'
import { normalizeBase } from './base.ts'

// The Vite config of the admin, for its build and for `serveAdmin()` in
// development. The app's own config file can call it to build the admin, and
// pass the result to `serveAdmin()` as `vite`.

export interface AdminViteOptions {
  // The admin's sources, with `index.html` and `views/`.
  root: string
  // The path the admin is served at, such as `/admin`.
  base: string
  mode?: 'production' | 'development'
  // Where the build writes the admin, needed for production builds.
  dist?: string
  // The app's own code outside the views goes into the `common` chunk. It
  // defaults to the current directory.
  basePath?: string
}

export async function defineAdminViteConfig(
  options: AdminViteOptions,
  config: InlineConfig = {}
): Promise<InlineConfig> {
  // The build tools are only needed to build or develop the admin.
  const { default: createVuePlugin } = await import('@vitejs/plugin-vue')
  const { testModuleIdentifier, getPostCssConfig } =
    await import('@ditojs/build')
  const { mode = 'production', basePath = process.cwd() } = options
  const isDevelopment = mode === 'development'
  const root = path.resolve(options.root)
  const base = `${normalizeBase(options.base)}/`
  const views = path.join(root, 'views')
  const linkedSources = isDevelopment ? getLinkedSources(root) : {}

  return assignDeeply(
    {
      root,
      base,
      mode,
      envDir: false,
      configFile: false,
      plugins: [
        createVuePlugin(),
        {
          // Loads the `dito` object from `dito.js` before the main module.
          name: 'inject-dito-object',
          transformIndexHtml: {
            order: 'post',
            handler(html: string) {
              return html.replace(
                /(\s*)(<script type="module"[^>]*?><\/script>)/,
                `$1<script src="${base}dito.js"></script>$1$2`
              )
            }
          }
        },
        {
          // Resolves linked Dito.js packages to their sources, see
          // `getLinkedSources()`.
          name: 'resolve-linked-sources',
          enforce: 'pre',
          resolveId: (id: string) => linkedSources[id],
          load: (id: string) => (id === emptyModule ? '' : null)
        }
      ],
      build: isDevelopment
        ? {}
        : {
            outDir: options.dist && path.resolve(options.dist),
            assetsDir: '.',
            emptyOutDir: true,
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
              output: {
                manualChunks: (id: string) => {
                  if (id.startsWith(views)) return 'views'
                  if (id.startsWith(basePath)) return 'common'
                  const module = id.match(
                    /node_modules\/((?:@[^/]*\/)?[^/$]*)/
                  )?.[1]
                  // Vite's own modules don't come from `node_modules`.
                  return (
                    !module ||
                    testModuleIdentifier(module, coreDependencies)
                  )
                    ? 'core'
                    : 'vendor'
                }
              }
            }
          },
      css: {
        postcss: getPostCssConfig(),
        devSourcemap: isDevelopment
      },
      optimizeDeps: {
        exclude: isDevelopment ? ditoPackages : [],
        // One copy of ProseMirror for the editor and its plugins, see:
        // https://discuss.prosemirror.net/t/rangeerror-adding-different-instances-of-a-keyed-plugin-plugin/4242/13
        include: isDevelopment
          ? [
              'prosemirror-state',
              'prosemirror-transform',
              'prosemirror-model',
              'prosemirror-view'
            ]
          : ditoPackages
      },
      resolve: {
        extensions: [
          '.js',
          '.mjs',
          '.jsx',
          '.ts',
          '.mts',
          '.tsx',
          '.json',
          '.vue'
        ],
        preserveSymlinks: false,
        alias: [{ find: '@', replacement: root }]
      }
    },
    config
  ) as InlineConfig
}

const emptyModule = '\0dito-empty-module'

const ditoPackages = ['@ditojs/admin', '@ditojs/ui', '@ditojs/utils']

// The packages of the `core` chunk, which changes less often than `vendor`.
const coreDependencies = [
  ...ditoPackages,
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
  'tslib',
  'orderedmap',
  'w3c-keyname'
]

// When the app links Dito.js from a checkout, this resolves its admin and UI
// to their sources, also for the app's own imports: their builds would be
// stale, and second copies next to the sources. The source components bring
// their styles.
function getLinkedSources(root: string): Record<string, string> {
  const admin = createRequire(path.join(root, 'index.js')).resolve(
    '@ditojs/admin/src'
  )
  // Installed packages resolve inside `node_modules`, also in pnpm's store.
  return admin.split(path.sep).includes('node_modules')
    ? {}
    : {
        '@ditojs/admin': admin,
        '@ditojs/ui': createRequire(admin).resolve('@ditojs/ui/src'),
        '@ditojs/admin/style.css': emptyModule,
        '@ditojs/ui/style.css': emptyModule
      }
}
