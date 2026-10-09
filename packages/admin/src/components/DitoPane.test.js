import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema } from '../test/mount.js'

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
})
