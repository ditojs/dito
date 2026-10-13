import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  SchemaContext,
  SchemaValue,
  SchemaValueCallback,
  SchemaBase,
  ComponentSchemaBase,
  RouteSchemaBase,
  OrItemAccessor,
  ItemAccessor,
  SchemaFields,
  SchemaSetupMixin,
  BaseSchema,
  SchemaRoute,
  SchemaRouteMixin,
  Form,
  FormSchema,
  PanelSchema,
  SchemaByType,
  DitoContext,
  DitoGlobal,
  GlobalConfig,
  SchemaSourceMixin,
  SourceSettings,
  SchemaOptionsMixin,
  SelectionSettings,
  SchemaNumberMixin,
  NumberSettings,
  SchemaTextMixin,
  TextSettings,
  SchemaAffixMixin,
  AffixSettings,
  SchemaDataMixin,
  DataSettings
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
    expectTypeOf<Ctx['clearErrors']>().returns.toBeVoid()
    expectTypeOf<Ctx['clearErrors']>()
      .parameter(0)
      .toEqualTypeOf<Parameters<Ctx['validate']>[0]>()
    expectTypeOf<Ctx['resetItem']>().returns.toEqualTypeOf<Entry>()
    expectTypeOf<Ctx['resetItem']>().toBeCallableWith()
    expectTypeOf<Ctx['closeForm']>().returns.toEqualTypeOf<Promise<boolean>>()
    expectTypeOf<Ctx['navigate']>().returns.toEqualTypeOf<Promise<boolean>>()
    expectTypeOf<Ctx['navigate']>().toBeCallableWith({ path: '/items' })
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

  it('shows dialogs with their schema, data and settings', () => {
    const context = {} as SchemaContext<Entry>
    expectTypeOf(
      context.showDialog({
        components: { title: { type: 'text' } },
        buttons: { cancel: {}, apply: { type: 'submit' } },
        data: { title: 'Emma' },
        settings: { label: 'Rename', width: 400, clickToClose: true }
      })
    ).toEqualTypeOf<Promise<unknown>>()
    assertType(
      // @ts-expect-error Dialogs have no other settings.
      context.showDialog({ buttons: {}, settings: { height: 300 } })
    )
    assertType(
      // @ts-expect-error The data and settings are part of the options.
      context.showDialog({ components: {}, buttons: {} }, { data: {} })
    )
    assertType(
      // @ts-expect-error Dialogs need their buttons.
      context.showDialog({ components: {} })
    )
  })

  it('SchemaValue accepts value or callback', () => {
    assertType<SchemaValue<Entry, {}, string>>('hello')
    assertType<SchemaValue<Entry, {}, string>>(
      (ctx: SchemaContext<Entry>) => ctx.item.title
    )
  })

  it('keeps the deprecated names of the schema types', () => {
    expectTypeOf<OrItemAccessor<Entry, {}, string>>().toEqualTypeOf<
      SchemaValue<Entry, {}, string>
    >()
    expectTypeOf<ItemAccessor<Entry>>().toEqualTypeOf<
      SchemaValueCallback<Entry>
    >()
    expectTypeOf<SchemaFields<Entry>>().toEqualTypeOf<SchemaBase<Entry>>()
    expectTypeOf<SchemaSetupMixin<Entry>>().toEqualTypeOf<SchemaBase<Entry>>()
    expectTypeOf<BaseSchema<Entry>>().toEqualTypeOf<
      ComponentSchemaBase<Entry>
    >()
    expectTypeOf<SchemaRoute<Entry>>().toEqualTypeOf<RouteSchemaBase<Entry>>()
    expectTypeOf<SchemaRouteMixin<Entry>>().toEqualTypeOf<
      RouteSchemaBase<Entry>
    >()
    expectTypeOf<Form<Entry>>().toEqualTypeOf<FormSchema<Entry>>()
  })

  it('keeps the deprecated names of the context, config and settings', () => {
    expectTypeOf<DitoContext<Entry>>().toEqualTypeOf<SchemaContext<Entry>>()
    expectTypeOf<DitoGlobal>().toEqualTypeOf<GlobalConfig>()
    expectTypeOf<SchemaSourceMixin<Entry>>().toEqualTypeOf<
      SourceSettings<Entry>
    >()
    expectTypeOf<SchemaOptionsMixin<Entry, string>>().toEqualTypeOf<
      SelectionSettings<Entry, string>
    >()
    expectTypeOf<SchemaNumberMixin<Entry>>().toEqualTypeOf<
      NumberSettings<Entry>
    >()
    expectTypeOf<SchemaTextMixin<Entry>>().toEqualTypeOf<TextSettings<Entry>>()
    expectTypeOf<SchemaAffixMixin<Entry>>().toEqualTypeOf<
      AffixSettings<Entry>
    >()
    expectTypeOf<SchemaDataMixin<Entry>>().toEqualTypeOf<DataSettings<Entry>>()
  })
})

describe('SchemaByType', () => {
  it('maps panel to PanelSchema', () => {
    expectTypeOf<SchemaByType<Entry>['panel']>().toEqualTypeOf<
      PanelSchema<Entry>
    >()
  })
})
