import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  MenuSchema,
  UploadSchema,
  TextareaSchema,
  View,
  NumberSchema,
  FormSchema,
  CustomComponentProps,
  CustomComponentEmits,
  ComponentSchemaBase,
  SchemaContext
} from '@ditojs/admin'
import type { Entry } from './fixtures.ts'

describe('Schemas with callbacks', () => {
  it('accepts callbacks for the settings of uploads and lines', () => {
    assertType<UploadSchema<Entry>>({
      type: 'upload',
      multiple: ({ item }) => !!item.title,
      extensions: () => ['png'],
      accept: () => 'image/png',
      maxSize: () => '1MB'
    })
    assertType<TextareaSchema<Entry>>({ type: 'textarea', lines: () => 4 })
  })
})

describe('MenuSchema', () => {
  it('accepts menu with items containing views', () => {
    assertType<MenuSchema<Entry>>({
      type: 'menu',
      label: 'Main Menu',
      name: 'mainMenu',
      items: {
        entries: {
          type: 'view',
          component: {
            type: 'list',
            form: {
              type: 'form',
              components: {
                title: { type: 'text' }
              }
            }
          }
        }
      }
    })
  })

  it('View union accepts both ViewSchema and MenuSchema', () => {
    const viewSchema: View<Entry> = {
      type: 'view',
      components: {
        title: { type: 'text' }
      }
    }

    const menuSchema: View<Entry> = {
      type: 'menu',
      label: 'Group',
      items: {
        sub: {
          type: 'view',
          components: {
            title: { type: 'text' }
          }
        }
      }
    }

    assertType<View<Entry>>(viewSchema)
    assertType<View<Entry>>(menuSchema)
  })
})

describe('NumberSchema', () => {
  it('accepts min, max, step, decimals', () => {
    assertType<NumberSchema<Entry>>({
      type: 'number',
      min: 0,
      max: 100,
      step: 0.5,
      decimals: 2
    })
  })

  it('accepts range as tuple', () => {
    assertType<NumberSchema<Entry>>({
      type: 'integer',
      range: [0, 100]
    })
  })

  it('accepts rules including integer', () => {
    assertType<NumberSchema<Entry>>({
      type: 'number',
      rules: {
        min: 0,
        max: 999,
        integer: true
      }
    })
  })

  it('accepts validate callbacks that return booleans or messages', () => {
    assertType<NumberSchema<Entry>>({
      type: 'integer',
      validate: ({ value, item }) => value !== 0 || `${item.title} is empty`
    })
    assertType<TextareaSchema<Entry>>({
      type: 'textarea',
      validate: () => {}
    })
    assertType<NumberSchema<Entry>>({
      type: 'integer',
      // @ts-expect-error Messages are strings:
      validate: () => 1
    })
  })
})

describe('SchemaAffixMixin (prefix/suffix)', () => {
  it('accepts prefix as string', () => {
    assertType<NumberSchema<Entry>>({
      type: 'number',
      prefix: '$'
    })
  })

  it('accepts prefix as array of SchemaAffix objects', () => {
    assertType<NumberSchema<Entry>>({
      type: 'number',
      prefix: [
        { type: 'icon', name: 'currency' },
        { html: '<b>$</b>', as: 'span' }
      ]
    })
  })

  it('accepts spinners and components as affixes', () => {
    assertType<NumberSchema<Entry>>({
      type: 'number',
      suffix: [
        { type: 'spinner', size: '12px', color: 'gray' },
        { type: 'component', component: {}, props: { unit: 'kg' } }
      ]
    })
  })

  it('rejects affixes without content', () => {
    assertType<NumberSchema<Entry>>({
      type: 'number',
      // @ts-expect-error - icons are given by `name`.
      prefix: { type: 'icon', text: 'currency' }
    })
  })

  it('accepts suffix with conditional if callback', () => {
    assertType<NumberSchema<Entry>>({
      type: 'number',
      suffix: {
        text: '%',
        if({ item }) {
          expectTypeOf(item).not.toBeAny()
          return item.id > 0
        }
      }
    })
  })
})

describe('ClipboardConfig', () => {
  it('accepts copy/paste callbacks on a form', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      clipboard: {
        copy(context) {
          expectTypeOf(context).not.toBeAny()
          expectTypeOf(context.item).not.toBeAny()
          return context.item
        },
        paste(context) {
          expectTypeOf(context).not.toBeAny()
          expectTypeOf(context.item).not.toBeAny()
          return context.item
        }
      },
      components: {
        title: { type: 'text' }
      }
    })
  })
})

describe('CustomComponentProps and CustomComponentEmits', () => {
  it('describe the props and events of custom components', () => {
    type Props = CustomComponentProps<Entry, number>
    expectTypeOf<Props['context']>().toEqualTypeOf<SchemaContext<Entry>>()
    expectTypeOf<Props['context']['item']['title']>().toBeString()
    expectTypeOf<Props['modelValue']>().toBeNumber()
    // Custom types of `defineType()` receive their own schema too:
    expectTypeOf<Props['schema']['type']>().toBeString()
    expectTypeOf<Props['schema']['label']>().not.toBeAny()
    expectTypeOf<Props['schema']['max']>().toBeUnknown()
    type RatingSchema = ComponentSchemaBase<Entry> & { max?: number }
    expectTypeOf<CustomComponentProps<Entry, number, RatingSchema>['schema']>()
      .toEqualTypeOf<RatingSchema>()
    expectTypeOf<CustomComponentEmits<number>['update:modelValue']>()
      .parameter(0)
      .toBeNumber()
    // `update:modelValue` emits the schema's `input` event:
    expectTypeOf<CustomComponentEmits>().not.toHaveProperty('input')
  })

  it('reads schema values with `context.getSchemaValue()`', () => {
    const context = {} as SchemaContext<Entry>
    expectTypeOf(context.getSchemaValue('label')).toBeAny()
    expectTypeOf(
      context.getSchemaValue('max', { type: Number, default: 5 })
    ).toBeNumber()
    expectTypeOf(context.getSchemaValue<string>('label')).toBeString()
    context.getSchemaValue(['options', 'label'])
    context.getSchemaValue('label', {
      type: [String, Object],
      default: context => {
        expectTypeOf(context.item.title).toBeString()
        return 'Rating'
      }
    })
  })
})
