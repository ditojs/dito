import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import DitoMenuButton from './DitoMenuButton.vue'

const items = [
  { value: 'heading', label: 'Heading' },
  { value: 'quote', label: 'Quote', disabled: true },
  { value: 'image', label: 'Image' }
]

function mountMenuButton(props = {}) {
  return mount(DitoMenuButton, {
    props: { items, ...props },
    attrs: { class: 'dito-create-menu' },
    slots: { default: 'Create' },
    attachTo: document.body
  })
}

function findButton(wrapper) {
  return wrapper.find('button[aria-haspopup="menu"]')
}

function findMenuItems(wrapper) {
  return wrapper.findAll('[role="menuitem"]')
}

async function pressKey(wrapper, key) {
  await wrapper.trigger('keydown', { key })
  await flushPromises()
}

describe('DitoMenuButton', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('renders a menu button with its attributes and content', () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    expect(button.classes()).toEqual(['dito-button', 'dito-create-menu'])
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(button.text()).toBe('Create')
    expect(wrapper.classes()).toContain('dito-menu-button')
  })

  it('renders its button with `DitoButton`, passing on its verb', () => {
    wrapper = mount(DitoMenuButton, {
      props: { items },
      attrs: { verb: 'create', text: 'New' }
    })
    const button = findButton(wrapper)
    expect(button.classes()).toContain('dito-button--create')
    expect(button.find('.dito-button__text').text()).toBe('New')
    // Buttons with text aren't labelled by their verb:
    expect(button.attributes('aria-label')).toBeUndefined()
  })

  it('opens and closes the menu with clicks on the button', async () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.classes()).toContain('dito-menu-button--open')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    expect(findMenuItems(wrapper).map(item => item.text())).toEqual([
      'Heading',
      'Quote',
      'Image'
    ])
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('selects items with clicks and closes the menu', async () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await button.trigger('click')
    await findMenuItems(wrapper)[2].trigger('click')
    expect(wrapper.emitted('select')).toEqual([[items[2]]])
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button.element)
  })

  it(`doesn't select disabled items`, async () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await button.trigger('click')
    const disabledItem = findMenuItems(wrapper)[1]
    expect(disabledItem.attributes('aria-disabled')).toBe('true')
    await disabledItem.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(button.attributes('aria-expanded')).toBe('true')
  })

  for (const key of ['Enter', ' ', 'ArrowDown']) {
    it(`opens with ${
      JSON.stringify(key)
    } and focuses the first item`, async () => {
      wrapper = mountMenuButton()
      const button = findButton(wrapper)
      await pressKey(button, key)
      expect(button.attributes('aria-expanded')).toBe('true')
      expect(document.activeElement).toBe(findMenuItems(wrapper)[0].element)
    })
  }

  it('opens with ArrowUp and focuses the last item', async () => {
    wrapper = mountMenuButton()
    await pressKey(findButton(wrapper), 'ArrowUp')
    expect(document.activeElement).toBe(findMenuItems(wrapper)[2].element)
  })

  it('moves the focus with the arrow keys, Home and End', async () => {
    wrapper = mountMenuButton()
    await pressKey(findButton(wrapper), 'Enter')
    const menu = wrapper.find('[role="menu"]')
    const elements = findMenuItems(wrapper).map(item => item.element)
    await pressKey(menu, 'ArrowDown')
    expect(document.activeElement).toBe(elements[1])
    await pressKey(menu, 'End')
    expect(document.activeElement).toBe(elements[2])
    await pressKey(menu, 'ArrowDown')
    expect(document.activeElement).toBe(elements[0])
    await pressKey(menu, 'ArrowUp')
    expect(document.activeElement).toBe(elements[2])
    await pressKey(menu, 'Home')
    expect(document.activeElement).toBe(elements[0])
  })

  for (const key of ['Enter', ' ']) {
    it(`selects the focused item with ${JSON.stringify(key)}`, async () => {
      wrapper = mountMenuButton()
      const button = findButton(wrapper)
      await pressKey(button, 'ArrowUp')
      await pressKey(wrapper.find('[role="menu"]'), key)
      expect(wrapper.emitted('select')).toEqual([[items[2]]])
      expect(button.attributes('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(button.element)
    })
  }

  it(`doesn't select disabled items with the keyboard`, async () => {
    wrapper = mountMenuButton()
    await pressKey(findButton(wrapper), 'Enter')
    const menu = wrapper.find('[role="menu"]')
    await pressKey(menu, 'ArrowDown')
    await pressKey(menu, 'Enter')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('prevents the keyup of Space from clicking buttons', async () => {
    // Firefox clicks buttons on the keyup of Space, even if the keydown that
    // opened the menu or selected an item was prevented.
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await pressKey(button, ' ')
    for (const element of [document.activeElement, button.element]) {
      const event = new KeyboardEvent('keyup', {
        key: ' ',
        bubbles: true,
        cancelable: true
      })
      element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
  })

  it('closes with Escape and returns the focus to the button', async () => {
    const onKeyDown = vi.fn()
    document.body.addEventListener('keydown', onKeyDown)
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await pressKey(button, 'Enter')
    onKeyDown.mockClear()
    await pressKey(wrapper.find('[role="menu"]'), 'Escape')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button.element)
    // Escape doesn't also close what contains the menu button, e.g. dialogs.
    expect(onKeyDown).not.toHaveBeenCalled()
    document.body.removeEventListener('keydown', onKeyDown)
  })

  it('closes with Tab', async () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await pressKey(button, 'Enter')
    await pressKey(wrapper.find('[role="menu"]'), 'Tab')
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('closes on mouseup outside of it', async () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await button.trigger('click')
    await nextTick()
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextTick()
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it(`doesn't open when disabled`, async () => {
    wrapper = mountMenuButton({ disabled: true })
    const button = findButton(wrapper)
    expect(button.attributes('disabled')).toBeDefined()
    await wrapper.find('.dito-trigger').trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
  })
})
