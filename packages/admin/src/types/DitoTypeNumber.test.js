import { mountSchema, mountForm, enterValue } from '../test/mount.js'

describe('DitoTypeNumber', () => {
  it('parses the input to numbers and empty input to `null`', async () => {
    const { findField, data } = await mountSchema({
      schema: { components: { price: { type: 'number' } } },
      data: { price: 12.5 }
    })
    const input = findField('price').find('input')
    expect(input.element.value).toBe('12.5')
    await input.setValue('7.25')
    expect(data.price).toBe(7.25)
    await input.setValue('')
    expect(data.price).toBe(null)
    expect(input.element.value).toBe('')
  })

  it('parses the input of the integer type with `Number()`', async () => {
    const { findField, data } = await mountSchema({
      schema: { components: { pages: { type: 'integer' } } }
    })
    await findField('pages').find('input').setValue('320')
    expect(data.pages).toBe(320)
  })

  it('passes `min`, `max` and `step` to the input', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          rating: { type: 'number', min: 0, max: 5, step: 0.5 },
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

  it('takes `min` and `max` from `range`', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: { year: { type: 'number', range: [1900, 2100] } }
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
        components: {
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

  it('rounds `min`, `max` and `step` of integers to integers', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          copies: { type: 'integer', min: 0.5, max: 9.5, step: 1.5 }
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
      const { findField, getComponent, getErrors } = await mountSchema({
        schema: {
          components: { rating: { type: 'number', range: [1, 5] } }
        }
      })
      const input = findField('rating').find('input')
      await enterValue(input, '7')
      await input.trigger('blur')
      expect(getComponent('rating').isValid).toBe(false)
      expect(getErrors('rating')).toHaveLength(1)
      await enterValue(input, '4')
      await input.trigger('blur')
      expect(getComponent('rating').isValid).toBe(true)
    })

    it('validates the decimals against the decimals of `step`', async () => {
      const { findField, getComponent } = await mountSchema({
        schema: {
          components: { price: { type: 'number', step: 0.05 } }
        }
      })
      const input = findField('price').find('input')
      await enterValue(input, '1.255')
      await input.trigger('blur')
      expect(getComponent('price').isValid).toBe(false)
      await enterValue(input, '1.25')
      await input.trigger('blur')
      expect(getComponent('price').isValid).toBe(true)
    })

    it(`doesn't submit integers with decimals`, async () => {
      const { findField, submit, getErrors } = await mountForm({
        schema: { components: { copies: { type: 'integer' } } },
        data: { copies: 1 },
        request: ({ data }) => ({ data })
      })
      await enterValue(findField('copies').find('input'), '2.5')
      expect(await submit()).toBe(null)
      expect(getErrors('copies')).toHaveLength(1)
    })
  })
})

describe('DitoTypeSlider', () => {
  it('syncs the range input and the number input', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: { volume: { type: 'slider', range: [0, 10] } }
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
        components: { volume: { type: 'slider', input: false } }
      }
    })
    expect(findField('volume').findAll('input')).toHaveLength(1)
  })

  it('labels the number input and only names the range input', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: { volume: { type: 'slider', label: false } }
      }
    })
    const [range, number] = findField('volume').findAll('input')
    expect(range.attributes('name')).toBe('volume')
    expect(number.attributes('name')).toBeUndefined()
    expect(number.attributes('aria-label')).toBe('Volume Value')
  })
})

describe('DitoTypeProgress', () => {
  it('displays the value relative to the start of the `range`', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: {
        components: {
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
    expect(progress.attributes('value')).toBe('')
  })

  it('displays the value as is without `range` and `step`', async () => {
    const { findField } = await mountSchema({
      schema: { components: { progress: { type: 'progress' } } },
      data: { progress: 0.37 }
    })
    const progress = findField('progress')
    expect(progress.element.value).toBe(0.37)
    expect(progress.attributes('max')).toBeUndefined()
  })
})
