import { vi } from 'vitest'
import { h } from 'vue'
import { getSchemaValue } from '../index.js'
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
            events: { change }
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
