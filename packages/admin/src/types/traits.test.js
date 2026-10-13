import { numberTraits, getNumberSettings } from './traits.ts'

const { getValidations } = numberTraits

describe('numberTraits.getValidations()', () => {
  it('returns no validations without settings', () => {
    expect(getValidations({ schema: { type: 'number' } })).toEqual({})
  })

  it('validates the range between `min` and `max`', () => {
    expect(
      getValidations({ schema: { type: 'number', min: 1, max: 5 } })
    ).toEqual({ range: [1, 5] })
    expect(
      getValidations({ schema: { type: 'number', range: [2, 8] } })
    ).toEqual({ range: [2, 8] })
    // `min` and `max` take precedence over `range`:
    expect(
      getValidations({ schema: { type: 'number', min: 3, range: [2, 8] } })
    ).toEqual({ range: [3, 8] })
  })

  it('validates only `min` or `max` when one is missing', () => {
    expect(getValidations({ schema: { type: 'number', min: 1 } })).toEqual({
      min: 1
    })
    expect(getValidations({ schema: { type: 'number', max: 5 } })).toEqual({
      max: 5
    })
  })

  it('rounds the limits and steps of integers outwards', () => {
    expect(
      getValidations({
        schema: { type: 'integer', min: 1.5, max: 4.2, step: 1.5 }
      })
    ).toEqual({ range: [1, 5], integer: true })
  })

  it('derives the decimals from the step', () => {
    expect(getValidations({ schema: { type: 'number', step: 0.25 } })).toEqual({
      decimals: 2
    })
    expect(getValidations({ schema: { type: 'number', step: 5 } })).toEqual({
      integer: true
    })
  })

  it('prefers explicit decimals over the step', () => {
    expect(
      getValidations({ schema: { type: 'number', step: 0.25, decimals: 1 } })
    ).toEqual({ decimals: 1 })
  })

  it('evaluates schema values with the context', () => {
    const context = {
      schema: { type: 'number', min: 1, max: ({ maxPages }) => maxPages },
      maxPages: 500
    }
    expect(getValidations(context)).toEqual({ range: [1, 500] })
  })
})

describe('getNumberSettings()', () => {
  it('reads `min` and `max` from the range, rounded for integers', () => {
    expect(
      getNumberSettings({ type: 'number', range: [0.5, 9.5] }, {})
    ).toEqual(
      {
        min: 0.5,
        max: 9.5,
        step: undefined,
        decimals: undefined,
        range: [0.5, 9.5]
      }
    )
    expect(
      getNumberSettings({ type: 'integer', range: [0.5, 9.5], step: 1.5 }, {})
    ).toMatchObject({ min: 0, max: 10, step: 2, range: [0, 10] })
  })

  it('prefers `min` and `max` over the range', () => {
    expect(
      getNumberSettings(
        { type: 'integer', min: 2.5, max: 7.5, range: [0, 10] },
        {}
      ).range
    ).toEqual([2, 8])
  })

  it('has no range without both limits', () => {
    expect(getNumberSettings({ type: 'number', min: 1 }, {})).toMatchObject({
      min: 1,
      max: undefined,
      range: undefined
    })
  })

  it('reads the decimals from the schema', () => {
    expect(
      getNumberSettings({ type: 'number', decimals: 2 }, {}).decimals
    ).toBe(
      2
    )
  })
})
