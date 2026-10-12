import { expectTypeOf, assertType, describe, it } from 'vitest'
import { getSchemaValue } from '@ditojs/admin'
import type {
  MenuSchema,
  View,
  NumberSchema,
  Form,
  CustomComponentProps,
  CustomComponentEmits,
  SchemaContext
} from '@ditojs/admin'
import type { Entry } from './fixtures.ts'

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
        { type: 'icon', text: 'currency' },
        { html: '<b>$</b>' }
      ]
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
    assertType<Form<Entry>>({
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
    expectTypeOf<Props['schema']['type']>().toEqualTypeOf<'component'>()
    expectTypeOf<CustomComponentEmits<number>['update:modelValue']>()
      .parameter(0)
      .toBeNumber()
  })

  it('reads schema values with `getSchemaValue()`', () => {
    const context = {} as SchemaContext<Entry>
    expectTypeOf(getSchemaValue({ label: 'Rating' }, 'label', context))
      .toBeAny()
  })
})
