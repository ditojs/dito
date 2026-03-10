import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  MenuSchema,
  View,
  NumberSchema,
  ClipboardConfig,
  Form,
  OrArrayOf,
  Resolvable
} from '../index.d.ts'
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
          return item.id > 0
        }
      }
    })
  })
})

describe('ClipboardConfig', () => {
  it('accepts boolean', () => {
    assertType<ClipboardConfig>(true)
    assertType<ClipboardConfig>(false)
  })

  it('accepts copy/paste callbacks on a form', () => {
    assertType<Form<Entry>>({
      type: 'form',
      clipboard: {
        copy(context) {
          return context.item
        },
        paste(context) {
          return context.item
        }
      },
      components: {
        title: { type: 'text' }
      }
    })
  })
})

describe('Utility types', () => {
  it('Resolvable accepts value, function, promise, or record', () => {
    assertType<Resolvable<number>>(42)
    assertType<Resolvable<number>>(() => 42)
    assertType<Resolvable<number>>(Promise.resolve(42))
    assertType<Resolvable<number>>(() => Promise.resolve(42))
    assertType<Resolvable<number>>({ key: 42 })
    assertType<Resolvable<number>>(
      Promise.resolve({ key: 42 })
    )
  })

  it('OrArrayOf accepts single value or array', () => {
    assertType<OrArrayOf<string>>('hello')
    assertType<OrArrayOf<string>>(['hello', 'world'])

    expectTypeOf<OrArrayOf<number>>()
      .toEqualTypeOf<number | number[]>()
  })
})
