import { vi } from 'vitest'
import { h } from 'vue'
import { defineType, getSchemaValue, optionsTraits } from '../index.js'
import { mountSchema } from '../test/mount.js'

// A custom component, which displays and changes its value through
// `modelValue` and `update:modelValue`, and emits `change` once it's done:
const RatingStars = {
  emits: ['update:modelValue', 'change'],

  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true },
    modelValue: { type: Number, default: null }
  },

  render() {
    return h(
      'button',
      {
        class: 'rating-stars',
        title: getSchemaValue(this.schema, 'title', this.context),
        onClick: () => {
          this.$emit('update:modelValue', (this.modelValue ?? 0) + 1)
          this.$emit('change')
        }
      },
      '*'.repeat(this.modelValue ?? 0)
    )
  }
}

describe('DitoTypeComponent', () => {
  it('renders the custom component with the value', async () => {
    const change = vi.fn()
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          rating: {
            type: 'component',
            component: RatingStars,
            onChange: change
          }
        }
      },
      data: { rating: 2 }
    })
    const button = findField('rating')
    expect(button.text()).toBe('**')
    await button.trigger('click')
    expect(data.rating).toBe(3)
    expect(button.text()).toBe('***')
    // `change` emits the change event of the schema with the new value:
    expect(change).toHaveBeenCalledOnce()
    expect(change.mock.calls[0][0].value).toBe(3)
  })

  it('passes the schema and the reactive context', async () => {
    const { findField, wrapper } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text' },
          rating: {
            type: 'component',
            component: RatingStars,
            title: ({ item }) => `Rate ${item.title}`
          }
        }
      },
      data: { title: 'Emma', rating: 1 }
    })
    expect(findField('rating').attributes('title')).toBe('Rate Emma')
    await wrapper.find('input[name="title"]').setValue('Persuasion')
    expect(findField('rating').attributes('title')).toBe('Rate Persuasion')
  })

  it('resolves components that are imported asynchronously', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          rating: {
            type: 'component',
            // Like `import('./RatingStars.vue')`:
            component: Promise.resolve({
              default: RatingStars,
              [Symbol.toStringTag]: 'Module'
            })
          }
        }
      },
      data: { rating: 1 }
    })
    expect(findField('rating').text()).toBe('*')
  })

  it('only sets a value with `default`', async () => {
    const { data } = await mountSchema({
      schema: {
        components: {
          rating: { type: 'component', component: RatingStars },
          votes: { type: 'component', component: RatingStars, default: 0 }
        }
      }
    })
    expect('rating' in data).toBe(false)
    expect(data.votes).toBe(0)
  })

  it('sets no value with `default: undefined`', async () => {
    const { data } = await mountSchema({
      schema: {
        components: {
          rating: {
            type: 'component',
            component: RatingStars,
            default: undefined
          }
        }
      }
    })
    expect('rating' in data).toBe(false)
  })

  it('passes the events and attributes of the field through', async () => {
    const focus = vi.fn()
    const blur = vi.fn()
    const { findField, getErrors, settle } = await mountSchema({
      schema: {
        components: {
          rating: {
            type: 'component',
            component: RatingStars,
            required: true,
            onFocus: focus,
            onBlur: blur
          }
        }
      },
      data: { rating: null }
    })
    const button = findField('rating')
    // The button doesn't emit them, so they fall through as native events:
    await button.trigger('focus')
    await button.trigger('blur')
    expect(focus).toHaveBeenCalledOnce()
    expect(blur).toHaveBeenCalledOnce()
    // Blur validates the value, and the errors are linked to the component:
    expect(getErrors('rating')).toEqual(['The rating field is required.'])
    await settle()
    expect(findField('rating').attributes('aria-invalid')).toBe('true')
    expect(findField('rating').attributes('aria-describedby')).toBe(
      'rating-errors'
    )
  })

  it('warns about components that miss props or emits of the contract', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { emits, ...UndeclaredStars } = RatingStars
    await mountSchema({
      schema: {
        components: {
          rating: {
            type: 'component',
            component: { ...UndeclaredStars, name: 'UndeclaredStars' }
          }
        }
      },
      data: { rating: 1 }
    })
    expect(warn).toHaveBeenCalledWith(
      `Custom component 'UndeclaredStars' doesn't declare the props and ` +
      `emits of its contract: update:modelValue, change.`
    )
    warn.mockRestore()
  })
})

describe('defineType()', () => {
  // A custom type with options, which it reads from its context:
  defineType({
    ...optionsTraits,
    type: 'genre-chips',
    component: {
      emits: ['update:modelValue', 'change'],
      props: {
        schema: { type: Object, required: true },
        context: { type: Object, required: true },
        modelValue: { type: String, default: null }
      },

      render() {
        return h(
          'ul',
          { class: 'genre-chips' },
          this.context.options.map(option => h('li', option.label))
        )
      }
    }
  })

  it('passes the options of custom types in their context', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          genre: {
            type: 'genre-chips',
            options: [
              { value: 'drama', label: 'Drama' },
              { value: 'poetry', label: 'Poetry' }
            ]
          }
        }
      },
      data: { genre: 'drama' }
    })
    const items = findField('genre').findAll('li')
    expect(items.map(item => item.text())).toEqual(['Drama', 'Poetry'])
  })
})

describe('DitoTypePanel', () => {
  it('renders its components in the sidebar with the same data', async () => {
    const { wrapper, data } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text' },
          summary: {
            type: 'panel',
            label: 'Summary',
            components: { notes: { type: 'textarea' } }
          }
        }
      },
      data: { title: 'Emma', notes: 'Classic' }
    })
    // Panels aren't rendered in place:
    expect(wrapper.find('.dito-view textarea').exists()).toBe(false)
    const panel = wrapper.find('.dito-sidebar .dito-panel')
    expect(panel.text()).toContain('Summary')
    const notes = panel.find('textarea')
    expect(notes.element.value).toBe('Classic')
    await notes.setValue('Novel')
    expect(data.notes).toBe('Novel')
  })
})
