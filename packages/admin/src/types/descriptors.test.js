import { numberDescriptor } from './descriptors.ts'

const { getValidations } = numberDescriptor

describe('numberDescriptor.getValidations()', () => {
  it('returns no validations without settings', () => {
    expect(getValidations({ type: 'number' }, {})).toEqual({})
  })

  it('validates the range between `min` and `max`', () => {
    expect(
      getValidations({ type: 'number', min: 1, max: 5 }, {})
    ).toEqual({ range: [1, 5] })
    expect(
      getValidations({ type: 'number', range: [2, 8] }, {})
    ).toEqual({ range: [2, 8] })
    // `min` and `max` take precedence over `range`:
    expect(
      getValidations({ type: 'number', min: 3, range: [2, 8] }, {})
    ).toEqual({ range: [3, 8] })
  })

  it('validates only `min` or `max` when one is missing', () => {
    expect(getValidations({ type: 'number', min: 1 }, {})).toEqual({
      min: 1
    })
    expect(getValidations({ type: 'number', max: 5 }, {})).toEqual({
      max: 5
    })
  })

  it('rounds the limits and steps of integers outwards', () => {
    expect(
      getValidations(
        { type: 'integer', min: 1.5, max: 4.2, step: 1.5 },
        {}
      )
    ).toEqual({ range: [1, 5], integer: true })
  })

  it('derives the decimals from the step', () => {
    expect(getValidations({ type: 'number', step: 0.25 }, {})).toEqual({
      decimals: 2
    })
    expect(getValidations({ type: 'number', step: 5 }, {})).toEqual({
      integer: true
    })
  })

  it('prefers explicit decimals over the step', () => {
    expect(
      getValidations({ type: 'number', step: 0.25, decimals: 1 }, {})
    ).toEqual({ decimals: 1 })
  })

  it('evaluates schema values with the context', () => {
    const context = { maxPages: 500 }
    expect(
      getValidations(
        { type: 'number', min: 1, max: ({ maxPages }) => maxPages },
        context
      )
    ).toEqual({ range: [1, 500] })
  })
})
