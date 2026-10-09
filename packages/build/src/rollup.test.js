import { vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { builtinModules, createRequire } from 'module'
import {
  getPackageName,
  getRollupExternalsFromDependencies,
  isRollupExternal,
  matchModuleIdentifier,
  testModuleIdentifier
} from './rollup.js'

const require = createRequire(import.meta.url)

describe('getPackageName()', () => {
  it('returns the name of plain and scoped packages', () => {
    expect(getPackageName('vue')).toBe('vue')
    expect(getPackageName('tippy.js')).toBe('tippy.js')
    expect(getPackageName('@tiptap/pm')).toBe('@tiptap/pm')
  })

  it('strips subpaths', () => {
    expect(getPackageName('@tiptap/pm/model')).toBe('@tiptap/pm')
    expect(getPackageName('@vueuse/integrations/useSortable/component')).toBe(
      '@vueuse/integrations'
    )
    expect(getPackageName('lodash/get')).toBe('lodash')
  })

  it('returns null for paths and virtual modules', () => {
    expect(getPackageName('./DitoAdmin.js')).toBe(null)
    expect(getPackageName('../utils/index.js')).toBe(null)
    expect(getPackageName('/src/index.js')).toBe(null)
    expect(getPackageName('\0plugin-vue:export-helper')).toBe(null)
    expect(getPackageName('C:/src/index.js')).toBe(null)
  })
})

describe('isRollupExternal()', () => {
  const externals = {
    'vue': 'vue',
    '@tiptap/pm': '@tiptap/pm',
    '@vueuse/integrations': '@vueuse/integrations',
    '@ditojs/ui': '@ditojs/ui',
    '@ditojs/utils': '@ditojs/utils'
  }

  it('treats declared dependencies as external', () => {
    expect(isRollupExternal('vue', externals)).toBe(true)
    expect(isRollupExternal('@ditojs/utils', externals)).toBe(true)
  })

  it('treats subpaths of declared dependencies as external', () => {
    expect(isRollupExternal('@tiptap/pm/model', externals)).toBe(true)
    expect(
      isRollupExternal('@vueuse/integrations/useFocusTrap/component', externals)
    ).toBe(true)
  })

  it('bundles the style sheets of declared dependencies', () => {
    const styleExternals = {
      'tippy.js': 'tippy.js',
      'vue-multiselect': 'vue-multiselect',
      'vue-color': 'vue-color'
    }
    expect(isRollupExternal('tippy.js/dist/tippy.css', styleExternals)).toBe(
      false
    )
    expect(
      isRollupExternal(
        'vue-multiselect/dist/vue-multiselect.css',
        styleExternals
      )
    ).toBe(false)
    expect(isRollupExternal('vue-color/style.css?inline', styleExternals)).toBe(
      false
    )
    expect(isRollupExternal('vue-color/styles/main.scss', styleExternals)).toBe(
      false
    )
    expect(isRollupExternal('tippy.js/dist/tippy.esm.js', styleExternals)).toBe(
      true
    )
  })

  it('bundles the sources of Dito.js packages', () => {
    expect(isRollupExternal('@ditojs/ui/src', externals)).toBe(false)
    expect(isRollupExternal('@ditojs/ui/src/index.js', externals)).toBe(false)
  })

  it('bundles undeclared packages and local modules', () => {
    expect(isRollupExternal('prosemirror-model', externals)).toBe(false)
    expect(isRollupExternal('vue-router/auto', externals)).toBe(false)
    expect(isRollupExternal('./DitoAdmin.js', externals)).toBe(false)
  })
})

describe('matchModuleIdentifier()', () => {
  it('matches and captures wildcards', () => {
    expect(matchModuleIdentifier('@ditojs/ui/src', '@ditojs/*/src')).toEqual({
      match: true,
      capture: 'ui'
    })
    expect(matchModuleIdentifier('vue', '@ditojs/*/src').match).toBe(false)
  })
})

describe('matchModuleIdentifier() edge cases', () => {
  it('matches exact identifiers without wildcards', () => {
    expect(matchModuleIdentifier('vue', 'vue')).toEqual({
      match: true,
      capture: undefined
    })
    expect(matchModuleIdentifier('vue-router', 'vue').match).toBe(false)
    expect(matchModuleIdentifier('@vue/vue', 'vue').match).toBe(false)
  })

  it('returns no capture when the identifier does not match', () => {
    expect(matchModuleIdentifier('vue', '@vue/*')).toEqual({
      match: false,
      capture: undefined
    })
  })

  it('treats regular expression characters in patterns literally', () => {
    expect(matchModuleIdentifier('tippy.js', 'tippy.js').match).toBe(true)
    expect(matchModuleIdentifier('tippyxjs', 'tippy.js').match).toBe(false)
    expect(matchModuleIdentifier('a+b', 'a+b').match).toBe(true)
  })

  it('captures everything after a trailing wildcard, including slashes', () => {
    expect(matchModuleIdentifier('@vueuse/core/index', '@vueuse/*')).toEqual({
      match: true,
      capture: 'core/index'
    })
  })
})

describe('testModuleIdentifier()', () => {
  const coreDependencies = ['vue', '@vue/*', '@vueuse/*', 'tippy.js']

  it('returns true when any pattern matches', () => {
    expect(testModuleIdentifier('vue', coreDependencies)).toBe(true)
    expect(testModuleIdentifier('@vue/runtime-dom', coreDependencies)).toBe(
      true
    )
    expect(testModuleIdentifier('tippy.js', coreDependencies)).toBe(true)
  })

  it('returns false when no pattern matches', () => {
    expect(testModuleIdentifier('vue-router', coreDependencies)).toBe(false)
    expect(testModuleIdentifier('@tiptap/core', coreDependencies)).toBe(false)
  })

  it('accepts a single pattern', () => {
    expect(testModuleIdentifier('@vue/shared', '@vue/*')).toBe(true)
    expect(testModuleIdentifier('vue', '@vue/*')).toBe(false)
  })

  it('returns false without patterns', () => {
    expect(testModuleIdentifier('vue', [])).toBe(false)
    expect(testModuleIdentifier('vue', undefined)).toBe(false)
  })
})

describe('getRollupExternalsFromDependencies()', () => {
  let directory

  const writePackage = json => {
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: 'library-catalog', ...json })
    )
  }

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dito-build-'))
  })

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('includes all node builtin modules', () => {
    writePackage({})
    const externals = getRollupExternalsFromDependencies({ start: directory })
    for (const name of builtinModules) {
      expect(externals[name]).toBe(name)
    }
    expect(Object.keys(externals)).toHaveLength(builtinModules.length)
  })

  it('maps dependencies, peer and dev dependencies to themselves', () => {
    writePackage({
      dependencies: { minimist: '^1.0.0' },
      peerDependencies: { 'unknown-peer-package-for-tests': '^1.0.0' },
      devDependencies: { 'unknown-dev-package-for-tests': '^1.0.0' }
    })
    const externals = getRollupExternalsFromDependencies({ start: directory })
    expect(externals).toMatchObject({
      'minimist': 'minimist',
      'unknown-peer-package-for-tests': 'unknown-peer-package-for-tests',
      'unknown-dev-package-for-tests': 'unknown-dev-package-for-tests'
    })
  })

  it('recursively adds the dependencies of dependencies', () => {
    writePackage({ dependencies: { autoprefixer: '^10.0.0' } })
    const {
      dependencies,
      peerDependencies
    } = require('autoprefixer/package.json')
    const externals = getRollupExternalsFromDependencies({ start: directory })
    expect(externals.autoprefixer).toBe('autoprefixer')
    for (const name of [
      ...Object.keys(dependencies),
      ...Object.keys(peerDependencies)
    ]) {
      expect(externals[name]).toBe(name)
    }
  })

  it('adds explicitly included modules', () => {
    writePackage({})
    const externals = getRollupExternalsFromDependencies({
      start: directory,
      include: ['virtual:catalog', '@shelf/books']
    })
    expect(externals['virtual:catalog']).toBe('virtual:catalog')
    expect(externals['@shelf/books']).toBe('@shelf/books')
  })

  it('skips excluded dependencies and does not recurse into them', () => {
    writePackage({
      dependencies: { autoprefixer: '^10.0.0', minimist: '^1.0.0' }
    })
    const externals = getRollupExternalsFromDependencies({
      start: directory,
      exclude: ['autoprefixer']
    })
    expect(externals.minimist).toBe('minimist')
    expect(externals.autoprefixer).toBeUndefined()
    expect(externals['postcss-value-parser']).toBeUndefined()
  })

  it('returns only builtins when the start package cannot be loaded', () => {
    const externals = getRollupExternalsFromDependencies({
      start: path.join(directory, 'missing')
    })
    expect(Object.keys(externals)).toHaveLength(builtinModules.length)
  })

  it('reads the package.json of the current working directory by default', () => {
    writePackage({ dependencies: { 'shelf-reader-for-tests': '^1.0.0' } })
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory)
    try {
      const externals = getRollupExternalsFromDependencies()
      expect(externals['shelf-reader-for-tests']).toBe('shelf-reader-for-tests')
    } finally {
      cwd.mockRestore()
    }
  })
})
