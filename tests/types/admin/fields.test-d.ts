import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  Components,
  FormSchema,
  PanelSchema,
  SchemaContext,
  SectionSchema,
  View
} from '@ditojs/admin'
import type { Entry, Parent } from './fixtures.ts'

describe('fields and field', () => {
  it('accepts the fields of views, forms, sections and panels', () => {
    const fields: Components<Entry> = { title: { type: 'text' } }
    assertType<View<Entry>>({ type: 'view', fields })
    assertType<FormSchema<Entry>>({ type: 'form', fields })
    assertType<SectionSchema<Entry>>({ type: 'section', fields })
    assertType<PanelSchema<Entry>>({ type: 'panel', fields })
  })

  it('accepts the field of views', () => {
    assertType<View<Entry>>({
      type: 'view',
      field: {
        type: 'list',
        form: { type: 'form', fields: { title: { type: 'text' } } }
      }
    })
  })

  it('types the items of the callbacks of fields', () => {
    assertType<View<Parent>>({
      type: 'view',
      fields: {
        entries: {
          type: 'list',
          fields: {
            title: {
              type: 'text',
              onChange({ item }) {
                expectTypeOf(item).toEqualTypeOf<Entry>()
              }
            }
          }
        }
      }
    })
  })

  it('accepts `fields()` callbacks in sections', () => {
    assertType<SectionSchema<Entry>>({
      type: 'section',
      fields: ({ item }) => {
        expectTypeOf(item.title).toBeString()
        return { title: { type: 'text' } }
      }
    })
  })

  it('accepts the fields of dialogs', () => {
    const context = {} as SchemaContext<Entry>
    assertType(
      context.showDialog({
        fields: { title: { type: 'text' } },
        buttons: { cancel: {} }
      })
    )
  })

  it('accepts the fields of custom filters', () => {
    assertType<View<Entry>>({
      type: 'view',
      field: {
        type: 'list',
        filters: { status: { fields: { status: { type: 'text' } } } }
      }
    })
  })

  it('keeps accepting the deprecated components and component', () => {
    const components: Components<Entry> = { title: { type: 'text' } }
    assertType<View<Entry>>({ type: 'view', components })
    assertType<View<Entry>>({
      type: 'view',
      component: { type: 'list', form: { type: 'form', components } }
    })
    assertType<FormSchema<Entry>>({ type: 'form', components })
    assertType<SectionSchema<Entry>>({ type: 'section', components })
    assertType<PanelSchema<Entry>>({ type: 'panel', components })
    const context = {} as SchemaContext<Entry>
    assertType(context.showDialog({ components, buttons: { cancel: {} } }))
  })
})
