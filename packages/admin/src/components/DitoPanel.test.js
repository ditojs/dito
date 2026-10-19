import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm, enterValue } from '../test/mount.js'
import DitoPanel from './DitoPanel.vue'
import DitoSchema from './DitoSchema.vue'

describe('DitoPanel', () => {
  it('edits its own data in its own form with object `data`', async () => {
    const { wrapper, data } = await mountSchema({
      schema: {
        fields: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            label: 'Search',
            data: { query: 'Emma' },
            fields: { query: { type: 'text' } }
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
        fields: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            label: 'Search',
            data: createData,
            fields: { query: { type: 'text' } }
          }
        }
      },
      data: { title: 'Dune' }
    })
    const [context] = createData.mock.calls[0]
    // The context is the one of the data around the panel:
    expect(context.serializedItem).toEqual({ title: 'Dune' })
    expect(wrapper.find('.dito-panel input').element.value).toBe('Emma')
  })

  it('decides about itself in the context of the data around it', async () => {
    const createData = vi.fn(() => ({ query: 'Emma' }))
    const isRendered = vi.fn(({ item }) => item.title === 'Dune')
    const isVisible = vi.fn(({ item }) => item.title === 'Dune')
    const isQueryRendered = vi.fn(({ item }) => item.query === 'Emma')
    const { wrapper } = await mountSchema({
      schema: {
        fields: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            label: 'Search',
            data: createData,
            if: isRendered,
            visible: isVisible,
            fields: {
              query: { type: 'text', if: isQueryRendered }
            }
          }
        }
      },
      data: { title: 'Dune' }
    })
    const panel = wrapper.find('.dito-panel')
    expect(panel.isVisible()).toBe(true)
    expect(panel.find('input').element.value).toBe('Emma')
    for (const callback of [createData, isRendered, isVisible]) {
      const [context] = callback.mock.lastCall
      expect(context.schema.label).toBe('Search')
      expect(context.serializedItem).toEqual({ title: 'Dune' })
    }
    // The components inside the panel see the panel's data:
    expect(isQueryRendered.mock.lastCall[0].item).toEqual({ query: 'Emma' })
  })

  it('hides when its components are hidden in its own data', async () => {
    const createPanel = (label, query) => ({
      type: 'panel',
      label,
      data: { query },
      fields: {
        query: { type: 'text', if: ({ item }) => !!item.query }
      }
    })
    const { wrapper } = await mountSchema({
      schema: {
        fields: { filter: createPanel('Filter', '') },
        panels: {
          search: createPanel('Search', ''),
          titles: createPanel('Titles', 'Emma')
        }
      }
    })
    const panels = wrapper.findAll('.dito-panel')
    expect(panels.map(panel => panel.attributes('aria-label'))).toEqual([
      'Titles'
    ])
    expect(panels[0].find('input').element.value).toBe('Emma')
  })

  it('passes the data that it displays to its buttons', async () => {
    const click = vi.fn()
    const { wrapper } = await mountSchema({
      schema: {
        fields: { title: { type: 'text' } },
        panels: {
          summary: {
            type: 'panel',
            label: 'Summary',
            fields: { notes: { type: 'textarea' } },
            buttons: {
              refresh: {
                type: 'button',
                text: 'Refresh',
                onClick: click
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

  it('disables all components and buttons inside it', async () => {
    const { wrapper } = await mountSchema({
      schema: {
        fields: { title: { type: 'text' } },
        panels: {
          summary: {
            type: 'panel',
            label: 'Summary',
            disabled: true,
            fields: {
              notes: { type: 'textarea' },
              isRead: { type: 'checkbox' },
              details: {
                type: 'section',
                fields: { pages: { type: 'number' } }
              }
            },
            buttons: {
              refresh: { type: 'button', text: 'Refresh' }
            }
          }
        }
      },
      data: { title: 'Dune' }
    })
    expect(
      wrapper
        .findAll('.dito-panel :is(input, textarea, button)')
        .map(({ element }) => [element.name || element.id, element.disabled])
    ).toEqual([
      ['notes', true],
      ['isRead', true],
      ['pages', true],
      [expect.stringMatching(/refresh$/), true]
    ])
    expect(wrapper.find('input[name="title"]').element.disabled).toBe(false)
  })

  it('gives its own data as item, within the root data around it', async () => {
    const click = vi.fn()
    const { wrapper } = await mountSchema({
      schema: {
        fields: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            label: 'Search',
            data: { query: 'Emma' },
            fields: {
              query: { type: 'text' },
              refresh: { type: 'button', onClick: click }
            }
          }
        }
      },
      data: { title: 'Dune' }
    })
    await wrapper.find('.dito-panel button[id$="refresh"]').trigger('click')
    const [{ item, rootItem, dataPath }] = click.mock.calls[0]
    expect(item).toEqual({ query: 'Emma' })
    expect(rootItem).toEqual({ title: 'Dune' })
    expect(dataPath).toBe('search/refresh')
  })

  it(`serializes its own data without the view's ids or types`, async () => {
    const click = vi.fn()
    const { wrapper } = await mountSchema({
      schema: {
        fields: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            label: 'Search',
            data: { id: 7, query: 'Emma' },
            fields: {
              query: { type: 'text' },
              refresh: { type: 'button', onClick: click }
            }
          }
        }
      },
      data: { title: 'Dune' }
    })
    await wrapper.find('.dito-panel button[id$="refresh"]').trigger('click')
    expect(click.mock.calls[0][0].serializedItem).toEqual({ query: 'Emma' })
  })

  it('computes the values of its own data in its own data model', async () => {
    const { wrapper, dataModel, settle } = await mountSchema({
      schema: {
        fields: { title: { type: 'text' } },
        // Both can save, so both would be dirty after edits:
        buttons: { save: { type: 'submit' } },
        panels: {
          stats: {
            type: 'panel',
            label: 'Stats',
            data: () => ({ words: 2 }),
            buttons: { apply: { type: 'submit' } },
            fields: {
              words: { type: 'number' },
              pages: {
                type: 'number',
                computeValue: ({ item }) => item.words * 10
              }
            }
          }
        }
      },
      data: { title: 'Mansfield Park' }
    })
    const panel = wrapper.findComponent(DitoPanel)
    expect(panel.vm.panelData).toEqual({ words: 2, pages: 20 })
    // Edits of the panel's data don't make the view's data dirty:
    await enterValue(panel.find('input'), '3')
    await settle()
    expect(panel.vm.panelData).toEqual({ words: 3, pages: 30 })
    expect(
      panel.findComponent(DitoSchema).vm.dataContext.isDirty
    ).toBe(true)
    expect(dataModel.isDirty).toBe(false)
  })

  it('gives the callbacks of its own data the contexts of its form', async () => {
    const { wrapper } = await mountForm({
      schema: {
        fields: { title: { type: 'text' } },
        panels: {
          links: {
            type: 'panel',
            data: () => ({}),
            fields: {
              url: {
                type: 'text',
                computeValue: ({ getResourceUrl }) => getResourceUrl()
              },
              // Forms don't continue the source of their parent:
              hasSourceQuery: {
                type: 'checkbox',
                computeValue: ({ sourceQuery }) => !!sourceQuery
              }
            }
          }
        }
      },
      data: { title: 'Emma' }
    })
    const panel = wrapper.findComponent(DitoPanel)
    expect(panel.vm.panelData).toEqual({
      url: '/items/1',
      hasSourceQuery: false
    })
  })

  it('validates and edits its own data through contexts', async () => {
    const click = vi.fn()
    const { wrapper, getComponent } = await mountSchema({
      schema: {
        fields: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            label: 'Search',
            data: { query: '' },
            fields: { query: { type: 'text', required: true } },
            buttons: {
              check: { type: 'button', text: 'Check', onClick: click },
              apply: { type: 'submit' }
            }
          }
        },
        buttons: { save: { type: 'submit' } }
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

  it('submits its own data through the form that it is in', async () => {
    const request = vi.fn(({ data }) => ({ data }))
    const { wrapper } = await mountForm({
      schema: {
        fields: { title: { type: 'text' } },
        panels: {
          search: {
            type: 'panel',
            data: { query: 'Emma' },
            fields: { query: { type: 'text' } },
            buttons: {
              search: {
                type: 'button',
                resource: { path: 'search', method: 'post' }
              }
            }
          }
        }
      },
      data: { title: 'Dune' },
      request
    })
    await wrapper.find('.dito-panel button[id$="search"]').trigger('click')
    await vi.waitFor(() => expect(request).toHaveBeenCalled())
    expect(request.mock.calls[0][0]).toMatchObject({
      method: 'post',
      url: '/items/1/search',
      data: { query: 'Emma' }
    })
  })
})
