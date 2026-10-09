import NumberMixin from './NumberMixin.js'
import { mountSchema } from '../test/mount.js'

const { getTypeValidations } = NumberMixin

describe('NumberMixin', () => {
  describe('getTypeValidations()', () => {
    it('returns no validations without settings', () => {
      expect(getTypeValidations({ type: 'number' }, {})).toEqual({})
    })

    it('validates the range between `min` and `max`', () => {
      expect(
        getTypeValidations({ type: 'number', min: 1, max: 5 }, {})
      ).toEqual({ range: [1, 5] })
      expect(
        getTypeValidations({ type: 'number', range: [2, 8] }, {})
      ).toEqual({ range: [2, 8] })
      // `min` and `max` take precedence over `range`:
      expect(
        getTypeValidations({ type: 'number', min: 3, range: [2, 8] }, {})
      ).toEqual({ range: [3, 8] })
    })

    it('validates only `min` or `max` when one is missing', () => {
      expect(getTypeValidations({ type: 'number', min: 1 }, {})).toEqual({
        min: 1
      })
      expect(getTypeValidations({ type: 'number', max: 5 }, {})).toEqual({
        max: 5
      })
    })

    it('rounds the limits and steps of integers outwards', () => {
      expect(
        getTypeValidations(
          { type: 'integer', min: 1.5, max: 4.2, step: 1.5 },
          {}
        )
      ).toEqual({ range: [1, 5], integer: true })
    })

    it('derives the decimals from the step', () => {
      expect(getTypeValidations({ type: 'number', step: 0.25 }, {})).toEqual({
        decimals: 2
      })
      expect(getTypeValidations({ type: 'number', step: 5 }, {})).toEqual({
        integer: true
      })
    })

    it('prefers explicit decimals over the step', () => {
      expect(
        getTypeValidations({ type: 'number', step: 0.25, decimals: 1 }, {})
      ).toEqual({ decimals: 1 })
    })

    it('evaluates schema values with the context', () => {
      const context = { maxPages: 500 }
      expect(
        getTypeValidations(
          { type: 'number', min: 1, max: ({ maxPages }) => maxPages },
          context
        )
      ).toEqual({ range: [1, 500] })
    })
  })

  describe('computed properties', () => {
    const mountNumbers = (schema, data = {}) =>
      mountSchema({
        schema: {
          components: {
            rating: { type: 'number', ...schema },
            pages: { type: 'integer', ...schema },
            progress: { type: 'progress', ...schema }
          }
        },
        data: { rating: null, pages: null, progress: null, ...data }
      })

    it('converts input values to numbers, and empty input to null', async () => {
      const { getComponent, data } = await mountNumbers({})
      const rating = getComponent('rating')
      const pages = getComponent('pages')
      expect(rating.inputValue).toBe('')
      rating.inputValue = '4.5'
      pages.inputValue = '320'
      expect(data.rating).toBe(4.5)
      expect(data.pages).toBe(320)
      expect(rating.inputValue).toBe(4.5)
      rating.inputValue = ''
      expect(data.rating).toBe(null)
    })

    it('is not an integer unless the type component says so', async () => {
      const { getComponent } = await mountNumbers({})
      expect(getComponent('progress').isInteger).toBe(false)
      expect(getComponent('pages').isInteger).toBe(true)
    })

    it(`uses the step value 'any' only for numbers without a step`, async () => {
      const { getComponent } = await mountNumbers({})
      expect(getComponent('rating').stepValue).toBe('any')
      expect(getComponent('pages').stepValue).toBe(undefined)
      const { getComponent: getStepComponent } = await mountNumbers({
        step: 0.5
      })
      expect(getStepComponent('rating').stepValue).toBe(0.5)
      expect(getStepComponent('pages').stepValue).toBe(1)
    })

    it('reads `min` and `max` from the range, rounded for integers', async () => {
      const { getComponent } = await mountNumbers({ range: [0.5, 9.5] })
      const rating = getComponent('rating')
      const pages = getComponent('pages')
      expect([rating.min, rating.max]).toEqual([0.5, 9.5])
      expect(rating.range).toEqual([0.5, 9.5])
      expect([pages.min, pages.max]).toEqual([0, 10])
      expect(pages.range).toEqual([0, 10])
    })

    it('prefers `min` and `max` over the range', async () => {
      const { getComponent } = await mountNumbers({
        min: 2.5,
        max: 7.5,
        range: [0, 10]
      })
      expect(getComponent('pages').range).toEqual([2, 8])
    })

    it('has no range without both limits', async () => {
      const { getComponent } = await mountNumbers({ min: 1 })
      const rating = getComponent('rating')
      expect(rating.min).toBe(1)
      expect(rating.max).toBe(undefined)
      expect(rating.range).toBe(undefined)
    })

    it('sets `min` and `max` through the range', async () => {
      const { getComponent } = await mountNumbers({ range: [0, 10] })
      const rating = getComponent('rating')
      rating.range = [1, 5]
      expect([rating.min, rating.max]).toEqual([1, 5])
      expect(rating.range).toEqual([1, 5])
      // Values that aren't arrays are ignored:
      rating.range = null
      expect(rating.range).toEqual([1, 5])
    })

    it('reads the decimals from the schema', async () => {
      const { getComponent } = await mountNumbers({ decimals: 2 })
      expect(getComponent('rating').decimals).toBe(2)
    })
  })
})
