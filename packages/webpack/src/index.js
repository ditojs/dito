const { camelize } = require('@ditojs/utils')

export function getExternalsFromDependencies(exclude = []) {
  const excludes = exclude.reduce((exclude, dependency) => {
    exclude[dependency] = true
    return exclude
  }, {})
  const externals = {}
  const addDependencies = dependencies => {
    for (const dependency in dependencies) {
      addDependency(dependency)
    }
  }
  const addDependency = dependency => {
    if (!externals[dependency] && !excludes[dependency]) {
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
  // Start with cwd to read from './package.json' and take it from there.
  addDependency(process.cwd())
  return externals
}
