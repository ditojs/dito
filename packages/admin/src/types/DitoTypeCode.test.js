import { vi } from 'vitest'
import { mountSchema } from '../test/mount.js'

// Drags the resize `handle` with the pointer from `startY` to `endY`.
async function dragResizeHandle(handle, startY, endY) {
  const options = { pointerId: 1, button: 0 }
  await handle.trigger('pointerdown', { ...options, clientY: startY })
  await handle.trigger('pointermove', { ...options, clientY: endY })
  await handle.trigger('pointerup', { ...options, clientY: endY })
}

describe('DitoTypeCode', () => {
  it('displays the value in the editor with the number of `lines`', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: { snippet: { type: 'code', lines: 8 } }
      },
      data: { snippet: 'const a = 1' }
    })
    const field = findField('snippet')
    expect(field.find('textarea').element.value).toBe('const a = 1')
    expect(field.attributes('style')).toMatch(/--lines: 8/)
  })

  it('writes edits into the data, and emits change once blurred', async () => {
    const onInput = vi.fn()
    const onChange = vi.fn()
    const { findField, data } = await mountSchema({
      schema: { components: { snippet: { type: 'code', onInput, onChange } } },
      data: { snippet: 'const a = 1' }
    })
    const textarea = findField('snippet').find('textarea')
    await textarea.trigger('focus')
    await textarea.setValue('const a = 2')
    // The editor reports its updates asynchronously:
    await vi.waitFor(() => expect(data.snippet).toBe('const a = 2'))
    await vi.waitFor(() => expect(onInput).toHaveBeenCalled())
    expect(onChange).not.toHaveBeenCalled()
    await textarea.trigger('blur')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
  })

  it('updates the editor when the value changes', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: { components: { snippet: { type: 'code' } } },
      data: { snippet: 'a' }
    })
    data.snippet = null
    await settle()
    expect(findField('snippet').find('textarea').element.value).toBe('')
  })

  it('makes the editor readonly for disabled fields', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: {
        components: {
          isLocked: { type: 'checkbox' },
          snippet: { type: 'code', disabled: ({ item }) => item.isLocked }
        }
      },
      data: { isLocked: true, snippet: 'a' }
    })
    const textarea = () => findField('snippet').find('textarea')
    expect(textarea().attributes('readonly')).toBeDefined()
    data.isLocked = false
    await settle()
    expect(textarea().attributes('readonly')).toBeUndefined()
  })

  it('resizes the editor by dragging and with the arrow keys', async () => {
    const { findField, settle } = await mountSchema({
      schema: {
        components: { snippet: { type: 'code', resizable: true } }
      }
    })
    const field = findField('snippet')
    // happy-dom doesn't lay out, so the editor gets a height to start from:
    field.element.style.height = '100px'
    field.element.style.fontSize = '10px'
    const handle = field.find('.dito-resize')
    await dragResizeHandle(handle, 50, 80)
    await settle()
    expect(field.element.style.height).toBe('130px')
    await handle.trigger('keydown', { key: 'ArrowUp' })
    await settle()
    expect(field.element.style.height).toBe('120px')
  })
})
