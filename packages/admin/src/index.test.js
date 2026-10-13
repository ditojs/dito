import { h } from 'vue'
import DefaultExport, * as exports from './index.js'
import DitoAdmin from './DitoAdmin.js'
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

  it('keeps the traits of the types internal', () => {
    expect(exports).not.toHaveProperty('optionsTraits')
    expect(exports).not.toHaveProperty('numberTraits')
    expect(exports).not.toHaveProperty('textTraits')
  })
})
