import path from 'path'
import Koa from 'koa'
import mount from 'koa-mount'
import koaWebpack from 'koa-webpack'
import historyApiFallback from 'koa-connect-history-api-fallback'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import ExtractTextPlugin from 'extract-text-webpack-plugin'
import autoprefixer from 'autoprefixer'
import { ControllerError } from '@/errors'
import { Controller } from './Controller'

export class AdminController extends Controller {
  // @override
  compose() {
    if (!this.config) {
      throw new ControllerError(this, 'Missing config field.')
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
    if (this.app.config.env === 'development') {
      this.app.once('after:start', () => this.setupWebpack())
    } else {
      // TODO: Implement static serving of built resources from `config.path`,
      // for production hosting.
    }
    return mount(this.url, this.koa)
  }

  async setupWebpack() {
    // https://webpack.js.org/configuration/stats/#stats
    const stats = {
      all: false,
      errors: true,
      errorDetails: true
    }
    const middleware = await koaWebpack({
      config: this.getWebpackConfig('development'),
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

  getWebpackConfig(mode) {
    const { config } = this
    const resolvedPath = path.resolve(config.path)
    return {
      mode,
      entry: [
        '@ditojs/admin/dist/dito-admin.css',
        ...(config.include || []),
        resolvedPath
      ],
      output: {
        filename: '[name].[hash].js',
        path: resolvedPath,
        publicPath: `${this.url}/`
      },
      resolve: {
        extensions: ['.js', '.vue', '.json'],
        alias: {
          vue$: 'vue/dist/vue.esm.js',
          '@': resolvedPath
        },
        // Preserve names of `yarn link` modules, for `splitChunks` to work.
        symlinks: false
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
        new webpack.NamedModulesPlugin(),
        new webpack.NoEmitOnErrorsPlugin(),
        // https://github.com/ampedandwired/html-webpack-plugin
        new HtmlWebpackPlugin({
          template: config.template,
          inject: true
        })
      ]
    }
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
