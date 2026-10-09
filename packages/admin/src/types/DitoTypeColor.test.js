import { vi } from 'vitest'
import { tinycolor } from 'vue-color'
import { mountSchema, mountForm, enterValue } from '../test/mount.js'

describe('DitoTypeColor', () => {
  beforeEach(() => {
    // The color picker's popup waits for its layout, which happy-dom lacks.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100)
  })

  it('displays the color as hex digits with a preview', async () => {
    const { findField } = await mountSchema({
      schema: { components: { background: { type: 'color' } } },
      data: { background: '#FF8000' }
    })
    const field = findField('background')
    expect(field.find('input').element.value).toBe('ff8000')
    expect(
      field.find('.dito-color__preview div').attributes('style')
    ).toMatch(/background: #ff8000/)
  })

  it('displays colors with alpha as eight hex digits', async () => {
    const { findField } = await mountSchema({
      schema: { components: { overlay: { type: 'color', alpha: true } } },
      data: { overlay: 'rgba(0, 0, 255, 0.5)' }
    })
    expect(findField('overlay').find('input').element.value).toBe('0000ff80')
  })

  it('writes entered colors once the input is blurred', async () => {
    const { findField, data } = await mountSchema({
      schema: { components: { background: { type: 'color' } } },
      data: { background: '#ff8000' }
    })
    const input = findField('background').find('input')
    await input.trigger('focus')
    await enterValue(input, '00ff00')
    // Typed colors aren't written while typing, as they may be incomplete:
    expect(data.background).toBe('#ff8000')
    await input.trigger('blur')
    await vi.waitFor(() => expect(data.background).toBe('#00ff00'))
  })

  it('ignores invalid colors', async () => {
    const { findField, data } = await mountSchema({
      schema: { components: { background: { type: 'color' } } },
      data: { background: '#ff8000' }
    })
    await enterValue(findField('background').find('input'), 'nope')
    expect(data.background).toBe('#ff8000')
  })

  it('converts colors to the color format of `format`', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          rgb: { type: 'color', format: 'rgb' },
          hex8: { type: 'color', format: 'hex8' },
          name: { type: 'color', format: 'name' }
        }
      }
    })
    await enterValue(findField('rgb').find('input'), 'ff0000')
    await enterValue(findField('hex8').find('input'), 'ff0000')
    await enterValue(findField('name').find('input'), 'ff0000')
    expect(data.rgb).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(data.hex8).toBe('#ff0000ff')
    expect(data.name).toBe('red')
  })

  it('emits change once entered colors are written on blur', async () => {
    const onChange = vi.fn()
    const { findField, data } = await mountForm({
      schema: {
        components: { background: { type: 'color', onChange } }
      },
      data: { background: '#ff8000' }
    })
    const input = findField('background').find('input')
    await input.trigger('focus')
    await enterValue(input, '00ff00')
    expect(onChange).not.toHaveBeenCalled()
    await input.trigger('blur')
    await vi.waitFor(() => expect(data.background).toBe('#00ff00'))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    expect(onChange.mock.calls[0][0].value).toBe('#00ff00')
  })

  it('emits change for colors picked once the picker closes', async () => {
    const onChange = vi.fn()
    const { getComponent, data, settle } = await mountForm({
      schema: {
        components: { background: { type: 'color', onChange } }
      },
      data: { background: '#ff8000' }
    })
    const color = getComponent('background')
    color.showPopup = true
    await settle()
    color.colorValue = tinycolor('#0000ff')
    color.colorValue = tinycolor('#00ff00')
    await settle()
    expect(data.background).toBe('#00ff00')
    expect(onChange).not.toHaveBeenCalled()
    color.showPopup = false
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
  })

  it('emits one change when cleared after picking a color', async () => {
    const onChange = vi.fn()
    const { getComponent, data, settle } = await mountForm({
      schema: {
        components: { background: { type: 'color', onChange } }
      },
      data: { background: '#ff8000' }
    })
    const color = getComponent('background')
    color.showPopup = true
    await settle()
    color.colorValue = tinycolor('#0000ff')
    color.clear()
    color.showPopup = false
    await settle()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(data.background).toBe(null)
    expect(onChange).toHaveBeenCalledOnce()
  })

  it(`doesn't write entered colors once cleared`, async () => {
    const { findField, getComponent, data, settle } = await mountSchema({
      schema: { components: { background: { type: 'color' } } },
      data: { background: '#ff8000' }
    })
    const input = findField('background').find('input')
    await input.trigger('focus')
    await enterValue(input, '00ff00')
    getComponent('background').clear()
    await input.trigger('blur')
    await settle()
    expect(data.background).toBe(null)
  })

  it(`doesn't emit change for colors changed by code`, async () => {
    const onChange = vi.fn()
    const { data, settle } = await mountForm({
      schema: {
        components: { background: { type: 'color', onChange } }
      },
      data: { background: '#ff8000' }
    })
    data.background = '#000000'
    await settle()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(onChange).not.toHaveBeenCalled()
  })
})
