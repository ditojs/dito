import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, enterValue } from '../test/mount.js'

describe('useField()', () => {
  describe('focusing', () => {
    it('focuses the input of input components', async () => {
      const focus = vi.fn()
      const blur = vi.fn()
      const { focusField, findField } = await mountSchema({
        schema: {
          components: { title: { type: 'text', events: { focus, blur } } }
        },
        data: { title: 'Emma' }
      })
      const input = findField('title').find('input').element
      await focusField('title')
      await flushPromises()
      expect(document.activeElement).toBe(input)
      expect(focus).toHaveBeenCalledOnce()
      expect(focus.mock.calls[0][0].value).toBe('Emma')
      input.blur()
      await flushPromises()
      expect(blur).toHaveBeenCalledOnce()
    })

    it('focuses native element refs themselves', async () => {
      const { focusField, findField } = await mountSchema({
        schema: { components: { summary: { type: 'textarea' } } },
        data: { summary: 'A novel' }
      })
      const textarea = findField('summary').element
      expect(textarea.tagName).toBe('TEXTAREA')
      await focusField('summary')
      expect(document.activeElement).toBe(textarea)
    })

    it(`skips root nodes that can't be focused without an element ref`, async () => {
      const { focusField } = await mountSchema({
        schema: { components: { gap: { type: 'spacer' } } }
      })
      await expect(focusField('gap')).resolves.toBe(undefined)
    })
  })

  describe('validation', () => {
    const mountRequiredTitle = title =>
      mountSchema({
        schema: {
          components: { title: { type: 'text', required: true } }
        },
        data: { title }
      })

    // Leaves the field like the user does, which validates its value:
    async function leave(input) {
      await input.trigger('focus')
      await input.trigger('blur')
    }

    it('shows the errors on blur until the value changes', async () => {
      const { findField, getErrors, dataModel, data, settle } =
        await mountRequiredTitle(null)
      await leave(findField('title').find('input'))
      await settle()
      expect(getErrors('title')).toEqual(['The title field is required.'])
      // E.g. a button that generates the value:
      dataModel.set(data, 'title', 'Emma')
      await settle()
      expect(getErrors('title')).toEqual([])
    })

    it('keeps the errors of the server and of the field on blur', async () => {
      const { findField, getErrors, dataModel, settle } =
        await mountRequiredTitle('Emma')
      dataModel.replaceErrors(
        { title: [{ message: 'is taken' }] },
        { server: true }
      )
      dataModel.addError('title', 'Unable to load the titles.')
      await leave(findField('title').find('input'))
      await settle()
      expect(getErrors('title')).toEqual([
        'The title field is taken.',
        'Unable to load the titles.'
      ])
    })

    it('shows the errors of the value right after it changed', async () => {
      const { findField, getErrors, settle } = await mountRequiredTitle('Emma')
      const input = findField('title').find('input')
      await enterValue(input, '')
      await input.trigger('blur')
      await settle()
      expect(getErrors('title')).toEqual(['The title field is required.'])
    })
  })

  describe('events', () => {
    it('emits the change of the parsed value', async () => {
      const change = vi.fn()
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            title: {
              type: 'text',
              formatValue: ({ value }) => value?.toUpperCase(),
              parseValue: ({ value }) => value.toLowerCase(),
              events: { change }
            }
          }
        },
        data: { title: 'emma' }
      })
      const input = findField('title').find('input')
      expect(input.element.value).toBe('EMMA')
      await enterValue(input, 'PERSUASION')
      expect(data.title).toBe('persuasion')
      expect(change).toHaveBeenCalledOnce()
      expect(change.mock.calls[0][0].value).toBe('persuasion')
    })
  })
})
