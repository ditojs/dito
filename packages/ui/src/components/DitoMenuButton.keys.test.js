import { mount, flushPromises } from '@vue/test-utils'
import DitoMenuButton from './DitoMenuButton.vue'
import { click, pressKey } from '../test/events.js'

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
      const event = await pressKey(key, button.element)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('ignores other keys in the menu', async () => {
    wrapper = mountMenuButton()
    findButton(wrapper).element.focus()
    await pressKey('ArrowDown', findButton(wrapper).element)
    const [first] = wrapper.findAll('[role="menuitem"]')
    expect(document.activeElement).toBe(first.element)
    await pressKey('ArrowRight', first.element)
    expect(document.activeElement).toBe(first.element)
    expect(findButton(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it(`doesn't select anything with Enter when no item is focused`, async () => {
    wrapper = mountMenuButton()
    await click(findButton(wrapper).element)
    // Clicks focus the menu, not its items:
    const menu = wrapper.find('[role="menu"]').element
    expect(document.activeElement).toBe(menu)
    await pressKey('Enter', menu)
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(findButton(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it('focuses the first item with ArrowDown when none is focused', async () => {
    wrapper = mountMenuButton()
    await click(findButton(wrapper).element)
    await pressKey('ArrowDown', wrapper.find('[role="menu"]').element)
    expect(document.activeElement.textContent).toBe('Starters')
  })

  it('reaches the items that it renders after changes', async () => {
    wrapper = mountMenuButton()
    findButton(wrapper).element.focus()
    await pressKey('ArrowDown', findButton(wrapper).element)
    await wrapper.setProps({ items: items.slice(1) })
    await flushPromises()
    const menu = wrapper.find('[role="menu"]').element
    await pressKey('End', menu)
    expect(document.activeElement.textContent).toBe('Desserts')
    await pressKey('Home', document.activeElement)
    expect(document.activeElement.textContent).toBe('Mains')
  })
})
