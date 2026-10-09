import { resolveMergedOptions, mergeOptions } from './options.js'

describe('resolveMergedOptions()', () => {
  it('returns options without mixins and `extends` as they are', () => {
    const options = { defaultValue: () => [] }
    expect(resolveMergedOptions(options)).toBe(options)
  })

  it('merges the Dito.js options of mixins and `extends`', () => {
    const processValue = () => null
    const getPanelSchema = () => null
    const options = {
      name: 'BookList',
      extends: { defaultNested: false, omitSpacing: true },
      mixins: [
        { processValue, generateLabel: false },
        { mixins: [{ getPanelSchema }] }
      ],
      generateLabel: true
    }
    const merged = resolveMergedOptions(options)
    expect(merged).not.toBe(options)
    expect(merged).toMatchObject({
      name: 'BookList',
      defaultNested: false,
      omitSpacing: true,
      processValue,
      getPanelSchema,
      // The component's own options override the ones of its mixins:
      generateLabel: true
    })
  })

  it('applies the options of later mixins over earlier ones', () => {
    const merged = resolveMergedOptions({
      mixins: [{ defaultVisible: false }, { defaultVisible: true }]
    })
    expect(merged.defaultVisible).toBe(true)
  })

  it('takes over route guards, which vue-router reads without mixins', () => {
    const beforeRouteLeave = () => true
    const merged = resolveMergedOptions({ mixins: [{ beforeRouteLeave }] })
    expect(merged.beforeRouteLeave).toBe(beforeRouteLeave)
  })

  it('merges the multiple, width and source type defaults', () => {
    const getSourceType = type => (type === 'shelf' ? 'list' : null)
    const merged = resolveMergedOptions({
      extends: { defaultMultiple: true, defaultWidth: 'auto' },
      mixins: [{ getSourceType }]
    })
    expect(merged).toMatchObject({
      defaultMultiple: true,
      defaultWidth: 'auto',
      getSourceType
    })
  })
})

describe('mergeOptions()', () => {
  it('only takes over the Dito.js options', () => {
    const to = {}
    mergeOptions(to, { data: () => ({}), excludeValue: true })
    expect(to).toEqual({ excludeValue: true })
  })
})
