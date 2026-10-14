import { h } from 'vue'
import DefaultExport, * as exports from './index.js'
import DitoAdmin from './DitoAdmin.js'
import { mountSchema } from './test/mount.js'
import {
  defineType as defineTypeDescriptor,
  getTypeDescriptor
} from './utils/schema/types.ts'

describe('@ditojs/admin exports', () => {
  it('exports `DitoAdmin` as default and named export', () => {
    expect(DefaultExport).toBe(DitoAdmin)
    expect(exports.DitoAdmin).toBe(DitoAdmin)
  })

  it('exports `defineType()` for types with custom components', async () => {
    const Counter = {
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
            class: 'counter',
            title: this.context.item.title,
            onClick: () => this.$emit('update:modelValue', this.modelValue + 1)
          },
          `${this.modelValue}`
        )
      }
    }
    exports.defineType({ type: 'counter', component: Counter })
    const { wrapper, data } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text' },
          count: { type: 'counter' }
        }
      },
      data: { title: 'Emma', count: 1 }
    })
    const button = wrapper.find('.counter')
    expect(button.attributes('title')).toBe('Emma')
    await button.trigger('click')
    expect(data.count).toBe(2)
    expect(button.text()).toBe('2')
  })

  it('keeps the traits of the types internal', () => {
    expect(exports).not.toHaveProperty('optionsTraits')
    expect(exports).not.toHaveProperty('numberTraits')
    expect(exports).not.toHaveProperty('textTraits')
  })

  describe('defineType()', () => {
    const component = {
      emits: ['update:modelValue', 'change'],
      props: {
        schema: { type: Object, required: true },
        context: { type: Object, required: true },
        modelValue: { type: String, default: null }
      },
      render() {
        return h('span', { class: 'isbn' }, this.modelValue)
      }
    }

    it('names the replacements of the descriptor keys of 3.x', () => {
      expect(() =>
        exports.defineType({ type: 'isbn', component, excludeValue: true })
      ).toThrow(
        `Invalid type descriptor key 'excludeValue', use 'defaultExclude'.`
      )
    })

    it('rejects unknown descriptor keys', () => {
      expect(() =>
        exports.defineType({ type: 'isbn', component, defaultLabel: 'ISBN' })
      ).toThrow(`Unknown type descriptor key: 'defaultLabel'.`)
    })

    it('rejects built-in types without `override: true`', () => {
      expect(() =>
        exports.defineType({ type: ['isbn', 'text'], component })
      ).toThrow(
        `Unable to redefine built-in type 'text' without 'override: true'.`
      )
    })

    it('replaces built-in types with `override: true`', async () => {
      const descriptor = getTypeDescriptor('number')
      try {
        exports.defineType({ type: 'number', component, override: true })
        const { wrapper } = await mountSchema({
          schema: { components: { isbn: { type: 'number' } } },
          data: { isbn: '978-0141439518' }
        })
        expect(wrapper.find('.isbn').text()).toBe('978-0141439518')
      } finally {
        defineTypeDescriptor(descriptor)
      }
    })
  })
})
