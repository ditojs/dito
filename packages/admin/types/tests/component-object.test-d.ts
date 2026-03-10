import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  ObjectSchema,
  TreeListSchema,
  Form,
  Components
} from '../index.d.ts'
import type { Address, Entry, ParentWithAddress } from './fixtures.ts'

describe('ObjectSchema', () => {
  it('accepts typed form', () => {
    assertType<ObjectSchema<Address>>({
      type: 'object',
      form: {
        type: 'form',
        components: {
          street: { type: 'text' },
          city: { type: 'text' }
        }
      } satisfies Form<Address>
    })
  })

  it('accepts typed columns', () => {
    assertType<ObjectSchema<Address>>({
      type: 'object',
      columns: {
        street: { label: 'Street' },
        city: { label: 'City' }
      }
    })
  })

  it('rejects unknown key in columns array', () => {
    assertType<ObjectSchema<Address>>({
      type: 'object',
      // @ts-expect-error 'zipCode' is not a key of Address
      columns: ['street', 'zipCode']
    })
  })

  it('works inside Components for a data key', () => {
    assertType<Components<ParentWithAddress>>({
      address: {
        type: 'object',
        form: {
          type: 'form',
          components: {
            title: { type: 'text' }
          }
        } satisfies Form<ParentWithAddress>
      }
    })
  })
})

describe('TreeListSchema', () => {
  it('accepts typed form', () => {
    assertType<TreeListSchema<Entry>>({
      type: 'tree-list',
      form: {
        type: 'form',
        components: {
          title: { type: 'text' }
        }
      } satisfies Form<Entry>
    })
  })
})
