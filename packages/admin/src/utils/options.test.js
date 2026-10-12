import { resolveMergedOptions, mergeOptions } from './options.js'

describe('resolveMergedOptions()', () => {
  it('returns options without mixins and `extends` as they are', () => {
    const options = { name: 'BookList' }
    expect(resolveMergedOptions(options)).toBe(options)
  })

  it('takes over route guards, which vue-router reads without mixins', () => {
    const beforeRouteLeave = () => true
    const beforeRouteUpdate = () => true
    const merged = resolveMergedOptions({
      name: 'BookForm',
      extends: { beforeRouteUpdate },
      mixins: [{ mixins: [{ beforeRouteLeave }] }]
    })
    expect(merged).toMatchObject({
      name: 'BookForm',
      beforeRouteUpdate,
      beforeRouteLeave
    })
  })

  it('applies the guards of later mixins over earlier ones', () => {
    const beforeRouteLeave = () => true
    const merged = resolveMergedOptions({
      mixins: [{ beforeRouteLeave: () => false }, { beforeRouteLeave }]
    })
    expect(merged.beforeRouteLeave).toBe(beforeRouteLeave)
  })

  it(`keeps the component's own guards over the ones of its mixins`, () => {
    const beforeRouteLeave = () => true
    const merged = resolveMergedOptions({
      mixins: [{ beforeRouteLeave: () => false }],
      beforeRouteLeave
    })
    expect(merged.beforeRouteLeave).toBe(beforeRouteLeave)
  })
})

describe('mergeOptions()', () => {
  it('only takes over the route guards', () => {
    const beforeRouteUpdate = () => true
    const to = {}
    mergeOptions(to, { data: () => ({}), beforeRouteUpdate })
    expect(to).toEqual({ beforeRouteUpdate })
  })
})
