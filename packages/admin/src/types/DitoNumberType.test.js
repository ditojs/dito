import { mountSchema, mountForm, enterValue } from '../test/mount.js'

describe('DitoNumberType', () => {
  it('parses the input to numbers and empty input to `null`', async () => {
    const { findField, data } = await mountSchema({
      schema: { fields: { price: { type: 'number' } } },
      data: { price: 12.5 }
    })
    const input = findField('price').find('input')
    expect(input.element.value).toBe('12.5')
    await input.setValue('7.25')
    expect(data.price).toBe(7.25)
    await input.setValue('1e3')
    expect(data.price).toBe(1000)
    await input.setValue('')
    expect(data.price).toBe(null)
    expect(input.element.value).toBe('')
  })

  it('parses the input of the integer type to numbers', async () => {
    const { findField, data } = await mountSchema({
      schema: { fields: { pages: { type: 'integer' } } }
    })
    await findField('pages').find('input').setValue('320')
    expect(data.pages).toBe(320)
  })

  it('passes `minimum`, `maximum` and `step` to the input', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          rating: { type: 'number', minimum: 0, maximum: 5, step: 0.5 },
          price: { type: 'number' }
        }
      }
    })
    expect(findField('rating').find('input').attributes()).toMatchObject({
      min: '0',
      max: '5',
      step: '0.5'
    })
    // Without a step, any value can be entered:
    expect(findField('price').find('input').attributes('step')).toBe('any')
  })

  it('takes `minimum` and `maximum` from `range`', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: { year: { type: 'number', range: [1900, 2100] } }
      }
    })
    expect(findField('year').find('input').attributes()).toMatchObject({
      min: '1900',
      max: '2100'
    })
  })

  it('shows the affixes and clears the value of clearable fields', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
          price: { type: 'number', prefix: 'EUR', clearable: true }
        }
      },
      data: { price: 12.5 }
    })
    const price = findField('price')
    expect(price.find('.dito-affixes--prefix').text()).toBe('EUR')
    await price.find('.dito-affixes__clear').trigger('click')
    expect(data.price).toBe(null)
    expect(price.find('input').element.value).toBe('')
  })

  it('rounds `minimum`, `maximum` and `step` of integers to integers', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          copies: { type: 'integer', minimum: 0.5, maximum: 9.5, step: 1.5 }
        }
      }
    })
    expect(findField('copies').find('input').attributes()).toMatchObject({
      min: '0',
      max: '10',
      step: '2'
    })
  })

  describe('validation', () => {
    it('validates the value against `range` on blur', async () => {
      const { findField, getErrors } = await mountSchema({
        schema: {
          fields: { rating: { type: 'number', range: [1, 5] } }
        }
      })
      const input = findField('rating').find('input')
      await input.trigger('focus')
      await enterValue(input, '7')
      await input.trigger('blur')
      expect(getErrors('rating')).toHaveLength(1)
      await input.trigger('focus')
      await enterValue(input, '4')
      await input.trigger('blur')
      expect(getErrors('rating')).toEqual([])
    })

    it('validates the decimals against the decimals of `step`', async () => {
      const { findField, getErrors } = await mountSchema({
        schema: {
          fields: { price: { type: 'number', step: 0.05 } }
        }
      })
      const input = findField('price').find('input')
      await input.trigger('focus')
      await enterValue(input, '1.255')
      await input.trigger('blur')
      expect(getErrors('price')).toHaveLength(1)
      await input.trigger('focus')
      await enterValue(input, '1.25')
      await input.trigger('blur')
      expect(getErrors('price')).toEqual([])
    })

    it(`doesn't submit integers with decimals`, async () => {
      const { findField, submit, getErrors } = await mountForm({
        schema: { fields: { copies: { type: 'integer' } } },
        data: { copies: 1 },
        request: ({ data }) => ({ data })
      })
      await enterValue(findField('copies').find('input'), '2.5')
      expect(await submit()).toBe(null)
      expect(getErrors('copies')).toHaveLength(1)
    })
  })
})

describe('DitoSliderType', () => {
  it('syncs the range input and the number input', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: { volume: { type: 'slider', range: [0, 10] } }
      },
      data: { volume: 3 }
    })
    const [range, number] = findField('volume').findAll('input')
    expect(range.attributes('type')).toBe('range')
    expect(range.element.value).toBe('3')
    await number.setValue('8')
    expect(data.volume).toBe(8)
    expect(range.element.value).toBe('8')
  })

  it('hides the number input with `input: false`', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: { volume: { type: 'slider', input: false } }
      }
    })
    expect(findField('volume').findAll('input')).toHaveLength(1)
  })

  it('labels the number input and only names the range input', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: { volume: { type: 'slider', label: false } }
      }
    })
    const [range, number] = findField('volume').findAll('input')
    expect(range.attributes('name')).toBe('volume')
    expect(number.attributes('name')).toBeUndefined()
    expect(number.attributes('aria-label')).toBe('Volume Value')
  })
})

describe('DitoProgressType', () => {
  it('displays the value relative to the start of the `range`', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: {
        fields: {
          progress: { type: 'progress', range: [20, 70], step: 10 }
        }
      },
      data: { progress: 34 }
    })
    const progress = findField('progress')
    expect(progress.attributes('max')).toBe('50')
    // 34 - 20 = 14, rounded to the step:
    expect(progress.element.value).toBe(10)
    data.progress = null
    await settle()
    // An empty value shows an empty bar, not an indeterminate one:
    expect(progress.attributes('value')).toBe('0')
  })

  it('takes the start from `minimum` without `maximum`', async () => {
    const { findField } = await mountSchema({
      schema: { fields: { progress: { type: 'progress', minimum: 0.2 } } },
      data: { progress: 0.5 }
    })
    const progress = findField('progress')
    // 0.5 - 0.2 of the 0.8 from `minimum` to the default end of 1:
    expect(progress.element.value).toBeCloseTo(0.3)
    expect(progress.attributes('max')).toBe('0.8')
  })

  it('displays the value as is without `range` and `step`', async () => {
    const { findField } = await mountSchema({
      schema: { fields: { progress: { type: 'progress' } } },
      data: { progress: 0.37 }
    })
    const progress = findField('progress')
    expect(progress.element.value).toBe(0.37)
    expect(progress.attributes('max')).toBe('1')
  })
})
