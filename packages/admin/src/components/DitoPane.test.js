import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountAdmin } from '../test/mount.js'

describe('DitoPane', () => {
  // happy-dom doesn't lay out elements, so place all containers in one row,
  // each three lines high without padding, at a font size of 16px:
  function stubLayout() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 100,
      height: 64
    })
    const { getComputedStyle } = window
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
      const style = getComputedStyle(element)
      return { ...style, padding: '8px', fontSize: '16px' }
    })
  }

  async function measureRows(wrapper) {
    wrapper.findComponent({ name: 'DitoPane' }).vm.onResizePane()
    await flushPromises()
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('aligns the components in rows with labels to the labels', async () => {
    stubLayout()
    const { wrapper, findContainer, data, settle } = await mountSchema({
      schema: {
        components: {
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

  it('keeps aligning a row once its last component is gone', async () => {
    stubLayout()
    const { wrapper, findContainer, data, settle } = await mountSchema({
      schema: {
        components: {
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
        components: {
          name: { type: 'text', label: 'Name', width: '1/2' },
          captain: { type: 'checkbox', label: false, width: '1/2' }
        }
      },
      data: { name: 'Rovers', captain: true }
    })
    await measureRows(wrapper)
    const pane = wrapper.findComponent({ name: 'DitoPane' }).vm
    expect(pane.positions).toEqual([null, null])
    expect(
      findContainer('captain').classes('dito-container--label-vertical')
    ).toBe(false)
  })

  it(`measures nothing when none of its components are rendered`, async () => {
    stubLayout()
    const { wrapper } = await mountSchema({
      schema: {
        components: {
          coach: {
            type: 'object',
            inlined: true,
            form: {
              type: 'form',
              components: { name: { type: 'text', if: false } }
            }
          }
        }
      },
      data: { coach: { name: 'Alex' } }
    })
    const pane = wrapper
      .findAllComponents({ name: 'DitoPane' })
      .find(({ vm }) => vm.dataPath === 'coach').vm
    pane.onResizePane()
    await flushPromises()
    expect(pane.positions).toEqual([])
  })

  it('updates its positions when its components change', async () => {
    const { wrapper, data, settle } = await mountSchema({
      schema: {
        components: {
          blocks: {
            type: 'list',
            inlined: true,
            forms: {
              heading: {
                type: 'form',
                components: { text: { type: 'text' } }
              },
              image: {
                type: 'form',
                components: { url: { type: 'url' }, caption: { type: 'text' } }
              }
            }
          }
        }
      },
      data: { blocks: [{ type: 'image', url: null, caption: null }] }
    })
    const getBlockPane = () =>
      wrapper
        .findAllComponents({ name: 'DitoPane' })
        .find(({ vm }) => vm.dataPath === 'blocks/0').vm
    const pane = getBlockPane()
    pane.positions.push({ top: 0, height: 3 }, { top: 0, height: 3 })
    data.blocks[0].type = 'heading'
    await settle()
    expect(getBlockPane()).toBe(pane)
    expect(pane.componentSchemas.map(({ schema }) => schema.name)).toEqual([
      'text'
    ])
    expect(pane.positions).toHaveLength(1)
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
                components: { title: { type: 'text' } }
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

    it('select their tab when focused', async () => {
      const admin = await mountTabs()
      const panes = admin.wrapper.findAllComponents({ name: 'DitoPane' })
      const details = panes.find(({ vm }) => vm.tab === 'details').vm
      await admin.navigate('/books#notes')
      await details.focus()
      expect(admin.router.currentRoute.value.hash).toBe('#details')
    })

    it('render nothing without components', async () => {
      const admin = await mountTabs()
      const notes = admin.wrapper
        .findAllComponents({ name: 'DitoPane' })
        .find(({ vm }) => vm.tab === 'notes')
      expect(notes.vm.componentSchemas).toEqual([])
      expect(notes.find('.dito-pane').exists()).toBe(false)
    })
  })

  it(`doesn't navigate when focusing panes that aren't tabs`, async () => {
    const { admin, wrapper } = await mountSchema({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    const pane = wrapper.findComponent({ name: 'DitoPane' }).vm
    expect(pane.focus()).toBe(undefined)
    expect(admin.router.currentRoute.value.fullPath).toBe('/test')
  })
})
