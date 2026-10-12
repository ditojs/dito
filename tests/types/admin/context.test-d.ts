import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  SchemaContext,
  OrItemAccessor,
  PanelSchema,
  SchemaByType
} from '@ditojs/admin'
import type { Entry, ParentWithMarkers } from './fixtures.ts'

describe('SchemaContext', () => {
  it('item strips never keys', () => {
    type Ctx = SchemaContext<ParentWithMarkers>
    expectTypeOf<Ctx['item']>().not.toBeAny()
    expectTypeOf<Ctx['item']>().toHaveProperty('id')
    expectTypeOf<Ctx['item']>().toHaveProperty('title')
    expectTypeOf<Ctx['item']>().toHaveProperty('entries')
    expectTypeOf<Ctx['item']>().not.toHaveProperty('viewButton')
    expectTypeOf<Ctx['item']>().not.toHaveProperty('spacer')
  })

  it('item preserves data keys', () => {
    type Ctx = SchemaContext<Entry>
    expectTypeOf<Ctx['item']>().not.toBeAny()
    expectTypeOf<Ctx['item']>().toEqualTypeOf<{
      id: number
      title: string
    }>()
  })

  it('user is null when logged out', () => {
    type Ctx = SchemaContext<Entry>
    expectTypeOf<null>().toExtend<Ctx['user']>()
    expectTypeOf<NonNullable<Ctx['user']>['hasRole']>().returns.toBeBoolean()
  })

  it('parentItemDataPath is null for root items', () => {
    type Ctx = SchemaContext<Entry>
    expectTypeOf<Ctx['parentItemDataPath']>().toEqualTypeOf<string | null>()
  })

  it('offers the state of the data without components', () => {
    type Ctx = SchemaContext<Entry>
    expectTypeOf<Ctx['isDirty']>().toBeBoolean()
    expectTypeOf<Ctx['isCreating']>().toBeBoolean()
    expectTypeOf<Ctx['selectedTab']>().toEqualTypeOf<string | null>()
    expectTypeOf<Ctx['validate']>().returns.toBeBoolean()
    expectTypeOf<Ctx['replaceItem']>().returns.toEqualTypeOf<Entry>()
    expectTypeOf<Ctx['getResourceUrl']>().toBeCallableWith()
    expectTypeOf<Ctx['getResourceUrl']>().returns.toBeString()
    expectTypeOf<Ctx['listQuery']>().toExtend<Record<string, any> | null>()
    expectTypeOf<Ctx>().not.toHaveProperty('formComponent')
    expectTypeOf<Ctx>().not.toHaveProperty('component')
    expectTypeOf<Ctx>().not.toHaveProperty('query')
  })

  it('OrItemAccessor accepts value or callback', () => {
    assertType<OrItemAccessor<Entry, {}, string>>('hello')
    assertType<OrItemAccessor<Entry, {}, string>>(
      (ctx: SchemaContext<Entry>) => ctx.item.title
    )
  })
})

describe('SchemaByType', () => {
  it('maps panel to PanelSchema', () => {
    expectTypeOf<SchemaByType<Entry>['panel']>().toEqualTypeOf<
      PanelSchema<Entry>
    >()
  })
})
