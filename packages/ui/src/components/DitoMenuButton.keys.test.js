import { mount, flushPromises } from '@vue/test-utils'
import DitoMenuButton from './DitoMenuButton.vue'

const items = [
  { value: 'starters', label: 'Starters' },
  { value: 'mains', label: 'Mains' },
  { value: 'desserts', label: 'Desserts' }
]

function mountMenuButton(props = {}) {
  return mount(DitoMenuButton, {
    props: { items, ...props },
    slots: { default: 'Add course' },
    attachTo: document.body
  })
}

function findButton(wrapper) {
  return wrapper.find('button[aria-haspopup="menu"]')
}

async function pressKey(element, key) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true
  })
  element.dispatchEvent(event)
  await flushPromises()
  return event
}

describe('DitoMenuButton keyboard edge cases', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('ignores other keys on the button', async () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    for (const key of ['ArrowLeft', 'a', 'Escape']) {
      const event = await pressKey(button.element, key)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('ignores other keys in the menu', async () => {
    wrapper = mountMenuButton()
    await pressKey(findButton(wrapper).element, 'ArrowDown')
    const [first] = wrapper.findAll('[role="menuitem"]')
    expect(document.activeElement).toBe(first.element)
    const event = await pressKey(first.element, 'ArrowRight')
    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(first.element)
    expect(findButton(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it(`doesn't select anything with Enter when no item is focused`, async () => {
    wrapper = mountMenuButton()
    await findButton(wrapper).trigger('click')
    await flushPromises()
    const menu = wrapper.find('[role="menu"]').element
    const event = await pressKey(menu, 'Enter')
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(findButton(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it('focuses the first item with ArrowDown when none is focused', async () => {
    wrapper = mountMenuButton()
    await findButton(wrapper).trigger('click')
    await flushPromises()
    await pressKey(wrapper.find('[role="menu"]').element, 'ArrowDown')
    expect(document.activeElement.textContent).toBe('Starters')
  })

  it('forgets the elements of removed items', async () => {
    wrapper = mountMenuButton()
    await pressKey(findButton(wrapper).element, 'ArrowDown')
    await wrapper.setProps({ items: items.slice(1) })
    await flushPromises()
    expect(wrapper.vm.itemElements.size).toBe(2)
    expect(wrapper.vm.itemElements.has(items[0])).toBe(false)
  })

  it('passes the placement to the popup and marks itself open', async () => {
    wrapper = mountMenuButton({ cover: false, placement: 'bottom-right' })
    await findButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('.dito-popup').classes()).toContain(
      'dito-popup-bottom-right'
    )
    expect(wrapper.classes()).toContain('dito-menu-button--open')
  })
})
