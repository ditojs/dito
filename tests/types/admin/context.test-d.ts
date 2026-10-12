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
    expectTypeOf<Ctx['sourceQuery']>().toExtend<Record<string, any> | null>()
    expectTypeOf<Ctx>().not.toHaveProperty('formComponent')
    expectTypeOf<Ctx>().not.toHaveProperty('component')
    expectTypeOf<Ctx>().not.toHaveProperty('query')
  })

  it('resolves resource URLs and requests', () => {
    const context = {} as SchemaContext<Entry>
    expectTypeOf(context.getResourceUrl()).toBeString()
    expectTypeOf(context.getResourceUrl('pages')).toEqualTypeOf<
      string | null
    >()
    assertType(context.request({ resource: 'pages', cache: 'local' }))
    assertType(context.request({ url: '/api/pages' }))
    // @ts-expect-error A request needs a url or a resource.
    assertType(context.request({ method: 'get' }))
  })

  it('extends contexts with values', () => {
    const context = {} as SchemaContext<Entry>
    const extended = context.extend({ value: 1 })
    expectTypeOf(extended.value).toBeNumber()
    expectTypeOf(extended.item).toEqualTypeOf<Entry>()
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
