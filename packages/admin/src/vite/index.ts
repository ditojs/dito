import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { InlineConfig } from 'vite'
import { assignDeeply } from '@ditojs/utils'
import { normalizeBase } from '../server/normalizeBase.ts'

// The admin's Vite config, to build it and to develop it with `createAdmin()`.

// Vite's config, merged into the admin's. `build.outDir` says where the build
// writes the admin.
export interface AdminViteConfig extends InlineConfig {
  // The admin's sources, with `index.html` and `views/`.
  root: string
  // The path the admin is served at, such as `/admin`.
  base: string
  mode?: 'production' | 'development'
}

export async function defineAdminViteConfig({
  root: rootPath,
  base: basePath,
  mode = 'production',
  ...config
}: AdminViteConfig): Promise<InlineConfig> {
  // The build tools are only needed to build or develop the admin.
  const { default: createVuePlugin } = await import('@vitejs/plugin-vue')
  const { default: autoprefixer } = await import('autoprefixer')
  const isDevelopment = mode === 'development'
  const root = path.resolve(rootPath)
  // The base with one slash on each side, such as `/admin/`, or `/`:
  const base = `${normalizeBase(basePath)}/`
  // The views as the ids of Vite name them: by their real path, with forward
  // slashes also on Windows.
  const viewsDirectory = path
    .join(fs.realpathSync(root), 'views', path.sep)
    .replaceAll(path.sep, '/')
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
          // Load the `dito` object from `dito.js` before the main module.
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
          // Resolve linked Dito.js packages to their sources:
          name: 'resolve-linked-sources',
          enforce: 'pre',
          resolveId: (id: string) => linkedSources[id],
          load: (id: string) => (id === emptyModule ? '' : null)
        },
        {
          // Without the chunk of the views, `authorize` of `createAdmin()`
          // would protect nothing.
          name: 'check-views-chunk',
          apply: 'build',
          generateBundle(_options: unknown, bundle: Record<string, unknown>) {
            if (!Object.keys(bundle).some(file => file.startsWith('views/'))) {
              throw new Error(
                'Unable to build the views into a chunk of their own'
              )
            }
          }
        }
      ],
      build: isDevelopment
        ? {}
        : {
            emptyOutDir: true,
            chunkSizeWarningLimit: 1000,
            rolldownOptions: {
              output: {
                // Give the views a chunk below `views/` for `authorize` of
                // `createAdmin()`, without their imports, so that the login
                // doesn't need it. This needs the strict execution order.
                chunkFileNames: ({ name }: { name: string }) =>
                  `${name === 'views' ? 'views' : 'assets'}/[name]-[hash].js`,
                strictExecutionOrder: true,
                codeSplitting: {
                  groups: [
                    {
                      name: 'views',
                      test: (id: string) => id.startsWith(viewsDirectory),
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

// When the app links Dito.js from a checkout, resolve its admin and UI to
// their sources, also for the app's own imports: their builds would be
// stale, and second copies next to the sources. The source components bring
// their styles.
function getLinkedSources(root: string): Record<string, string> {
  const adminSource = createRequire(path.join(root, 'index.js')).resolve(
    '@ditojs/admin/src'
  )
  // Installed packages resolve inside `node_modules`, also in pnpm's store.
  return adminSource.split(path.sep).includes('node_modules')
    ? {}
    : {
        '@ditojs/admin': adminSource,
        '@ditojs/ui': createRequire(adminSource).resolve('@ditojs/ui/src'),
        '@ditojs/admin/style.css': emptyModule,
        '@ditojs/ui/style.css': emptyModule
      }
}
