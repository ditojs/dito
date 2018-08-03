const path = require('path')
const { camelize } = require('@ditojs/utils')

const env = process.env.NODE_ENV || 'development'
const maxSize = 1024 * 1024

module.exports = {
  configureWebpack: {
    externals: env === 'production'
      ? getExternalsFromDependencies()
      : {},
    performance: {
      maxEntrypointSize: maxSize,
      maxAssetSize: maxSize
    },
    resolve: {
      alias: {
        '@ditojs': path.resolve('..'),
        // This is required for sym-linked dev folder to work during yarn serve:
        '@ditojs/admin': path.resolve('./src')
      }
    }
  },

  css: {
    loaderOptions: {
      sass: {
        includePaths: ['./src/styles'],
        data: `@import '_imports';`
      }
    }
  }
}

function getExternalsFromDependencies() {
  const externals = {}
  const addDependencies = dependencies => {
    for (const dependency in dependencies) {
      addDependency(dependency)
    }
  }
  const addDependency = dependency => {
    if (!externals[dependency]) {
      externals[dependency] = {
        root: camelize(dependency, true),
        amd: dependency,
        commonjs: dependency,
        commonjs2: dependency
      }
      try {
        // Attempt loading the dependency's own dependencies and recursively
        // mark these as externals as well:
        const packageJson = require(`${dependency}/package.json`)
        addDependencies(packageJson.dependencies)
        addDependencies(packageJson.peerDependencies)
        addDependencies(packageJson.devDependencies)
      } catch (err) {
      }
    }
  }
  // Start with '.' to read from './package.json' and take it from there.
  addDependency('.')
  return externals
}
