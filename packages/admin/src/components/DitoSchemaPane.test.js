import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountAdmin } from '../test/mount.js'
import DitoSchemaPane from './DitoSchemaPane.vue'
import DitoPaneRows from './DitoPaneRows.vue'

describe('DitoSchemaPane', () => {
  // happy-dom doesn't lay out elements, so place all containers next to each
  // other in one row, each three lines high without padding, at a font size of
  // 16px, and move the ones of `offsets` down by their offset:
  function stubLayout(offsets = {}) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function () {
        const index = +(this.dataset.index ?? 0)
        return {
          x: index * 100,
          y: offsets[index] ?? 0,
          width: 100,
          height: 64
        }
      }
    )
    const { getComputedStyle } = window
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
      const style = getComputedStyle(element)
      return { ...style, padding: '8px', fontSize: '16px' }
    })
  }

  async function measureRows(wrapper) {
    wrapper.findComponent(DitoPaneRows).vm.onResizePane()
    await flushPromises()
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('aligns the components in rows with labels to the labels', async () => {
    stubLayout()
    const { wrapper, findContainer, data, settle } = await mountSchema({
      schema: {
        fields: {
          hasSubtitle: { type: 'checkbox', label: false, width: '1/3' },
          subtitle: {
            type: 'text',
            label: 'Subtitle',
            width: '1/3',
            if: ({ item }) => item.hasSubtitle
          },
          title: { type: 'text', label: false, width: '1/3' }
        }
      },
      data: { hasSubtitle: true, subtitle: 'Book', title: 'Emma' }
    })
    const isLabelVertical = name =>
      findContainer(name).classes('dito-container--label-vertical')
    await measureRows(wrapper)
    expect(isLabelVertical('hasSubtitle')).toBe(true)
    expect(isLabelVertical('title')).toBe(true)

    // Once the labeled component is gone, the row isn't aligned anymore:
    data.hasSubtitle = false
    await settle()
    await measureRows(wrapper)
    expect(isLabelVertical('hasSubtitle')).toBe(false)
    expect(isLabelVertical('title')).toBe(false)
  })

  it('aligns the components in rows with labels by their types', async () => {
    stubLayout()
    const { wrapper, findContainer } = await mountSchema({
      schema: {
        fields: {
          name: { type: 'text', label: 'Name', width: '1/3' },
          captain: { type: 'checkbox', label: false, width: '1/3' },
          details: {
            type: 'section',
            width: '1/3',
            fields: { coach: { type: 'text' } }
          }
        }
      },
      data: { name: 'Rovers', captain: true, coach: 'Ada' }
    })
    await measureRows(wrapper)
    const isAlignedBelowLabels = name =>
      findContainer(name).classes('dito-container--below-labels')
    expect(isAlignedBelowLabels('captain')).toBe(true)
    // Sections, lists and objects are boxes that start at the top of the row:
    expect(
      findContainer('details').classes('dito-container--label-vertical')
    ).toBe(true)
    expect(isAlignedBelowLabels('details')).toBe(false)
  })

  it.each([
    [
      'sections',
      {
        type: 'section',
        fields: { title: { type: 'text', label: 'Title' } }
      }
    ],
    [
      'inlined objects',
      {
        type: 'object',
        label: false,
        inlined: true,
        form: {
          type: 'form',
          fields: { title: { type: 'text', label: 'Title' } }
        }
      }
    ]
  ])('aligns the components in rows with labels of %s', async (_, schema) => {
    stubLayout()
    const { wrapper, findContainer } = await mountSchema({
      schema: {
        fields: {
          inStock: { type: 'checkbox', label: false, width: '1/2' },
          details: { ...schema, width: '1/2' }
        }
      },
      data: { inStock: true, title: 'Emma', details: { title: 'Emma' } }
    })
    await measureRows(wrapper)
    expect(
      findContainer('inStock').classes('dito-container--label-vertical')
    ).toBe(true)
  })

  it('aligns the components in rows with components aligned vertically', async () => {
    stubLayout({ 1: 20 })
    const { wrapper, findContainer } = await mountSchema({
      schema: {
        fields: {
          weight: { type: 'slider', label: 'Weight', width: '1/3' },
          isVariable: {
            type: 'switch',
            label: false,
            width: '1/3',
            align: 'bottom'
          },
          axis: { type: 'text', label: false, width: '1/3' }
        }
      },
      data: { weight: 400, isVariable: true, axis: 'wght' }
    })
    await measureRows(wrapper)
    expect(
      findContainer('axis').classes('dito-container--label-vertical')
    ).toBe(true)
  })

  it('keeps aligning a row once its last component is gone', async () => {
    stubLayout()
    const { wrapper, findContainer, data, settle } = await mountSchema({
      schema: {
        fields: {
          name: { type: 'text', label: 'Name', width: '1/3' },
          captain: { type: 'checkbox', label: false, width: '1/3' },
          coach: {
            type: 'text',
            label: false,
            width: '1/3',
            if: ({ item }) => item.hasCoach
          }
        }
      },
      data: { name: 'Rovers', captain: true, hasCoach: true }
    })
    const isLabelVertical = name =>
      findContainer(name).classes('dito-container--label-vertical')
    await measureRows(wrapper)
    expect(isLabelVertical('captain')).toBe(true)
    expect(isLabelVertical('coach')).toBe(true)

    data.hasCoach = false
    await settle()
    await measureRows(wrapper)
    expect(findContainer('coach').exists()).toBe(false)
    expect(isLabelVertical('name')).toBe(true)
    expect(isLabelVertical('captain')).toBe(true)
  })

  it(`doesn't align components that aren't laid out`, async () => {
    stubLayout()
    // Hidden components have no height, e.g. the ones in hidden tabs:
    HTMLElement.prototype.getBoundingClientRect.mockReturnValue({
      x: 0,
      y: 0,
      width: 0,
      height: 0
    })
    const { wrapper, findContainer } = await mountSchema({
      schema: {
        fields: {
          name: { type: 'text', label: 'Name', width: '1/2' },
          captain: { type: 'checkbox', label: false, width: '1/2' }
        }
      },
      data: { name: 'Rovers', captain: true }
    })
    await measureRows(wrapper)
    const rows = wrapper.findComponent(DitoPaneRows).vm
    expect(rows.positions).toEqual([null, null])
    expect(
      findContainer('captain').classes('dito-container--label-vertical')
    ).toBe(false)
  })

  it(`measures nothing when none of its components are rendered`, async () => {
    stubLayout()
    const { wrapper } = await mountSchema({
      schema: {
        fields: {
          coach: {
            type: 'object',
            inlined: true,
            form: {
              type: 'form',
              fields: { name: { type: 'text', if: false } }
            }
          }
        }
      },
      data: { coach: { name: 'Alex' } }
    })
    const rows = wrapper
      .findAllComponents(DitoSchemaPane)
      .find(({ vm }) => vm.dataPath === 'coach')
      .findComponent(DitoPaneRows).vm
    rows.onResizePane()
    await flushPromises()
    expect(rows.positions).toEqual([])
  })

  it('updates its positions when its components change', async () => {
    const { wrapper, data, settle } = await mountSchema({
      schema: {
        fields: {
          blocks: {
            type: 'list',
            inlined: true,
            forms: {
              heading: {
                type: 'form',
                fields: { text: { type: 'text' } }
              },
              image: {
                type: 'form',
                fields: { url: { type: 'url' }, caption: { type: 'text' } }
              }
            }
          }
        }
      },
      data: { blocks: [{ type: 'image', url: null, caption: null }] }
    })
    const getBlockPane = () =>
      wrapper
        .findAllComponents(DitoSchemaPane)
        .find(({ vm }) => vm.dataPath === 'blocks/0')
    const pane = getBlockPane()
    const rows = pane.findComponent(DitoPaneRows).vm
    rows.positions.push({ left: 0, height: 3 }, { left: 100, height: 3 })
    data.blocks[0].type = 'heading'
    await settle()
    expect(getBlockPane().vm.$).toBe(pane.vm.$)
    expect(pane.vm.entries.map(({ schema }) => schema.name)).toEqual(['text'])
    expect(rows.positions).toHaveLength(1)
  })

  describe('tab panes', () => {
    async function mountTabs() {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            tabs: {
              details: {
                type: 'tab',
                fields: { title: { type: 'text' } }
              },
              // Tabs may only have panels, without components:
              notes: { type: 'tab' }
            }
          }
        }
      })
      await admin.navigate('/books')
      return admin
    }

    it('are selected when their components are focused', async () => {
      const admin = await mountTabs()
      await admin.navigate('/books/notes')
      const title = admin.getComponent(admin.getRouteComponent(), 'title')
      await admin.context.ui.reveal(title.container, title.componentPath, {
        focus: true
      })
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/books/details')
    })

    it('render nothing without components', async () => {
      const admin = await mountTabs()
      await admin.navigate('/books/notes')
      const notes = admin.wrapper
        .findAllComponents(DitoSchemaPane)
        .find(({ vm }) => vm.tab === 'notes')
      expect(notes.vm.entries).toEqual([])
      expect(notes.find('.dito-pane').exists()).toBe(false)
    })
  })

  it(`doesn't navigate when focusing components outside of tabs`, async () => {
    const { admin, focusField } = await mountSchema({
      schema: { fields: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    await focusField('title')
    await flushPromises()
    expect(admin.router.currentRoute.value.fullPath).toBe('/test')
  })
})
