import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { tinycolor } from 'vue-color'
import {
  mountSchema,
  mountForm,
  enterValue,
  stubConfirm
} from '../test/mount.js'

describe('useField()', () => {
  describe('focusing', () => {
    it('focuses the input of input components', async () => {
      const focus = vi.fn()
      const blur = vi.fn()
      const { focusField, findField } = await mountSchema({
        schema: {
          components: { title: { type: 'text', onFocus: focus, onBlur: blur } }
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
              onChange: change
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

  // `input` fires for each edit that changes the value, `change` once the edit
  // is done. Both bubble to the form with the data paths of the edited values:
  describe('input', () => {
    const mountWithEvents = async (components, options = {}) => {
      const events = []
      const result = await mountForm({
        schema: {
          components,
          onInput: ({ dataPath, value }) => {
            events.push(['input', dataPath, value])
          },
          onChange: ({ dataPath }) => {
            events.push(['change', dataPath])
          }
        },
        ...options
      })
      return { events, ...result }
    }

    const typeText = async (input, ...texts) => {
      for (const text of texts) {
        input.element.value = text
        await input.trigger('input')
      }
      await flushPromises()
    }

    it('bubbles the input of each keystroke, and the change once done', async () => {
      const { findField, events, settle } = await mountWithEvents(
        {
          title: { type: 'text' },
          author: {
            type: 'object',
            inlined: true,
            form: { type: 'form', components: { name: { type: 'text' } } }
          }
        },
        { data: { title: null, author: { name: null } } }
      )
      const input = findField('author/name').find('input')
      await input.trigger('focus')
      await typeText(input, 'J', 'Ja')
      await input.trigger('change')
      await settle()
      expect(events).toEqual([
        ['input', 'author/name', 'J'],
        ['input', 'author/name', 'Ja'],
        ['change', 'author/name']
      ])
    })

    it('stops bubbling inputs when a handler returns `false`', async () => {
      const { findField, events } = await mountWithEvents({
        title: { type: 'text', onInput: () => false },
        author: { type: 'text' }
      })
      await typeText(findField('title').find('input'), 'Emma')
      await typeText(findField('author').find('input'), 'Austen')
      expect(events).toEqual([['input', 'author', 'Austen']])
    })

    it('emits input together with change for picked choices', async () => {
      const { findField, events, settle } = await mountWithEvents({
        genre: { type: 'select', options: ['novel', 'poetry'] },
        isAvailable: { type: 'checkbox' },
        isEbook: { type: 'switch' },
        format: { type: 'radio', options: ['paperback', 'hardcover'] }
      })
      await findField('genre').find('select').setValue('poetry')
      await findField('isAvailable').find('input').setValue(true)
      await findField('isEbook').find('input').setValue(true)
      await findField('format').findAll('input')[1].setValue(true)
      await settle()
      expect(events).toEqual([
        ['input', 'genre', 'poetry'],
        ['change', 'genre'],
        ['input', 'isAvailable', true],
        ['change', 'isAvailable'],
        ['input', 'isEbook', true],
        ['change', 'isEbook'],
        ['input', 'format', 'hardcover'],
        ['change', 'format']
      ])
    })

    it(`emits input for picked options of multiselects, not for searches`, async () => {
      const { findField, events, settle } = await mountWithEvents({
        genre: {
          type: 'multiselect',
          searchable: true,
          options: ['novel', 'poetry']
        }
      })
      const field = findField('genre')
      await field.find('.multiselect').trigger('focus')
      await flushPromises()
      await field.find('.multiselect__input').setValue('poe')
      await flushPromises()
      expect(events).toEqual([])
      await field.find('.multiselect__element .multiselect__option').trigger(
        'click'
      )
      await settle()
      expect(events).toEqual([
        ['input', 'genre', 'poetry'],
        ['change', 'genre']
      ])
    })

    it('emits input together with change for added and removed items', async () => {
      const { findField, events, settle } = await mountWithEvents(
        {
          chapters: {
            type: 'list',
            inlined: true,
            creatable: true,
            deletable: true,
            form: { type: 'form', components: { title: { type: 'text' } } }
          }
        },
        { data: { chapters: [{ title: 'One' }] } }
      )
      const field = findField('chapters')
      await field.find('.dito-create-button button').trigger('click')
      await settle()
      stubConfirm(true)
      await field.find('.dito-button--remove').trigger('click')
      await settle()
      expect(events.map(([event, dataPath]) => [event, dataPath])).toEqual([
        ['input', 'chapters'],
        ['change', 'chapters'],
        ['input', 'chapters'],
        ['change', 'chapters']
      ])
    })

    describe('color', () => {
      beforeEach(() => {
        // The color picker's popup waits for its layout, which happy-dom lacks.
        vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(
          100
        )
      })

      it('emits input for picked colors, and change once closed', async () => {
        const { getComponent, events, settle } = await mountWithEvents(
          { background: { type: 'color' } },
          { data: { background: '#ff8000' } }
        )
        const color = getComponent('background')
        color.showPopup = true
        await settle()
        color.colorValue = tinycolor('#0000ff')
        color.colorValue = tinycolor('#00ff00')
        color.showPopup = false
        await vi.waitFor(() => expect(events).toHaveLength(3))
        expect(events).toEqual([
          ['input', 'background', '#0000ff'],
          ['input', 'background', '#00ff00'],
          ['change', 'background']
        ])
      })

      it('emits input and change for entered colors once written', async () => {
        const { findField, events } = await mountWithEvents(
          { background: { type: 'color' } },
          { data: { background: '#ff8000' } }
        )
        const input = findField('background').find('input')
        await input.trigger('focus')
        await typeText(input, '00f', '00ff00')
        expect(events).toEqual([])
        await input.trigger('blur')
        await vi.waitFor(() => expect(events).toHaveLength(2))
        expect(events).toEqual([
          ['input', 'background', '#00ff00'],
          ['change', 'background']
        ])
      })
    })

    it.each([
      ['date', 'May 14, 2026', 'May 15, 2026'],
      ['datetime', 'May 14, 2026, 9:30 AM', 'May 14, 2026, 10:30 AM'],
      ['time', '9:30 AM', '10:30 AM']
    ])(
      'emits input for each entered %s, and change on Enter',
      async (type, ...texts) => {
        const { findField, events, settle } = await mountWithEvents({
          publishedAt: { type }
        })
        const input = findField('publishedAt').find('input')
        await input.trigger('focus')
        await typeText(input, ...texts)
        expect(events.map(([event]) => event)).toEqual(['input', 'input'])
        await input.trigger('keydown', { key: 'Enter', keyCode: 13 })
        await settle()
        expect(events.map(([event]) => event)).toEqual([
          'input',
          'input',
          'change'
        ])
      }
    )
  })
})
