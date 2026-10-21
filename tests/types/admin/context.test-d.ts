import { expectTypeOf, assertType, describe, it } from 'vitest'
import { useDitoContext } from '@ditojs/admin'
import type {
  SchemaContext,
  SchemaValue,
  SchemaValueCallback,
  SchemaBase,
  FieldSchemaBase,
  Field,
  Fields,
  SourceField,
  RouteSchemaBase,
  FormSchema,
  PanelSchema,
  SchemaByType,
  GlobalConfig,
  SourceSettings,
  SelectionSettings,
  NumberSettings,
  TextSettings,
  AffixSettings,
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
    expectTypeOf<Ctx['getErrors']>()
      .parameter(0)
      .toEqualTypeOf<Parameters<Ctx['validate']>[0]>()
    expectTypeOf<Ctx['getErrors']>().returns.toEqualTypeOf<Record<
      string,
      { message: string; keyword?: string; params?: Record<string, any> }[]
    > | null>()
    expectTypeOf<Ctx['resetItem']>().returns.toEqualTypeOf<Entry>()
    expectTypeOf<Ctx['resetItem']>().toBeCallableWith()
    expectTypeOf<Ctx['closeForm']>().returns.toEqualTypeOf<Promise<boolean>>()
    expectTypeOf<Ctx['reload']>().returns.toEqualTypeOf<Promise<void>>()
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
    assertType(context.request({ url: '/api/pages', abortOnUnmount: true }))
    // @ts-expect-error A request needs a url or a resource.
    assertType(context.request({ method: 'get' }))
  })

  it('reads values relative to the item', () => {
    const context = {} as SchemaContext<Entry>
    expectTypeOf(context.getValueAt('../../font')).toBeAny()
    expectTypeOf(context.getValueAt<string>('../title')).toBeString()
    // @ts-expect-error Data paths are strings.
    context.getValueAt(['..', 'title'])
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
        fields: { title: { type: 'text' } },
        buttons: { cancel: {}, apply: { type: 'submit' } },
        data: { title: 'Emma' },
        settings: {
          label: 'Rename',
          width: 400,
          clickToClose: true,
          minDuration: 1000
        }
      })
    ).toEqualTypeOf<Promise<unknown>>()
    expectTypeOf(
      context.showDialog<{ title: string }>({ buttons: {} })
    ).toEqualTypeOf<Promise<{ title: string } | undefined>>()
    assertType(
      // @ts-expect-error Dialogs have no other settings.
      context.showDialog({ buttons: {}, settings: { height: 300 } })
    )
    assertType(
      // @ts-expect-error The data and settings are part of the options.
      context.showDialog({ fields: {}, buttons: {} }, { data: {} })
    )
    assertType(
      // @ts-expect-error Dialogs need their buttons.
      context.showDialog({ fields: {} })
    )
  })

  it('asks for confirmations with the text of the action', () => {
    const context = {} as SchemaContext<Entry>
    expectTypeOf(
      context.confirm('Delete Dune?', { action: 'Delete' })
    ).toEqualTypeOf<Promise<boolean>>()
    expectTypeOf(context.confirm('Proceed?')).toEqualTypeOf<Promise<boolean>>()
    assertType(
      // @ts-expect-error The message is the first argument.
      context.confirm({ message: 'Delete Dune?' })
    )
    assertType(
      // @ts-expect-error Confirmations have no other options.
      context.confirm('Delete Dune?', { verb: 'delete' })
    )
  })

  it('asks for values of the field type', () => {
    const context = {} as SchemaContext<Entry>
    expectTypeOf(context.prompt('Title:')).toEqualTypeOf<Promise<unknown>>()
    expectTypeOf(
      context.prompt('Copies:', { action: 'Order', value: 1, type: 'integer' })
    ).toEqualTypeOf<Promise<number | undefined>>()
    expectTypeOf(
      context.prompt<string>('Email:', { type: 'email' })
    ).toEqualTypeOf<Promise<string | undefined>>()
    assertType(
      // @ts-expect-error Prompts have no other options.
      context.prompt('Title:', { required: true })
    )
  })

  it('shows alerts with the text of the action', () => {
    const context = {} as SchemaContext<Entry>
    expectTypeOf(
      context.alert('Dune was sold.', { action: 'Close' })
    ).toEqualTypeOf<Promise<void>>()
    expectTypeOf(context.alert('Dune was sold.')).toEqualTypeOf<Promise<void>>()
    assertType(
      // @ts-expect-error Alerts have no other options.
      context.alert('Dune was sold.', { value: true })
    )
  })

  it('SchemaValue accepts value or callback', () => {
    assertType<SchemaValue<Entry, {}, string>>('hello')
    assertType<SchemaValue<Entry, {}, string>>(
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

describe('useDitoContext()', () => {
  it('types the context with the item', () => {
    const context = useDitoContext<Entry>()
    expectTypeOf(context).toEqualTypeOf<SchemaContext<Entry>>()
    expectTypeOf(context.item.title).toBeString()
  })
})
