import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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

function findMenu(wrapper) {
  return wrapper.find('[role="menu"]')
}

function findMenuItems(wrapper) {
  return wrapper.findAll('[role="menuitem"]')
}

// Clicks the element at least a millisecond after it was mounted. Vue ignores
// events in the millisecond in which their listener was attached once another
// Vue listener saw them, e.g. the capture listener of `DitoButton`.
async function click(element) {
  await new Promise(resolve => setTimeout(resolve, 1))
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
  await flushPromises()
}

// Presses the key on the focused element, like the keyboard does.
async function pressKey(key, element = document.activeElement) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true
  })
  element.dispatchEvent(event)
  await flushPromises()
  return event
}

// reka-ui returns the focus to the button after a timeout:
async function waitForFocus(wrapper) {
  await vi.waitFor(() => expect(document.activeElement).toBe(wrapper.element))
}

async function openWithKey(wrapper, key = 'Enter') {
  const button = findButton(wrapper)
  button.element.focus()
  await pressKey(key)
  return button
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
    expect(button.classes()).toContain('dito-button')
    expect(button.classes()).toContain('dito-create-menu')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(button.text()).toBe('Create')
    expect(wrapper.classes()).toContain('dito-menu-button')
  })

  it('opens the menu offset below the top of the button with `offset`', () => {
    wrapper = mountMenuButton()
    expect(wrapper.classes()).not.toContain('dito-menu-button--offset')
    wrapper.unmount()
    wrapper = mountMenuButton({ offset: true })
    expect(wrapper.classes()).toContain('dito-menu-button--offset')
  })

  it('attaches the menu below the button with `cover: false`', () => {
    wrapper = mountMenuButton()
    expect(wrapper.classes()).not.toContain('dito-menu-button--attached')
    wrapper.unmount()
    wrapper = mountMenuButton({ cover: false })
    expect(wrapper.classes()).toContain('dito-menu-button--attached')
  })

  it('opens the menu as a separate panel with a tip with `floating`', async () => {
    wrapper = mountMenuButton({ cover: false, floating: true })
    expect(wrapper.classes()).toContain('dito-menu-button--floating')
    expect(wrapper.classes()).not.toContain('dito-menu-button--attached')
    const button = findButton(wrapper)
    await click(button.element)
    expect(findMenu(wrapper).find('.dito-menu-button__tip').exists()).toBe(
      true
    )
    // The button keeps its size and place:
    const { minWidth, marginLeft, marginRight } = button.element.style
    expect({ minWidth, marginLeft, marginRight }).toEqual({
      minWidth: '',
      marginLeft: '',
      marginRight: ''
    })
  })

  it('places the menu by `placement` and marks itself open', async () => {
    wrapper = mountMenuButton({ cover: false, placement: 'bottom-right' })
    await click(findButton(wrapper).element)
    const menu = findMenu(wrapper)
    expect(menu.attributes('data-side')).toBe('bottom')
    expect(menu.attributes('data-align')).toBe('end')
    expect(wrapper.classes()).toContain('dito-menu-button--open')
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
    await click(button.element)
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(findMenuItems(wrapper).map(item => item.text())).toEqual([
      'Heading',
      'Quote',
      'Image'
    ])
    await click(button.element)
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(findMenu(wrapper).exists()).toBe(false)
  })

  it('shows the icons of items instead of their labels', async () => {
    wrapper = mountMenuButton({
      items: [
        { value: 'heading', label: 'Heading' },
        { value: 'image', label: 'Image', icon: 'image' }
      ]
    })
    await click(findButton(wrapper).element)
    const [textItem, iconItem] = findMenuItems(wrapper)
    expect(textItem.text()).toBe('Heading')
    expect(textItem.attributes('title')).toBeUndefined()
    expect(iconItem.text()).toBe('')
    expect(iconItem.attributes('title')).toBe('Image')
    expect(iconItem.classes()).toContain('dito-menu-button__item--icon')
    expect(iconItem.find('.dito-icon--image').exists()).toBe(true)
  })

  it('selects items with clicks, closes and focuses the button', async () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await click(button.element)
    await findMenuItems(wrapper)[2].trigger('click')
    await flushPromises()
    expect(wrapper.emitted('select')).toEqual([[items[2]]])
    expect(button.attributes('aria-expanded')).toBe('false')
    await waitForFocus(button)
  })

  it(`doesn't select disabled items`, async () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await click(button.element)
    const disabledItem = findMenuItems(wrapper)[1]
    expect(disabledItem.attributes('aria-disabled')).toBe('true')
    await disabledItem.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(button.attributes('aria-expanded')).toBe('true')
  })

  for (const key of ['Enter', ' ', 'ArrowDown']) {
    it(`opens with ${
      JSON.stringify(key)
    } and focuses the first item`, async () => {
      wrapper = mountMenuButton()
      const button = await openWithKey(wrapper, key)
      expect(button.attributes('aria-expanded')).toBe('true')
      expect(document.activeElement).toBe(findMenuItems(wrapper)[0].element)
    })
  }

  it('opens with ArrowUp and focuses the last item', async () => {
    wrapper = mountMenuButton()
    await openWithKey(wrapper, 'ArrowUp')
    expect(document.activeElement).toBe(findMenuItems(wrapper)[2].element)
  })

  it('moves the focus with the arrow keys, Home and End', async () => {
    wrapper = mountMenuButton({
      items: [
        { value: 'heading', label: 'Heading' },
        { value: 'quote', label: 'Quote' },
        { value: 'image', label: 'Image' }
      ]
    })
    await openWithKey(wrapper)
    const elements = findMenuItems(wrapper).map(item => item.element)
    await pressKey('ArrowDown')
    expect(document.activeElement).toBe(elements[1])
    await pressKey('End')
    expect(document.activeElement).toBe(elements[2])
    await pressKey('ArrowDown')
    expect(document.activeElement).toBe(elements[0])
    await pressKey('ArrowUp')
    expect(document.activeElement).toBe(elements[2])
    await pressKey('Home')
    expect(document.activeElement).toBe(elements[0])
  })

  it('skips disabled items with the keyboard', async () => {
    wrapper = mountMenuButton()
    await openWithKey(wrapper)
    await pressKey('ArrowDown')
    expect(document.activeElement).toBe(findMenuItems(wrapper)[2].element)
  })

  it('focuses items by typing the start of their label', async () => {
    wrapper = mountMenuButton()
    await openWithKey(wrapper)
    await pressKey('i')
    expect(document.activeElement).toBe(findMenuItems(wrapper)[2].element)
  })

  for (const key of ['Enter', ' ']) {
    it(`selects the focused item with ${JSON.stringify(key)}`, async () => {
      wrapper = mountMenuButton()
      const button = await openWithKey(wrapper, 'ArrowUp')
      await pressKey(key)
      expect(wrapper.emitted('select')).toEqual([[items[2]]])
      expect(button.attributes('aria-expanded')).toBe('false')
      await waitForFocus(button)
    })
  }

  it('closes with Escape, focuses the button and marks it handled', async () => {
    wrapper = mountMenuButton()
    const button = await openWithKey(wrapper)
    // Escape doesn't also close what contains the menu button, e.g. dialogs:
    const event = await pressKey('Escape')
    expect(event.defaultPrevented).toBe(true)
    expect(button.attributes('aria-expanded')).toBe('false')
    await waitForFocus(button)
  })

  it('closes when the focus leaves the menu, e.g. with Tab', async () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    wrapper = mountMenuButton()
    const button = await openWithKey(wrapper)
    outside.focus()
    await flushPromises()
    expect(button.attributes('aria-expanded')).toBe('false')
    outside.remove()
  })

  it('closes on presses outside of it', async () => {
    wrapper = mountMenuButton()
    const button = findButton(wrapper)
    await click(button.element)
    // reka-ui listens for presses outside the menu after a timeout:
    await new Promise(resolve => setTimeout(resolve))
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0 })
    )
    await flushPromises()
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it(`doesn't open when disabled`, async () => {
    wrapper = mountMenuButton({ disabled: true })
    const button = findButton(wrapper)
    expect(button.attributes('disabled')).toBeDefined()
    await click(button.element)
    expect(button.attributes('aria-expanded')).toBe('false')
    await pressKey('ArrowUp', button.element)
    expect(button.attributes('aria-expanded')).toBe('false')
  })
})
