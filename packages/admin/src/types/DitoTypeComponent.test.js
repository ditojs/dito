import { h } from 'vue'
import { mountSchema } from '../test/mount.js'

// A custom component, which gets `DitoMixin` and `TypeMixin` added, so that it
// can display and change `value` like the built-in types:
const RatingStars = {
  render() {
    return h(
      'button',
      {
        class: 'rating-stars',
        onClick: () => {
          this.value = (this.value ?? 0) + 1
        }
      },
      '*'.repeat(this.value ?? 0)
    )
  }
}

describe('DitoTypeComponent', () => {
  it('renders the custom component with the value', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          rating: { type: 'component', component: RatingStars }
        }
      },
      data: { rating: 2 }
    })
    const button = findField('rating')
    expect(button.text()).toBe('**')
    await button.trigger('click')
    expect(data.rating).toBe(3)
    expect(button.text()).toBe('***')
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
