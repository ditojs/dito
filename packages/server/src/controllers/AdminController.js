import path from 'path'
import Koa from 'koa'
import mount from 'koa-mount'
import webpack from 'koa-webpack'
import historyApiFallback from 'koa-connect-history-api-fallback'
import { NamedModulesPlugin, NoEmitOnErrorsPlugin } from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import ExtractTextPlugin from 'extract-text-webpack-plugin'
import autoprefixer from 'autoprefixer'
import { Controller } from './Controller'

export class AdminController extends Controller {
  // @override
  compose() {
    const config = this.app.config.admin
    if (!config?.dev) {
      // TODO: Implement static serving of built resources from `config.path`,
      // for production hosting.
      return null
    }
    const resolvedPath = path.resolve(config.path)
    const koa = new Koa()
    koa.use(historyApiFallback())
    koa.use(webpack({
      config: {
        mode: 'development',
        entry: [
          '@ditojs/admin/dist/dito-admin.css',
          ...(config.include || []),
          resolvedPath
        ],
        output: {
          path: resolvedPath,
          publicPath: `${this.url}/`
        },
        resolve: {
          extensions: ['.js', '.vue', '.json'],
          alias: {
            'vue$': 'vue/dist/vue.esm.js',
            '@': resolvedPath
          }
        },
        module: {
          rules: [
            {
              test: /\.vue$/,
              loader: 'vue-loader',
              options: vueLoaderConfig
            },
            {
              test: /\.js$/,
              loader: 'babel-loader',
              include: resolvedPath
            },
            ...styleLoaders({
              sourceMap: true,
              usePostCSS: true
            })
          ]
        },
        plugins: [
          // HMR shows correct file names in console on update:
          new NamedModulesPlugin(),
          new NoEmitOnErrorsPlugin(),
          // https://github.com/ampedandwired/html-webpack-plugin
          new HtmlWebpackPlugin({
            template: config.template,
            inject: true
          })
        ]
      },
      dev: {
        publicPath: '/',
        // https://webpack.js.org/configuration/stats/#stats
        stats: 'minimal'
      },
      hot: {
        // Real hot-reloading doesn't quite seem to work yet, but it wasn't too
        // far away from functioning, see:
        // https://github.com/ditojs/dito-admin/tree/hot-reload
        hot: false,
        reload: true,
        stats: 'minimal'
      }
    }))
    return mount(this.url, koa)
  }
}

const vueLoaderConfig = {
  loaders: cssLoaders({
    sourceMap: true,
    extract: false
  }),
  cssSourceMap: true,
  cacheBusting: true,
  transformToRequire: {
    video: ['src', 'poster'],
    source: 'src',
    img: 'src',
    image: 'xlink:href'
  }
}

function cssLoaders(options = {}) {
  const cssLoader = {
    loader: 'css-loader',
    options: {
      sourceMap: options.sourceMap
    }
  }

  // https://github.com/michael-ciniawsky/postcss-load-config
  const postcssLoader = {
    loader: 'postcss-loader',
    options: {
      sourceMap: options.sourceMap,
      plugins: [
        autoprefixer({
          browsers: [
            '> 1%',
            'last 2 versions',
            'not ie <= 8'
          ]
        })
      ]
    }
  }

  // generate loader string to be used with extract text plugin
  function generateLoaders(loader, loaderOptions) {
    const loaders = options.usePostCSS
      ? [cssLoader, postcssLoader]
      : [cssLoader]

    if (loader) {
      loaders.push({
        loader: loader + '-loader',
        options: {
          ...loaderOptions,
          sourceMap: options.sourceMap
        }
      })
    }

    // Extract CSS when that option is specified
    // (which is the case during production build)
    if (options.extract) {
      return ExtractTextPlugin.extract({
        use: loaders,
        fallback: 'vue-style-loader'
      })
    } else {
      return ['vue-style-loader', ...loaders]
    }
  }

  // https://vue-loader.vuejs.org/en/configurations/extract-css.html
  return {
    css: generateLoaders(),
    postcss: generateLoaders(),
    less: generateLoaders('less'),
    sass: generateLoaders('sass', {
      indentedSyntax: true
    }),
    scss: generateLoaders('sass'),
    stylus: generateLoaders('stylus'),
    styl: generateLoaders('stylus')
  }
}

// Generate loaders for standalone style files (outside of .vue)
function styleLoaders(options) {
  const output = []
  const loaders = cssLoaders(options)

  for (const extension in loaders) {
    const loader = loaders[extension]
    output.push({
      test: new RegExp('\\.' + extension + '$'),
      use: loader
    })
  }

  return output
}
