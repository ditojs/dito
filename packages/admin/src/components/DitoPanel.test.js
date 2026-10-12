import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, enterValue } from '../test/mount.js'

describe('DitoPanel', () => {
  it('edits its own data in its own form with object `data`', async () => {
    const { wrapper, data } = await mountSchema({
      schema: {
        components: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            label: 'Search',
            data: { query: 'Emma' },
            components: { query: { type: 'text' } }
          }
        }
      },
      data: { title: 'Dune' }
    })
    const panel = wrapper.find('.dito-panel')
    expect(panel.element.tagName).toBe('FORM')
    expect(panel.find('input').element.value).toBe('Emma')
    // The panel's data isn't part of the view's data:
    expect(data).toEqual({ title: 'Dune' })
  })

  it('passes its context to `data()`', async () => {
    const createData = vi.fn(() => ({ query: 'Emma' }))
    const { wrapper } = await mountSchema({
      schema: {
        components: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            label: 'Search',
            data: createData,
            components: { query: { type: 'text' } }
          }
        }
      },
      data: { title: 'Dune' }
    })
    const [context] = createData.mock.calls[0]
    // The panel's data path addresses a value in the item that it displays:
    expect(context.processedItem).toEqual({ title: 'Dune' })
    expect(wrapper.find('.dito-panel input').element.value).toBe('Emma')
  })

  it('passes the data that it displays to its buttons', async () => {
    const click = vi.fn()
    const { wrapper } = await mountSchema({
      schema: {
        components: { title: { type: 'text' } },
        panels: {
          summary: {
            type: 'panel',
            label: 'Summary',
            components: { notes: { type: 'textarea' } },
            buttons: {
              refresh: {
                type: 'button',
                text: 'Refresh',
                events: { click }
              }
            }
          }
        }
      },
      data: { title: 'Dune', notes: 'Classic' }
    })
    await wrapper.find('.dito-panel button[id$="refresh"]').trigger('click')
    expect(click).toHaveBeenCalledOnce()
    const [{ item }] = click.mock.calls[0]
    expect(item).toMatchObject({ notes: 'Classic' })
  })

  it('computes the values of its own data in its own data model', async () => {
    const { wrapper, dataModel, settle } = await mountSchema({
      schema: {
        components: { title: { type: 'text' } },
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
    const panel = wrapper.findComponent({ name: 'DitoPanel' })
    expect(panel.vm.panelData).toEqual({ words: 2, pages: 20 })
    // Edits of the panel's data don't make the view's data dirty:
    await enterValue(panel.find('input'), '3')
    await settle()
    expect(panel.vm.panelData).toEqual({ words: 3, pages: 30 })
    expect(panel.vm.dataModel.isDirty).toBe(true)
    expect(dataModel.isDirty).toBe(false)
  })

  it('validates and edits its own data through contexts', async () => {
    const click = vi.fn()
    const { wrapper, getComponent } = await mountSchema({
      schema: {
        components: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            label: 'Search',
            data: { query: '' },
            components: { query: { type: 'text', required: true } },
            buttons: {
              check: { type: 'button', text: 'Check', events: { click } }
            }
          }
        }
      },
      data: { title: 'Dune' }
    })
    const panel = wrapper.find('.dito-panel')
    await panel.find('button[id$="check"]').trigger('click')
    const [context] = click.mock.calls[0]
    expect(context.validate()).toBe(false)
    await flushPromises()
    expect(panel.find('.dito-errors').text()).toContain('required')
    await enterValue(panel.find('input'), 'Emma')
    expect(context.isDirty).toBe(true)
    expect(context.validate()).toBe(true)
    // The panel's data is its own, not the view's:
    expect(getComponent('title').context.isDirty).toBe(false)
  })
})
