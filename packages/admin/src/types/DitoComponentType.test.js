import { vi } from 'vitest'
import { h } from 'vue'
import { defineType } from '../index.js'
import { mountForm, mountSchema } from '../test/mount.js'

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
        title: this.context.getSchemaValue('title'),
        onClick: () => {
          this.$emit('update:modelValue', (this.modelValue ?? 0) + 1)
          this.$emit('change')
        }
      },
      '*'.repeat(this.modelValue ?? 0)
    )
  }
}

describe('DitoComponentType', () => {
  it('renders the custom component with the value', async () => {
    const change = vi.fn()
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
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
        fields: {
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
        fields: {
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
        fields: {
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
        fields: {
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

  it('validates and submits values without `default`', async () => {
    const { findField, getErrors, submit } = await mountForm({
      schema: {
        fields: {
          rating: {
            type: 'component',
            component: RatingStars,
            validate: ({ value }) => value > 1 || 'needs two stars'
          }
        }
      },
      data: { rating: 1 },
      request: ({ data }) => ({ data })
    })
    expect(await submit()).toBe(null)
    expect(getErrors('rating')).toEqual(['The Rating field needs two stars.'])
    await findField('rating').trigger('click')
    expect(await submit()).toMatchObject({ rating: 2 })
  })

  it('passes the events and attributes of the field through', async () => {
    const focus = vi.fn()
    const blur = vi.fn()
    const { findField, getErrors, settle } = await mountSchema({
      schema: {
        fields: {
          rating: {
            type: 'component',
            component: RatingStars,
            validate: ({ value }) => value > 1 || 'needs two stars',
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
    await button.trigger('click')
    await button.trigger('blur')
    expect(focus).toHaveBeenCalledOnce()
    expect(blur).toHaveBeenCalledOnce()
    // Blur validates the edited value, and the errors are linked to the
    // component:
    expect(getErrors('rating')).toEqual(['The rating field needs two stars.'])
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
        fields: {
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

  describe('display-only components', () => {
    // A component that only displays, without a value of its own:
    const ReadingTime = {
      props: {
        schema: { type: Object, required: true },
        context: { type: Object, required: true }
      },

      render() {
        return h('p', `${this.context.item.words / 250} min`)
      }
    }

    it('needs no value props or emits without a `default`', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { findField } = await mountSchema({
        schema: {
          fields: {
            readingTime: { type: 'component', component: ReadingTime }
          }
        },
        data: { words: 500 }
      })
      expect(findField('readingTime').text()).toBe('2 min')
      expect(findField('readingTime').attributes('modelvalue')).toBeUndefined()
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('get no value, even if the item holds one at their name', async () => {
      const { findField, wrapper, data } = await mountSchema({
        schema: {
          fields: {
            readingTime: { type: 'component', component: ReadingTime },
            rating: { type: 'component', component: RatingStars }
          }
        },
        data: { words: 500, readingTime: 2, rating: 1 }
      })
      expect(findField('readingTime').attributes('modelvalue')).toBeUndefined()
      const { $attrs } = wrapper.findComponent(ReadingTime).vm
      expect($attrs).not.toHaveProperty('modelValue')
      expect($attrs).not.toHaveProperty('onUpdate:modelValue')
      // Components with a value still get it, and its updates:
      expect(wrapper.findComponent(RatingStars).props('modelValue')).toBe(1)
      await findField('rating').trigger('click')
      expect(data.rating).toBe(2)
    })

    it('may declare `change` for inputs of their own', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await mountSchema({
        schema: {
          fields: {
            readingTime: {
              type: 'component',
              component: { ...ReadingTime, emits: ['change'] }
            }
          }
        },
        data: { words: 500 }
      })
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('still need them with a `default`', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await mountSchema({
        schema: {
          fields: {
            readingTime: {
              type: 'component',
              component: { ...ReadingTime, name: 'ReadingTime' },
              default: 0
            }
          }
        },
        data: { words: 500 }
      })
      expect(warn).toHaveBeenCalledWith(
        `Custom component 'ReadingTime' doesn't declare the props and ` +
        `emits of its contract: modelValue, update:modelValue, change.`
      )
      warn.mockRestore()
    })

    it.each([
      ['extends', { extends: RatingStars }],
      ['mixins', { mixins: [RatingStars] }]
    ])(
      'are no components that declare the value in `%s`',
      async (_, component) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { findField, wrapper, data } = await mountSchema({
          schema: {
            fields: {
              rating: { type: 'component', component }
            }
          },
          data: { rating: 1 }
        })
        expect(wrapper.findComponent(component).props('modelValue')).toBe(1)
        await findField('rating').trigger('click')
        expect(data.rating).toBe(2)
        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
      }
    )
  })
})

describe('defineType()', () => {
  // A custom type with options, which it reads from its context:
  defineType({
    type: 'genre-chips',
    getOptionsDataSchema: schema => schema.options,
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
        fields: {
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

  it('reads `hasLabel` of custom types as a boolean too', async () => {
    const component = {
      props: {
        schema: { type: Object, required: true },
        context: { type: Object, required: true },
        modelValue: { type: String, default: null }
      },

      render() {
        return h('h2', this.modelValue)
      }
    }
    defineType({ type: 'heading', hasLabel: false, component })
    defineType({ type: 'subheading', hasLabel: true, component })
    const { findContainer } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'heading', label: 'Title' },
          subtitle: { type: 'subheading', label: 'Subtitle' }
        }
      },
      data: { title: 'Emma', subtitle: 'A Novel' }
    })
    expect(findContainer('title').find('.dito-label').exists()).toBe(false)
    expect(findContainer('subtitle').find('.dito-label').text()).toBe(
      'Subtitle'
    )
  })
})

describe('DitoPanelType', () => {
  it('renders its components in the sidebar with the same data', async () => {
    const { wrapper, data } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text' },
          summary: {
            type: 'panel',
            label: 'Summary',
            fields: { notes: { type: 'textarea' } }
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
