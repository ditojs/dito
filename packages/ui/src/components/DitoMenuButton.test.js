import { vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DitoMenuButton from './DitoMenuButton.vue'

const items = [
  { value: 'csv', label: 'CSV' },
  { value: 'upload', label: 'Upload', icon: 'upload' }
]

function mountMenuButton(props = {}, options = {}) {
  return mount(DitoMenuButton, {
    props: { items, ...props },
    attachTo: document.body,
    ...options
  })
}

// Opens the menu with Enter on its button:
async function openMenu(wrapper) {
  await wrapper.find('button').trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return wrapper.find('.dito-menu-button__menu')
}

describe('DitoMenuButton', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.restoreAllMocks()
  })

  it('renders its content and attributes in a `DitoButton`', () => {
    wrapper = mountMenuButton(
      { class: 'export', verb: 'export' },
      { slots: { default: 'Export' } }
    )
    const button = wrapper.find('button')
    expect(button.classes()).toEqual(
      expect.arrayContaining(['dito-button', 'dito-menu-button', 'export'])
    )
    expect(button.text()).toBe('Export')
  })

  it('shows the icons of items instead of their labels, as titles', async () => {
    wrapper = mountMenuButton()
    const menu = await openMenu(wrapper)
    const [csv, upload] = menu.findAll('.dito-menu-button__item')
    expect(csv.text()).toBe('CSV')
    expect(upload.text()).toBe('')
    expect(upload.attributes('title')).toBe('Upload')
    expect(upload.find('.dito-icon').exists()).toBe(true)
  })

  it('emits `select` with the chosen item', async () => {
    wrapper = mountMenuButton()
    const menu = await openMenu(wrapper)
    const [csv] = menu.findAll('.dito-menu-button__item')
    await csv.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[items[0]]])
  })

  it('marks the button and the menu of attached menus', async () => {
    wrapper = mountMenuButton({ attached: true })
    expect(wrapper.find('button').classes()).toContain(
      'dito-menu-button--attached'
    )
    const menu = await openMenu(wrapper)
    expect(menu.classes()).toContain('dito-menu-button__menu--attached')
  })

  it('aligns centered menus that would overflow to the edge of the button', async () => {
    wrapper = mountMenuButton()
    const button = wrapper.find('button').element
    const right = document.documentElement.clientWidth
    button.getBoundingClientRect = () => ({ left: right - 40, right })
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200)
    const menu = await openMenu(wrapper)
    expect(menu.attributes('data-align')).toBe('end')
  })
})
