import { assertType, describe, expectTypeOf, it } from 'vitest'
import { h, ref } from 'vue'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoNumberField,
  DitoSwitchField,
  DitoSection,
  DitoTextareaField,
  DitoSelectField,
  DitoCheckboxesField,
  DitoMultiselectField,
  DitoDateField,
  DitoTimeField,
  DitoDateTimeField,
  DitoUploadField,
  DitoCustomField,
  DitoListField,
  DitoObjectField
} from '@ditojs/admin'
import type { FormSchema, SchemaContext } from '@ditojs/admin'

type Product = { id: number; name: string; price: number }

describe('useDitoForm()', () => {
  it('takes the form schema with a resource and an id', () => {
    const form = useDitoForm<Product>({
      resource: 'products',
      id: () => 7,
      fields: {
        name: { type: 'text', required: true },
        price: { type: 'number' }
      },
      buttons: { publish: { type: 'submit', label: 'Publish' } },
      onSuccess: ({ item }) => {
        expectTypeOf(item).toEqualTypeOf<Product>()
      }
    })
    expectTypeOf(form).toEqualTypeOf<SchemaContext<Product>>()
    expectTypeOf(form.isDirty).toEqualTypeOf<boolean>()
  })

  it('takes ids as refs, and null to create items', () => {
    useDitoForm({ resource: 'products', id: ref<string | null>(null) })
    useDitoForm({ resource: 'products', id: null })
  })

  it('takes forms without a resource', () => {
    useDitoForm({ fields: { name: { type: 'text' } } })
  })

  it('rejects other ids and types', () => {
    // @ts-expect-error: Ids are strings or numbers.
    useDitoForm({ resource: 'products', id: true })
    // @ts-expect-error: The type is always `form`.
    useDitoForm({ type: 'view' })
  })
})

describe('FormSchema', () => {
  it('takes properties with a component in nested forms', () => {
    const LimitsLayout = { render: () => h(DitoNumberField, { name: 'min' }) }
    assertType<FormSchema>({
      type: 'form',
      fields: {
        limits: {
          type: 'object',
          form: {
            type: 'form',
            properties: { min: { type: 'number' } },
            component: LimitsLayout
          }
        }
      }
    })
  })
})

describe('DitoSchemaForm', () => {
  it('is a component', () => {
    assertType<object>(DitoSchemaForm)
  })
})

describe('widgets', () => {
  it('take the name of their property and display props', () => {
    h(DitoTextField, { name: 'name', label: 'Name', width: '1/2' })
    h(DitoNumberField, { name: 'rank', step: 5, clearable: true })
    h(DitoSwitchField, { name: 'isFeatured', labels: { checked: 'yes' } })
    h(DitoSection, { name: 'address', label: 'Address', collapsible: true })
    h(DitoSection, { label: 'More', collapsed: true })
    h(DitoTextareaField, { name: 'notes', lines: 4 })
    h(DitoSelectField, {
      name: 'author',
      options: { data: [{ id: 1, name: 'Ada' }], label: 'name' }
    })
    h(DitoCheckboxesField, { name: 'genres', layout: 'horizontal' })
    h(DitoMultiselectField, { name: 'genre', editable: true, view: 'genres' })
    h(DitoSelectField, { name: 'genre', editable: true, view: 'genres' })
    h(DitoDateField, { name: 'day', format: { date: { day: '2-digit' } } })
    h(DitoTimeField, { name: 'opensAt' })
    h(DitoDateTimeField, { name: 'meetsAt' })
    h(DitoUploadField, { name: 'images', accept: 'image/*' })
  })

  it('lay out the items of lists and objects in their slots', () => {
    type Slot = InstanceType<typeof DitoListField>['$slots']['default']
    // The slots receive the context of the item:
    expectTypeOf<Parameters<Slot>[0]>().toEqualTypeOf<SchemaContext>()
    h(DitoListField, { name: 'awards', creatable: true, draggable: true })
    h(DitoListField, { name: 'awards', itemLabel: ({ item }) => item.title })
    h(DitoListField, { name: 'awards', itemLabel: 'title' })
    h(DitoObjectField, { name: 'address', collapsible: true })
    // Widgets without `name` edit the items of lists of values:
    h(DitoNumberField, { step: 5 })
  })

  it('emit changes with the context of the field', () => {
    h(DitoSelectField, {
      name: 'format',
      onChange: context => {
        expectTypeOf(context.value).toBeAny()
      }
    })
  })

  it('pass the field to the slot of custom fields', () => {
    type Slot = InstanceType<typeof DitoCustomField>['$slots']['default']
    type Field = Parameters<Slot>[0]
    expectTypeOf<Field['value']>().toBeAny()
    expectTypeOf<Field['errors']>().toEqualTypeOf<
      { message: string }[] | null
    >()
    expectTypeOf<Field['property']>().toEqualTypeOf<Record<string, any>>()
    expectTypeOf<Field['validate']>().toEqualTypeOf<() => boolean>()
    h(DitoCustomField, { name: 'code' })
  })

  it('reject the data keywords of their property', () => {
    // @ts-expect-error: `required` is the property's.
    h(DitoTextField, { name: 'name', required: true })
    // @ts-expect-error: Limits are the property's.
    h(DitoNumberField, { name: 'rank', minimum: 1 })
    // @ts-expect-error: Defaults are the property's.
    h(DitoSwitchField, { name: 'isFeatured', default: false })
    // @ts-expect-error: Options come from the `enum` of the property.
    h(DitoSelectField, { name: 'format', enum: ['a', 'b'] })
    // @ts-expect-error: Relations are the property's.
    h(DitoSelectField, { name: 'author', relate: true })
    // @ts-expect-error: Lists need the name of their property.
    h(DitoListField, { label: 'Awards' })
  })
})
