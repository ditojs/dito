import { vi } from 'vitest'
import { h, resolveComponent } from 'vue'
import { flushPromises } from '@vue/test-utils'
import {
  mountAdmin,
  mountSchema,
  mountForm,
  enterValue
} from '../test/mount.js'
import DitoField from './DitoField.vue'
import DitoPane from './DitoPane.vue'
import DitoPaneRows from './DitoPaneRows.vue'

// A layout component that renders the nodes that `render()` returns:
function createLayout(render) {
  return {
    props: {
      schema: { type: Object, required: true },
      context: { type: Object, required: true }
    },
    render
  }
}

const getLabels = wrapper =>
  wrapper
    .findAll(':scope > .dito-container > .dito-label')
    .map(label => label.text())

describe('DitoPane', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('places the components of `names` in rows', async () => {
    const { wrapper, findContainer } = await mountSchema({
      schema: {
        components: {
          name: {
            type: 'section',
            component: createLayout(() =>
              h(DitoPane, { names: ['last', 'first'] })
            ),
            components: {
              title: { type: 'text', label: 'Title' },
              first: { type: 'text', label: 'First', width: '1/3' },
              last: { type: 'text', label: 'Last', width: '2/3' }
            }
          }
        }
      },
      data: { first: 'Ada', last: 'Lovelace' }
    })
    const pane = wrapper.find('.dito-section .dito-pane--layout')
    expect(getLabels(pane)).toEqual(['Last', 'First'])
    expect(
      pane.findAll('input').map(({ element }) => element.value)
    ).toEqual(['Lovelace', 'Ada'])
    expect(findContainer('first').attributes('style')).toContain(
      '--basis: 33.3'
    )
    expect(findContainer('last').attributes('style')).toContain('--basis: 66.6')
  })

  it('places all components without `names`', async () => {
    const { wrapper } = await mountSchema({
      schema: {
        components: {
          name: {
            type: 'section',
            component: createLayout(() => h(DitoPane)),
            components: {
              first: { type: 'text', label: 'First' },
              last: { type: 'text', label: 'Last' }
            }
          }
        }
      }
    })
    expect(getLabels(wrapper.find('.dito-pane--layout'))).toEqual([
      'First',
      'Last'
    ])
  })

  it('is registered globally, for layouts with templates', async () => {
    const { wrapper } = await mountSchema({
      schema: {
        components: {
          name: {
            type: 'section',
            component: createLayout(() =>
              h(resolveComponent('DitoPane'), { names: ['last'] })
            ),
            components: {
              first: { type: 'text', label: 'First' },
              last: { type: 'text', label: 'Last' }
            }
          }
        }
      }
    })
    expect(getLabels(wrapper.find('.dito-pane--layout'))).toEqual(['Last'])
  })

  it('places panes next to fields in the same layout', async () => {
    const { wrapper } = await mountSchema({
      schema: {
        components: {
          name: {
            type: 'section',
            component: createLayout(() => [
              h(DitoField, { name: 'title' }),
              h(DitoPane, { names: ['first', 'last'] })
            ]),
            components: {
              title: { type: 'text', label: 'Title' },
              first: { type: 'text', label: 'First', width: '1/2' },
              last: { type: 'text', label: 'Last', width: '1/2' }
            }
          }
        }
      }
    })
    // Both sit in the row of the section's pane, which the pane's modifier
    // aligns with the fields:
    const host = wrapper.find(
      '.dito-section .dito-pane:not(.dito-pane--layout)'
    )
    expect(
      host.findAll(':scope > *').map(({ element }) => element.className)
    ).toEqual([
      expect.stringContaining('dito-container'),
      'dito-pane dito-pane--layout'
    ])
    expect(getLabels(host)).toEqual(['Title'])
    expect(getLabels(host.find('.dito-pane--layout'))).toEqual([
      'First',
      'Last'
    ])
  })

  it('aligns the components in rows with labels to the labels', async () => {
    // happy-dom doesn't lay out elements, so place the containers next to
    // each other in one row, each three lines high:
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function () {
        const index = +(this.dataset.index ?? 0)
        return { x: index * 100, y: 0, width: 100, height: 64 }
      }
    )
    const { getComputedStyle } = window
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element => ({
      ...getComputedStyle(element),
      padding: '8px',
      fontSize: '16px'
    }))
    const { wrapper, findContainer } = await mountSchema({
      schema: {
        components: {
          name: {
            type: 'section',
            component: createLayout(() =>
              h(DitoPane, { names: ['isVisible', 'title'] })
            ),
            components: {
              title: { type: 'text', label: 'Title', width: '1/2' },
              isVisible: { type: 'checkbox', label: false, width: '1/2' }
            }
          }
        }
      }
    })
    wrapper
      .findComponent(DitoPane)
      .findComponent(DitoPaneRows)
      .vm.onResizePane()
    await flushPromises()
    expect(
      findContainer('isVisible').classes('dito-container--label-vertical')
    ).toBe(true)
  })

  it('edits, validates and submits the components like the pane', async () => {
    const { wrapper, routeComponent, data, submit } = await mountForm({
      schema: {
        components: {
          name: {
            type: 'section',
            nested: true,
            component: createLayout(() => h(DitoPane)),
            components: { first: { type: 'text', required: true } }
          }
        }
      },
      data: { name: { first: '' } },
      request: ({ data }) => ({ data })
    })
    const getErrors = () =>
      wrapper
        .findAll('.dito-pane--layout .dito-errors li')
        .map(item => item.text())
    expect(await submit()).toBe(null)
    expect(getErrors()).toEqual(['The First field is required.'])
    expect(routeComponent.routeContext.isDirty).toBe(false)
    await enterValue(wrapper.find('.dito-pane--layout input'), 'Ada')
    expect(data.name).toEqual({ first: 'Ada' })
    expect(routeComponent.routeContext.isDirty).toBe(true)
    expect(getErrors()).toEqual([])
    expect(await submit()).toMatchObject({ name: { first: 'Ada' } })
  })

  it.each([
    [
      'unknown components',
      {
        type: 'section',
        component: createLayout(() =>
          h(DitoPane, { names: ['first', 'middle'] })
        ),
        components: { first: { type: 'text' } }
      },
      `Unknown component: 'middle'.`
    ],
    [
      'panes outside of layout sections',
      { type: 'component', component: createLayout(() => h(DitoPane)) },
      `Unable to place panes outside of sections with 'component'.`
    ]
  ])('throws for %s', async (_, name, message) => {
    const admin = await mountAdmin({
      views: { test: { type: 'view', components: { name } } }
    })
    const errorHandler = vi.fn()
    admin.app.config.errorHandler = errorHandler
    await admin.navigate('/test')
    expect(errorHandler).toHaveBeenCalledWith(
      new Error(message),
      expect.anything(),
      expect.anything()
    )
  })
})
