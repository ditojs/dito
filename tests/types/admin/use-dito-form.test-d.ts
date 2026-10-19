import { assertType, describe, expectTypeOf, it } from 'vitest'
import { ref } from 'vue'
import { useDitoForm, DitoSchemaForm } from '@ditojs/admin'
import type { DitoContext } from '@ditojs/admin'

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
    expectTypeOf(form).toEqualTypeOf<DitoContext<Product>>()
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

describe('DitoSchemaForm', () => {
  it('is a component', () => {
    assertType<object>(DitoSchemaForm)
  })
})
