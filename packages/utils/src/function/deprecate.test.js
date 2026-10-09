import { vi } from 'vitest'
import { deprecate } from './deprecate.js'

describe('deprecate()', () => {
  let warn

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('should log a deprecation message as a warning', () => {
    deprecate('`oldMethod()` is deprecated, use `newMethod()`.')
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      '`oldMethod()` is deprecated, use `newMethod()`.'
    )
  })

  it('should log each distinct message only once', () => {
    deprecate('First deprecation.')
    deprecate('First deprecation.')
    deprecate('Second deprecation.')
    deprecate('First deprecation.')
    expect(warn.mock.calls).toEqual([
      ['First deprecation.'],
      ['Second deprecation.']
    ])
  })

  it('should remember logged messages across calls', () => {
    // Already logged by the previous test, so it stays silent.
    deprecate('Second deprecation.')
    expect(warn).not.toHaveBeenCalled()
  })
})
