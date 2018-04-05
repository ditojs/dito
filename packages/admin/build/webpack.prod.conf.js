'use strict'
const path = require('path')
const utils = require('./utils')
const webpack = require('webpack')
const config = require('../config')
const merge = require('webpack-merge')
const baseWebpackConfig = require('./webpack.base.conf')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const toPascalCase = require('to-pascal-case')

const env = require('../config/prod.env')

const webpackConfig = merge(baseWebpackConfig, {
  mode: 'production',
  entry: {
    [config.name]: './src/index.js'
  },
  module: {
    rules: utils.styleLoaders({
      sourceMap: config.build.productionSourceMap,
      extract: true,
      usePostCSS: true
    })
  },
  devtool: config.build.productionSourceMap ? config.build.devtool : false,
  output: {
    library: {
      root: toPascalCase(config.name),
      amd: config.name,
      commonjs: config.name
    },
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  externals: utils.buildExternalsFromDependencies(),
  plugins: [
    // http://vuejs.github.io/vue-loader/en/workflow/production.html
    new webpack.DefinePlugin({
      'process.env': env
    }),
    // extract css into its own file
    new ExtractTextPlugin({
      filename: '[name].css',
      // Setting the following option to `false` will not extract CSS from
      // codesplit chunks. Their CSS will instead be inserted dynamically with
      // style-loader when the codesplit chunk has been loaded by webpack. It's
      // currently set to `true` because we are seeing that sourcemaps are
      // included in the codesplit bundle as well when it's `false`, increasing
      // file size: https://github.com/vuejs-templates/webpack/issues/1110
      allChunks: true
    }),

    // copy custom static assets
    new CopyWebpackPlugin([
      {
        from: path.resolve(__dirname, '../static'),
        to: config.build.assetsSubDirectory,
        ignore: ['.*']
      }
    ])
  ]
})

if (config.build.productionGzip) {
  const CompressionWebpackPlugin = require('compression-webpack-plugin')

  webpackConfig.plugins.push(
    new CompressionWebpackPlugin({
      asset: '[path].gz[query]',
      algorithm: 'gzip',
      test: new RegExp(
        '\\.(' +
        config.build.productionGzipExtensions.join('|') +
        ')$'
      ),
      threshold: 10240,
      minRatio: 0.8
    })
  )
}

if (config.build.bundleAnalyzerReport) {
  const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
  webpackConfig.plugins.push(new BundleAnalyzerPlugin())
}

const webpackMinifiedConfig = merge(webpackConfig, {
  output: {
    filename: '[name].min.js',
    chunkFilename: '[id].min.js'
  },
  plugins: [
    new UglifyJsPlugin({
      uglifyOptions: {
        compress: {
          warnings: false
        }
      },
      sourceMap: config.build.productionSourceMap,
      parallel: true
    }),
    // extract css into its own file
    new ExtractTextPlugin({
      filename: '[name].min.css'
    }),
    // Compress extracted CSS. We are using this plugin so that possible
    // duplicated CSS from different components can be deduped.
    new OptimizeCSSPlugin({
      cssProcessorOptions: config.build.productionSourceMap
        ? { safe: true, map: { inline: false } }
        : { safe: true }
    })
  ]
})

module.exports = [webpackConfig, webpackMinifiedConfig]
