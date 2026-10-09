import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  DitoContext,
  OrItemAccessor,
  PanelSchema,
  SchemaByType
} from '@ditojs/admin'
import type { Entry, ParentWithMarkers } from './fixtures.ts'

describe('DitoContext', () => {
  it('item strips never keys', () => {
    type Ctx = DitoContext<ParentWithMarkers>
    expectTypeOf<Ctx['item']>().not.toBeAny()
    expectTypeOf<Ctx['item']>().toHaveProperty('id')
    expectTypeOf<Ctx['item']>().toHaveProperty('title')
    expectTypeOf<Ctx['item']>().toHaveProperty('entries')
    expectTypeOf<Ctx['item']>().not.toHaveProperty('viewButton')
    expectTypeOf<Ctx['item']>().not.toHaveProperty('spacer')
  })

  it('item preserves data keys', () => {
    type Ctx = DitoContext<Entry>
    expectTypeOf<Ctx['item']>().not.toBeAny()
    expectTypeOf<Ctx['item']>().toEqualTypeOf<{
      id: number
      title: string
    }>()
  })

  it('user is null when logged out', () => {
    type Ctx = DitoContext<Entry>
    expectTypeOf<null>().toExtend<Ctx['user']>()
    expectTypeOf<NonNullable<Ctx['user']>['hasRole']>().returns.toBeBoolean()
  })

  it('parentItemDataPath is null for root items', () => {
    type Ctx = DitoContext<Entry>
    expectTypeOf<Ctx['parentItemDataPath']>().toEqualTypeOf<string | null>()
  })

  it('OrItemAccessor accepts value or callback', () => {
    assertType<OrItemAccessor<Entry, {}, string>>('hello')
    assertType<OrItemAccessor<Entry, {}, string>>(
      (ctx: DitoContext<Entry>) => ctx.item.title
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
