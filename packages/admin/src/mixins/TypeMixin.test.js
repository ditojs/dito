import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema } from '../test/mount.js'

describe('TypeMixin', () => {
  describe('focus() and blur()', () => {
    it('target the input of input components', async () => {
      const { getComponent, findField } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        data: { title: 'Emma' }
      })
      const component = getComponent('title')
      const input = findField('title').find('input').element
      await component.focus()
      await flushPromises()
      expect(document.activeElement).toBe(input)
      expect(component.focused).toBe(true)
      component.blur()
      await flushPromises()
      expect(document.activeElement).not.toBe(input)
      expect(component.focused).toBe(false)
    })
  })

  describe('computed values outside of data models', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('warns about components that compute values in panels with own data', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { wrapper, data } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text' },
            slug: {
              type: 'text',
              compute: ({ item }) => item.title?.toLowerCase()
            }
          },
          panels: {
            stats: {
              type: 'panel',
              label: 'Stats',
              data: () => ({ words: 2 }),
              components: {
                words: { type: 'number' },
                pages: {
                  type: 'number',
                  compute: ({ item }) => item.words * 10
                }
              }
            }
          }
        },
        data: { title: 'Mansfield Park' }
      })
      expect(wrapper.find('.dito-panel').exists()).toBe(true)
      // Components in the data model get their values computed:
      expect(data.slug).toBe('mansfield park')
      const messages = warn.mock.calls.map(([message]) => message)
      expect(messages).toEqual([
        `The value of the component at 'stats/pages' isn't computed, as its ` +
        `data isn't part of a data model.`
      ])
    })
  })
  describe('focus targets', () => {
    it('are native element refs themselves', async () => {
      const { getComponent, findField } = await mountSchema({
        schema: { components: { summary: { type: 'textarea' } } },
        data: { summary: 'A novel' }
      })
      const component = getComponent('summary')
      const textarea = findField('summary').element
      expect(textarea.tagName).toBe('TEXTAREA')
      expect(component.getFocusElement()).toBe(textarea)
      component.focusElement()
      expect(document.activeElement).toBe(textarea)
    })

    it('fall back to the root node without an element ref', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: { gap: { type: 'spacer' } }
        }
      })
      const component = getComponent('gap')
      const element = component.getFocusElement()
      expect(element).toBe(component.$el)
      // Root nodes that can't be focused, e.g. the spacer's, are skipped:
      expect(element.focus).toBe(undefined)
      expect(() => component.focusElement()).not.toThrow()
      expect(() => component.blurElement()).not.toThrow()
    })
  })

  describe('visible', () => {
    it('defaults to the visibility of the type', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text' },
            hiddenTitle: { type: 'text', visible: false },
            slug: { type: 'computed', compute: ({ item }) => item.title },
            shownSlug: {
              type: 'computed',
              visible: true,
              compute: ({ item }) => item.title
            }
          }
        },
        data: { title: 'Emma' }
      })
      expect(getComponent('title').visible).toBe(true)
      expect(getComponent('hiddenTitle').visible).toBe(false)
      expect(getComponent('slug').visible).toBe(false)
      expect(getComponent('shownSlug').visible).toBe(true)
    })
  })

  describe('displayed errors', () => {
    it('are cleared when the value changes', async () => {
      const { getComponent, getErrors, data, settle } = await mountSchema({
        schema: {
          components: { title: { type: 'text', required: true } }
        },
        data: { title: null }
      })
      const component = getComponent('title')
      component.validate()
      await settle()
      expect(getErrors('title')).toEqual(['The title field is required.'])
      data.title = 'Emma'
      await settle()
      expect(getErrors('title')).toEqual([])
    })

    it('are kept when added for the new value', async () => {
      const { getComponent, getErrors, data, settle } = await mountSchema({
        schema: {
          components: { title: { type: 'text', required: true } }
        },
        data: { title: 'Emma' }
      })
      const component = getComponent('title')
      // Validated right after the change, before the watcher sees it:
      data.title = null
      component.validate()
      await settle()
      expect(getErrors('title')).toEqual(['The title field is required.'])
    })
  })
})
