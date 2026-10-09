import { vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DitoInput from './DitoInput.vue'

function mountInput(props = {}, options = {}) {
  return mount(DitoInput, { props, attachTo: document.body, ...options })
}

describe('DitoInput', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('renders a text input with the given value', () => {
    wrapper = mountInput({ modelValue: 'Moby Dick' })
    const input = wrapper.find('input')
    expect(input.attributes('type')).toBe('text')
    expect(input.element.value).toBe('Moby Dick')
    expect(input.attributes('autocomplete')).toBe('off')
  })

  it('passes its props on to the native input', () => {
    wrapper = mountInput({
      type: 'number',
      id: 'page-count',
      name: 'pageCount',
      title: 'Page Count',
      placeholder: 'Pages',
      autocomplete: 'on',
      readonly: true,
      disabled: true
    })
    const input = wrapper.find('input')
    expect(input.attributes()).toMatchObject({
      'type': 'number',
      'id': 'page-count',
      'name': 'pageCount',
      'title': 'Page Count',
      'aria-label': 'Page Count',
      'placeholder': 'Pages',
      'autocomplete': 'on'
    })
    expect(input.element.readOnly).toBe(true)
    expect(input.element.disabled).toBe(true)
  })

  it('puts the class on the wrapper and other attributes on the input', () => {
    wrapper = mountInput(
      {},
      {
        attrs: {
          'class': 'book-title',
          'maxlength': '80',
          'data-field': 'title'
        }
      }
    )
    expect(wrapper.classes()).toEqual(['dito-input', 'book-title'])
    const input = wrapper.find('input')
    expect(input.classes()).toEqual([])
    expect(input.attributes('maxlength')).toBe('80')
    expect(input.attributes('data-field')).toBe('title')
  })

  it('reflects the `focused` prop as a modifier class', async () => {
    wrapper = mountInput()
    expect(wrapper.classes()).not.toContain('dito-input--focus')
    await wrapper.setProps({ focused: true })
    expect(wrapper.classes()).toContain('dito-input--focus')
  })

  it('renders the prefix and suffix slots around the input', () => {
    wrapper = mountInput(
      {},
      {
        slots: {
          prefix: '<span class="prefix">$</span>',
          suffix: '<span class="suffix">.00</span>'
        }
      }
    )
    const children = [...wrapper.element.children].map(
      child => child.className || child.tagName
    )
    expect(children).toEqual(['prefix', 'INPUT', 'suffix'])
  })

  it('emits `update:modelValue` when typed into', async () => {
    wrapper = mountInput({ modelValue: 'Emma' })
    await wrapper.find('input').setValue('Persuasion')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Persuasion']])
  })

  it('updates the input when the model value changes', async () => {
    wrapper = mountInput({ modelValue: 'Emma' })
    await wrapper.setProps({ modelValue: 'Middlemarch' })
    expect(wrapper.find('input').element.value).toBe('Middlemarch')
    // Changes from the outside aren't emitted back:
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('emits numbers for number inputs', async () => {
    wrapper = mountInput({ type: 'number', modelValue: 12 })
    await wrapper.setProps({ modelValue: 240 })
    expect(wrapper.find('input').element.value).toBe('240')
    await wrapper.find('input').setValue('300')
    expect(wrapper.emitted('update:modelValue')).toEqual([[300]])
  })

  it('exposes the native input and focuses and blurs it', () => {
    wrapper = mountInput()
    const input = wrapper.find('input').element
    expect(wrapper.vm.input).toBe(input)
    wrapper.vm.focus()
    expect(document.activeElement).toBe(input)
    wrapper.vm.blur()
    expect(document.activeElement).not.toBe(input)
  })

  it('focuses the input on mousedown on the wrapper', async () => {
    wrapper = mountInput(
      {},
      { slots: { suffix: '<span class="suffix">kg</span>' } }
    )
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true
    })
    wrapper.find('.suffix').element.dispatchEvent(event)
    expect(document.activeElement).toBe(wrapper.find('input').element)
    expect(event.defaultPrevented).toBe(true)
  })

  it(`doesn't focus disabled or readonly inputs on mousedown`, async () => {
    for (const props of [{ disabled: true }, { readonly: true }]) {
      wrapper = mountInput(props)
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true
      })
      wrapper.element.dispatchEvent(event)
      expect(document.activeElement).not.toBe(wrapper.find('input').element)
      expect(event.defaultPrevented).toBe(false)
      wrapper.unmount()
    }
    wrapper = null
  })

  it('leaves mousedown on the input itself to the browser', () => {
    wrapper = mountInput()
    const onMouseDown = vi.fn()
    document.body.addEventListener('mousedown', onMouseDown)
    try {
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true
      })
      wrapper.find('input').element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
      // Stopped at the input, to not reach the wrapper's handler or parents.
      expect(onMouseDown).not.toHaveBeenCalled()
    } finally {
      document.body.removeEventListener('mousedown', onMouseDown)
    }
  })

  // Bug: the `size` computed property derives a size from `min` and `max`,
  // but it is never bound to the input, so it has no effect.
  it.fails('sizes number inputs according to `min` and `max`', () => {
    wrapper = mountInput(
      { type: 'number' },
      { attrs: { min: 0, max: 1000 } }
    )
    expect(wrapper.vm.size).toBe(1)
    expect(wrapper.find('input').attributes('size')).toBe('1')
  })
})
