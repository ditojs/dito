import module from 'module'

export function getRollupExternalsFromDependencies({
  start = process.cwd(),
  include = [],
  exclude = []
}) {
  const externals = Object.fromEntries(
    [...module.builtinModules, ...include].map(name => [name, name])
  )
  const excludes = Object.fromEntries(exclude.map(name => [name, name]))
  const addDependencies = (dependencies = []) => {
    for (const dependency in dependencies) {
      if (!externals[dependency] && !excludes[dependency]) {
        externals[dependency] = dependency
        attemptAddingDependencies(dependency)
      }
    }
  }

  const attemptAddingDependencies = dependency => {
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

  // Start with root to read from './package.json' and take it from there.
  attemptAddingDependencies(start)
  return externals
}
