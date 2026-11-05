import path from 'node:path'
import { createRequire } from 'node:module'
import type { InlineConfig } from 'vite'
import { assignDeeply } from '@ditojs/utils'
import { normalizeBase } from './normalize-base.ts'

// The Vite config of the admin, for its build and for `createAdmin()` in
// development. The app's own config file can call it to build the admin, and
// pass the result to `createAdmin()` as `vite`.

export interface AdminViteOptions {
  // The admin's sources, with `index.html` and `views/`.
  root: string
  // The path the admin is served at, such as `/admin`.
  base: string
  mode?: 'production' | 'development'
  // Where the build writes the admin, needed for production builds.
  dist?: string
}

export async function defineAdminViteConfig(
  options: AdminViteOptions,
  config: InlineConfig = {}
): Promise<InlineConfig> {
  // The build tools are only needed to build or develop the admin.
  const { default: createVuePlugin } = await import('@vitejs/plugin-vue')
  const { default: autoprefixer } = await import('autoprefixer')
  const { mode = 'production' } = options
  const isDevelopment = mode === 'development'
  const root = path.resolve(options.root)
  // The base with one slash on each side, such as `/admin/`, or `/`:
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
            emptyOutDir: true,
            chunkSizeWarningLimit: 1000,
            rolldownOptions: {
              output: {
                // The views get their own chunk below `views/`, which
                // `authorize` of `createAdmin()` protects. The chunk leaves out
                // the modules that the views import, so the login, which loads
                // first, doesn't need it. That needs the strict execution
                // order.
                chunkFileNames: ({ name }: { name: string }) =>
                  `${name === 'views' ? 'views' : 'assets'}/[name]-[hash].js`,
                strictExecutionOrder: true,
                codeSplitting: {
                  groups: [
                    {
                      name: 'views',
                      test: (id: string) => id.startsWith(views),
                      includeDependenciesRecursively: false
                    }
                  ]
                }
              }
            }
          },
      css: {
        postcss: { plugins: [autoprefixer()] },
        devSourcemap: isDevelopment
      },
      optimizeDeps: {
        exclude: ['@ditojs/admin', '@ditojs/ui', '@ditojs/utils'],
        // One copy of ProseMirror for the editor and its plugins, see:
        // https://discuss.prosemirror.net/t/rangeerror-adding-different-instances-of-a-keyed-plugin-plugin/4242/13
        include: [
          'prosemirror-state',
          'prosemirror-transform',
          'prosemirror-model',
          'prosemirror-view'
        ]
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
        alias: [{ find: '@', replacement: root }]
      }
    },
    config
  ) as InlineConfig
}

const emptyModule = '\0dito-empty-module'

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
