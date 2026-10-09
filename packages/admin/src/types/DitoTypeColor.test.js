import { vi } from 'vitest'
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

  it('emits change events for changed colors', async () => {
    const onChange = vi.fn()
    const { data, settle } = await mountForm({
      schema: {
        components: { background: { type: 'color', onChange } }
      },
      data: { background: '#ff8000' }
    })
    expect(onChange).not.toHaveBeenCalled()
    data.background = '#000000'
    await settle()
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
  })
})
