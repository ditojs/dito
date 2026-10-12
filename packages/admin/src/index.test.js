import { h } from 'vue'
import DefaultExport, * as exports from './index.js'
import DitoAdmin from './DitoAdmin.js'
import { getTypeDescriptor } from './utils/schema/types.ts'
import { optionsTraits } from './types/traits.ts'
import { mountSchema } from './test/mount.js'

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

  it('exports traits for custom types to share', () => {
    exports.defineType({
      type: 'tags',
      component: { render: () => null },
      ...exports.optionsTraits
    })
    expect(exports.optionsTraits).toBe(optionsTraits)
    expect(
      getTypeDescriptor('tags').getOptionsDataSchema({ options: ['a'] })
    ).toEqual(['a'])
  })

  it('exports `getSchemaValue()` for custom components', () => {
    const context = { item: { title: 'Emma' } }
    const schema = {
      label: 'Rating',
      title: ({ item }) => `Rate ${item.title}`
    }
    expect(exports.getSchemaValue(schema, 'label', context)).toBe('Rating')
    expect(exports.getSchemaValue(schema, 'title', context)).toBe('Rate Emma')
    expect(exports.getSchemaValue(schema, 'max', context)).toBe(undefined)
  })
})
