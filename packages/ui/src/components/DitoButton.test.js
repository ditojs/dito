import { vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, renderSlot } from 'vue'
import DitoButton from './DitoButton.vue'

function mountButton(props = {}, options = {}) {
  return mount(DitoButton, { props, ...options })
}

describe('DitoButton', () => {
  it(`is of type="button" by default, to not submit forms`, () => {
    const button = mountButton()
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
  })

  it('renders other types when stated', () => {
    expect(mountButton({ type: 'submit' }).attributes('type')).toBe('submit')
  })

  it('disables native buttons natively', () => {
    const button = mountButton({ disabled: true })
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-disabled')).toBeUndefined()
  })

  it('renders other elements and components through `as`', () => {
    const link = mountButton({ as: 'a' }, { attrs: { href: '#chapter' } })
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe('#chapter')
    expect(link.attributes('type')).toBeUndefined()

    const Link = { render: () => h('a', { class: 'link' }) }
    expect(mountButton({ as: Link }).classes()).toEqual(
      expect.arrayContaining(['link', 'dito-button'])
    )
  })

  it('disables links through `aria-disabled` and the tab order', () => {
    const link = mountButton({ as: 'a', disabled: true })
    expect(link.attributes('aria-disabled')).toBe('true')
    expect(link.attributes('tabindex')).toBe('-1')
    expect(link.attributes('disabled')).toBeUndefined()
    expect(link.classes()).toContain('dito-button--disabled')

    const enabled = mountButton({ as: 'a' })
    expect(enabled.attributes('aria-disabled')).toBeUndefined()
    expect(enabled.attributes('tabindex')).toBeUndefined()
    expect(enabled.classes()).not.toContain('dito-button--disabled')
  })

  it(`doesn't let disabled links navigate or emit clicks`, async () => {
    const onClick = vi.fn()
    const link = mountButton(
      { as: 'a', disabled: true },
      { attrs: { href: '#chapter', onClick } }
    )
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(onClick).not.toHaveBeenCalled()

    await link.setProps({ disabled: false })
    await link.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('styles and labels buttons by their verb and subject', () => {
    const button = mountButton({ verb: 'add', subject: 'Section' })
    expect(button.classes()).toContain('dito-button--add')
    expect(button.attributes('title')).toBe('Add Section')
    expect(button.attributes('aria-label')).toBe('Add Section')
  })

  it('names buttons that display text by it, not by their verb', () => {
    const button = mountButton({ verb: 'add', text: 'Add Chapter' })
    expect(button.classes()).toContain('dito-button--add')
    expect(button.attributes('aria-label')).toBeUndefined()
    expect(button.find('.dito-button__text').text()).toBe('Add Chapter')
  })

  it('names buttons that display slot text by it, not by their verb', () => {
    const button = mountButton(
      { verb: 'add' },
      { slots: { default: () => 'Add Chapter' } }
    )
    expect(button.classes()).toContain('dito-button--add')
    expect(button.attributes('title')).toBeUndefined()
    expect(button.attributes('aria-label')).toBeUndefined()
    expect(button.text()).toBe('Add Chapter')
  })

  it('labels buttons by their verb when their slot shows no text', () => {
    const icon = mountButton(
      { verb: 'add' },
      { slots: { default: () => h('span', { class: 'icon' }) } }
    )
    expect(icon.attributes('aria-label')).toBe('Add')

    // Slots forwarded from empty slots render as empty fragments:
    const Forwarding = {
      setup:
        (props, { slots }) =>
        () =>
          h(DitoButton, { verb: 'add' }, () => renderSlot(slots, 'default'))
    }
    expect(mount(Forwarding).attributes('aria-label')).toBe('Add')
    expect(
      mount(Forwarding, {
        slots: { default: () => 'Add Chapter' }
      }).attributes('aria-label')
    ).toBeUndefined()
  })

  it('finds text in the children of elements that are not mounted yet', () => {
    // Before mounting, element vnodes hold their text children as strings:
    const text = mountButton(
      { verb: 'add' },
      { slots: { default: () => h('span', ['Add ', h('b', 'Chapter')]) } }
    )
    expect(text.attributes('aria-label')).toBeUndefined()
    expect(text.text()).toBe('Add Chapter')
    const blank = mountButton(
      { verb: 'add' },
      { slots: { default: () => h('span', ['  ', h('i')]) } }
    )
    expect(blank.attributes('aria-label')).toBe('Add')
  })

  it('wraps text in affixes from the prefix and suffix slots', () => {
    const button = mountButton(
      { text: 'Recipes' },
      {
        slots: {
          prefix: () => h('span', { class: 'count' }, '3'),
          suffix: () => h('span', { class: 'arrow' })
        }
      }
    )
    expect(button.classes()).toContain('dito-button--affixed')
    expect(button.find('.dito-button__prefix .count').text()).toBe('3')
    expect(button.find('.dito-button__text').text()).toBe('Recipes')
    expect(button.find('.dito-button__suffix .arrow').exists()).toBe(true)
  })

  it('renders no affixes without prefix and suffix content', () => {
    const button = mountButton({ text: 'Recipes' })
    expect(button.classes()).not.toContain('dito-button--affixed')
    expect(button.find('.dito-button__prefix').exists()).toBe(false)
    expect(button.find('.dito-button__suffix').exists()).toBe(false)
  })

  it('lets `title` and attributes override the verb labels', () => {
    const button = mountButton(
      { verb: 'delete', title: 'Delete Recipe' },
      { attrs: { 'aria-label': 'Delete Recipe' } }
    )
    expect(button.attributes('title')).toBe('Delete Recipe')
    expect(button.attributes('aria-label')).toBe('Delete Recipe')
  })

  it('renders default slot content without `text` or affixes', () => {
    const button = mountButton(
      {},
      { slots: { default: () => h('span', { class: 'icon' }) } }
    )
    expect(button.find('.icon').exists()).toBe(true)
    expect(button.find('.dito-button__text').exists()).toBe(false)
  })
})
