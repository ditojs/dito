import { vi } from 'vitest'
import DitoTypeComponent from './DitoTypeComponent.js'

describe('DitoTypeComponent.register()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('warns about `getValidations()` methods, which are unsupported', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    DitoTypeComponent.register('isbn', {
      methods: { getValidations: () => ({ isbn: true }) }
    })
    DitoTypeComponent.register('issn', {
      mixins: [{ methods: { getValidations: () => ({ issn: true }) } }]
    })
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0][0]).toMatch(/getTypeValidations/)
  })

  it("doesn't warn about types with static `getTypeValidations()`", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    DitoTypeComponent.register('ean', {
      getTypeValidations: () => ({ ean: true })
    })
    expect(warn).not.toHaveBeenCalled()
  })
})
