import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  Components,
  Form,
  ListSchema,
  ColumnSchema,
  DitoContext
} from '../index.d.ts'
import type { Entry, Parent } from './fixtures.ts'

describe('ListSchema', () => {
  it('accepts form components typed against $Item', () => {
    assertType<ListSchema<Entry>>({
      type: 'list',
      form: {
        type: 'form',
        components: {
          title: { type: 'text' }
        }
      }
    })
  })

  it('accepts columns as a record of ColumnSchema', () => {
    assertType<ListSchema<Entry>>({
      type: 'list',
      columns: {
        title: {
          label: 'Title',
          sortable: true
        } satisfies ColumnSchema<Entry>
      }
    })
  })

  it('accepts columns as an array of item keys', () => {
    assertType<ListSchema<Entry>>({
      type: 'list',
      columns: ['title', 'id']
    })
  })

  it('rejects unknown keys in columns array', () => {
    assertType<ListSchema<Entry>>({
      type: 'list',
      // @ts-expect-error 'missing' is not a key of Entry
      columns: ['title', 'missing']
    })
  })

  it('accepts creatable as boolean or callback', () => {
    assertType<ListSchema<Entry>>({
      type: 'list',
      creatable: true
    })

    assertType<ListSchema<Entry>>({
      type: 'list',
      creatable(ctx) {
        expectTypeOf(ctx).toMatchTypeOf<DitoContext<Entry>>()
        expectTypeOf(ctx.item.title).toBeString()
        return true
      }
    })
  })

  it('types list correctly inside Components', () => {
    assertType<Components<Parent>>({
      entries: {
        type: 'list',
        form: {
          type: 'form',
          components: {
            title: { type: 'text' }
          }
        } satisfies Form<Entry>
      }
    })
  })

  it('rejects wrong form type via typed variable', () => {
    const parentForm: Form<Parent> = {
      type: 'form',
      components: {
        title: { type: 'text' },
        entries: { type: 'list' }
      }
    }

    assertType<ListSchema<Entry>>({
      type: 'list',
      // @ts-expect-error Form<Parent> is not assignable to ResolvableForm<Entry>
      form: parentForm
    })
  })

  it('accepts draggable, collapsible, collapsed as OrItemAccessor', () => {
    assertType<ListSchema<Entry>>({
      type: 'list',
      draggable: true
    })

    assertType<ListSchema<Entry>>({
      type: 'list',
      draggable(ctx) {
        expectTypeOf(ctx).toMatchTypeOf<DitoContext<Entry>>()
        return true
      }
    })

    assertType<ListSchema<Entry>>({
      type: 'list',
      collapsible: true,
      collapsed: false
    })
  })

  it('accepts scopes as string array or object', () => {
    assertType<ListSchema<Entry>>({
      type: 'list',
      scopes: ['active', 'archived']
    })

    assertType<ListSchema<Entry>>({
      type: 'list',
      scopes: {
        active: { label: 'Active', defaultScope: true },
        archived: 'Archived'
      }
    })
  })

  it('accepts editable and deletable like creatable', () => {
    assertType<ListSchema<Entry>>({
      type: 'list',
      editable: true,
      deletable: false
    })

    assertType<ListSchema<Entry>>({
      type: 'list',
      editable: (ctx) => ({ label: 'Edit' }),
      deletable: (ctx) => true
    })
  })

  it('accepts itemLabel as string, callback, or false', () => {
    assertType<ListSchema<Entry>>({
      type: 'list',
      itemLabel: 'title'
    })

    assertType<ListSchema<Entry>>({
      type: 'list',
      itemLabel: false
    })

    assertType<ListSchema<Entry>>({
      type: 'list',
      itemLabel({ item }) {
        expectTypeOf(item.title).toBeString()
        return item.title
      }
    })
  })
})
