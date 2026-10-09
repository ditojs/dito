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
})
