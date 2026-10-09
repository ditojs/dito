import {
  getPackageName,
  isRollupExternal,
  matchModuleIdentifier
} from './rollup.js'

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
