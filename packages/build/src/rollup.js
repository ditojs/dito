import { builtinModules, createRequire } from 'module'
import { asArray, escapeRegexp } from '@ditojs/utils'

const require = createRequire(import.meta.url)

export function getRollupExternalsFromDependencies({
  start = process.cwd(),
  include = [],
  exclude = []
} = {}) {
  const externals = Object.fromEntries(
    [...builtinModules, ...include].map(name => [name, name])
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
    } catch {}
  }

  // Start with root to read from './package.json.js' and take it from there.
  attemptAddingDependencies(start)
  return externals
}

// Dito.js packages expose their sources through a `/src` export, so that other
// Dito.js packages can bundle them, e.g. `@ditojs/ui/src` in `@ditojs/admin`:
const bundledSourcesRegexp = /^@ditojs\/[^/]+\/src(\/|$)/

export function getPackageName(id) {
  // Relative and absolute paths and virtual modules aren't packages:
  if (/^[./\0]/.test(id) || /^[a-z]+:/i.test(id)) return null
  const parts = id.split('/')
  return id.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

// Style sheets, optionally followed by a query, e.g. `tippy.js/dist/tippy.css`
// or `vue-color/style.css?inline`:
const styleSheetRegexp = /\.(css|scss|sass|less|styl|stylus|pcss|postcss)(\?|$)/

export function isRollupExternal(id, externals) {
  if (externals[id]) return true
  if (bundledSourcesRegexp.test(id)) return false
  // Style sheets of external packages are bundled into the CSS output:
  if (styleSheetRegexp.test(id)) return false
  // Subpaths of external packages are external too, e.g. `@tiptap/pm/model`:
  const packageName = getPackageName(id)
  return !!packageName && packageName !== id && !!externals[packageName]
}

export function matchModuleIdentifier(id, pattern) {
  const regexp = new RegExp(`^${escapeRegexp(pattern).replace('\\*', '(.*)')}$`)
  const match = id.match(regexp)
  return {
    match: !!match,
    capture: match?.[1]
  }
}

export function testModuleIdentifier(id, patterns) {
  return asArray(patterns).some(
    pattern => matchModuleIdentifier(id, pattern).match
  )
}
