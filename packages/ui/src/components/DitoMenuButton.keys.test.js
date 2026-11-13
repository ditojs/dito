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

// Clicks the element at least a millisecond after it was mounted. Vue ignores
// events in the millisecond in which their listener was attached once another
// Vue listener saw them, e.g. the capture listener of `DitoButton`.
async function click(element) {
  await new Promise(resolve => setTimeout(resolve, 1))
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
  await flushPromises()
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
    findButton(wrapper).element.focus()
    await pressKey(findButton(wrapper).element, 'ArrowDown')
    const [first] = wrapper.findAll('[role="menuitem"]')
    expect(document.activeElement).toBe(first.element)
    await pressKey(first.element, 'ArrowRight')
    expect(document.activeElement).toBe(first.element)
    expect(findButton(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it(`doesn't select anything with Enter when no item is focused`, async () => {
    wrapper = mountMenuButton()
    await click(findButton(wrapper).element)
    // Clicks focus the menu, not its items:
    const menu = wrapper.find('[role="menu"]').element
    expect(document.activeElement).toBe(menu)
    await pressKey(menu, 'Enter')
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(findButton(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it('focuses the first item with ArrowDown when none is focused', async () => {
    wrapper = mountMenuButton()
    await click(findButton(wrapper).element)
    await pressKey(wrapper.find('[role="menu"]').element, 'ArrowDown')
    expect(document.activeElement.textContent).toBe('Starters')
  })

  it('reaches the items that it renders after changes', async () => {
    wrapper = mountMenuButton()
    findButton(wrapper).element.focus()
    await pressKey(findButton(wrapper).element, 'ArrowDown')
    await wrapper.setProps({ items: items.slice(1) })
    await flushPromises()
    const menu = wrapper.find('[role="menu"]').element
    await pressKey(menu, 'End')
    expect(document.activeElement.textContent).toBe('Desserts')
    await pressKey(document.activeElement, 'Home')
    expect(document.activeElement.textContent).toBe('Mains')
  })
})
