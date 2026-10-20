import { numberTraits, getNumberSettings } from './traits.ts'

const { getValidations } = numberTraits

describe('numberTraits.getValidations()', () => {
  it('returns no validations without settings', () => {
    expect(getValidations({ schema: { type: 'number' } })).toEqual({})
  })

  it('validates the range between `minimum` and `maximum`', () => {
    expect(
      getValidations({ schema: { type: 'number', minimum: 1, maximum: 5 } })
    ).toEqual({ range: [1, 5] })
    expect(
      getValidations({ schema: { type: 'number', range: [2, 8] } })
    ).toEqual({ range: [2, 8] })
    // `minimum` and `maximum` take precedence over `range`:
    expect(
      getValidations({ schema: { type: 'number', minimum: 3, range: [2, 8] } })
    ).toEqual({ range: [3, 8] })
  })

  it('validates only `minimum` or `maximum` when one is missing', () => {
    expect(getValidations({ schema: { type: 'number', minimum: 1 } })).toEqual({
      minimum: 1
    })
    expect(getValidations({ schema: { type: 'number', maximum: 5 } })).toEqual({
      maximum: 5
    })
  })

  it('rounds the limits and steps of integers outwards', () => {
    expect(
      getValidations({
        schema: { type: 'integer', minimum: 1.5, maximum: 4.2, step: 1.5 }
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
      schema: {
        type: 'number',
        minimum: 1,
        maximum: ({ maxPages }) => maxPages
      },
      maxPages: 500
    }
    expect(getValidations(context)).toEqual({ range: [1, 500] })
  })
})

describe('getNumberSettings()', () => {
  it('reads `minimum` and `maximum` from the range, rounded for integers', () => {
    expect(
      getNumberSettings({ type: 'number', range: [0.5, 9.5] }, {})
    ).toEqual(
      {
        minimum: 0.5,
        maximum: 9.5,
        step: undefined,
        decimals: undefined,
        range: [0.5, 9.5]
      }
    )
    expect(
      getNumberSettings({ type: 'integer', range: [0.5, 9.5], step: 1.5 }, {})
    ).toMatchObject({ minimum: 0, maximum: 10, step: 2, range: [0, 10] })
  })

  it('prefers `minimum` and `maximum` over the range', () => {
    expect(
      getNumberSettings(
        { type: 'integer', minimum: 2.5, maximum: 7.5, range: [0, 10] },
        {}
      ).range
    ).toEqual([2, 8])
  })

  it('has no range without both limits', () => {
    expect(getNumberSettings({ type: 'number', minimum: 1 }, {})).toMatchObject(
      {
        minimum: 1,
        maximum: undefined,
        range: undefined
      }
    )
  })

  it('reads the decimals from the schema', () => {
    expect(
      getNumberSettings({ type: 'number', decimals: 2 }, {}).decimals
    ).toBe(
      2
    )
  })
})
