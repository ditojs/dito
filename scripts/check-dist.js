// Checks the built `dist` files of `@ditojs/ui` and `@ditojs/admin`, which no
// other test covers: All bare imports need to be declared dependencies, no
// dependency may be bundled (e.g. a second copy of Vue or ProseMirror), and
// the ES modules need to load and provide the expected exports.
// Run `pnpm run dist:check`, which builds both packages first.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Window } from 'happy-dom'
import { getPackageName } from '../packages/build/src/rollup.js'

const packages = [
  {
    directory: 'packages/ui',
    name: 'dito-ui',
    expectedExports: ['DitoButton', 'DitoInput', 'TransitionHeight']
  },
  {
    directory: 'packages/admin',
    name: 'dito-admin',
    expectedExports: ['default', 'DitoAdmin']
  }
]

const errors = []

function getImportedSpecifiers(code) {
  const specifiers = new Set()
  const patterns = [
    // `import … from "x"`, `export … from "x"` and `import "x"`:
    /(?:^|[\s;}])(?:import|export)\s*(?:[^"'`;]*?\sfrom\s*)?["']([^"']+)["']/g,
    // `require("x")` in UMD bundles and dynamic `import("x")`:
    /\b(?:require|import)\(\s*["']([^"']+)["']\s*\)/g
  ]
  for (const pattern of patterns) {
    for (const [, specifier] of code.matchAll(pattern)) {
      specifiers.add(specifier)
    }
  }
  return [...specifiers]
}

function checkBundle(packageJson, file) {
  const code = fs.readFileSync(file, 'utf8')
  const declaredNames = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {})
  ])
  for (const specifier of getImportedSpecifiers(code)) {
    const packageName = getPackageName(specifier)
    if (packageName && !declaredNames.has(packageName)) {
      errors.push(`${file}: imports undeclared dependency "${specifier}"`)
    }
  }
  // Bundled modules are marked by `#region` comments with their paths:
  const bundledModulePattern =
    /#region\s+\S*node_modules\/((?:@[^/]+\/)?[^/\s]+)/g
  const bundledModules = new Set(
    [...code.matchAll(bundledModulePattern)].map(([, name]) => name)
  )
  for (const name of bundledModules) {
    errors.push(`${file}: bundles "${name}" instead of importing it`)
  }
}

function registerBrowserGlobals() {
  const window = new Window({ url: 'http://localhost/' })
  for (const key of Object.getOwnPropertyNames(window)) {
    if (!(key in globalThis)) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        get: () => window[key]
      })
    }
  }
  for (const key of ['window', 'self', 'document', 'navigator']) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: key === 'window' || key === 'self' ? window : window[key]
    })
  }
}

registerBrowserGlobals()

for (const { directory, name, expectedExports } of packages) {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(directory, 'package.json'), 'utf8')
  )
  const esFile = path.join(directory, 'dist', `${name}.es.js`)
  const umdFile = path.join(directory, 'dist', `${name}.umd.js`)
  const cssFile = path.join(directory, 'dist', `${name}.css`)
  const missingFiles = [esFile, umdFile, cssFile].filter(
    file => !fs.existsSync(file)
  )
  if (missingFiles.length > 0) {
    errors.push(`${directory}: missing ${missingFiles.join(', ')}, build first`)
    continue
  }
  checkBundle(packageJson, esFile)
  checkBundle(packageJson, umdFile)
  try {
    const exports = await import(pathToFileURL(path.resolve(esFile)).href)
    for (const key of expectedExports) {
      if (!exports[key]) {
        errors.push(`${esFile}: missing export "${key}"`)
      }
    }
    if ('DitoAdmin' in exports && exports.DitoAdmin !== exports.default) {
      errors.push(`${esFile}: named and default \`DitoAdmin\` differ`)
    }
  } catch (error) {
    errors.push(`${esFile}: fails to load: ${error.stack}`)
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error)
  }
  process.exit(1)
} else {
  console.info(`Checked dist files of ${packages.length} packages.`)
  // Loaded dependencies may keep timers running, e.g. in the DOM shim:
  process.exit(0)
}
