import { mountSchema } from '../test/mount.js'

describe('NumberMixin', () => {
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
