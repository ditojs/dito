import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  ApiConfig,
  Components,
  FormSchema,
  ListSchema,
  MultiselectSchema,
  PanelSchema,
  Resource,
  SchemaContext,
  SectionSchema,
  ViewSchema
} from '@ditojs/admin'
import type { Entry, Parent } from './fixtures.ts'

describe('SchemaContext', () => {
  it('is read-only, except `isRunning`', () => {
    const context = {} as SchemaContext<Entry>
    // @ts-expect-error - contexts only hand out their values
    context.item = { id: 1, title: 'Emma' }
    context.isRunning = false
    expectTypeOf(context.searchTerm).toEqualTypeOf<string | undefined>()
    expectTypeOf(context.user!.username).toBeAny()
    context.download({ url: '/export', query: { format: 'csv' } })
    context.request({ url: '/books', signal: new AbortController().signal })
  })
})

describe('component options', () => {
  it('accepts labels with affixes', () => {
    assertType<Components<Entry>>({
      title: { type: 'text', label: { text: 'Title', suffix: 'required' } }
    })
  })

  it('accepts the width operators and CSS units', () => {
    assertType<Components<Entry>>({
      title: { type: 'text', width: '>50%' },
      id: { type: 'number', width: '120px' }
    })
  })

  it('only accepts boolean placeholders in multiselects', () => {
    assertType<Components<Entry>>({
      // @ts-expect-error - text fields only display strings
      title: { type: 'text', placeholder: false }
    })
    assertType<MultiselectSchema<Entry>>({
      type: 'multiselect',
      placeholder: false
    })
  })

  it('only accepts searches in multiselects', () => {
    assertType<Components<Entry>>({
      // @ts-expect-error - only multiselects search their options
      title: { type: 'select', search: () => [] }
    })
  })

  it('takes plain values for options that are read raw', () => {
    assertType<Components<Entry>>({
      // @ts-expect-error - `trim` isn't a callback
      title: { type: 'text', trim: () => true }
    })
    assertType<Components<Parent>>({
      // @ts-expect-error - `inlined` isn't a callback
      entries: { type: 'list', inlined: () => true }
    })
    assertType<PanelSchema<Entry>>({
      type: 'panel',
      // @ts-expect-error - panels read `disabled` raw
      disabled: () => true
    })
  })

  it('types the data of data schemas as values or loaders', () => {
    assertType<Components<Entry>>({
      title: {
        type: 'value',
        data:
          ({ item }) =>
          () =>
            item.title
      }
    })
  })
})

describe('lists and forms', () => {
  it('accepts the options of the inlined form of `components`', () => {
    assertType<ListSchema<Parent>>({
      type: 'list',
      components: { title: { type: 'text' } },
      compact: true,
      clipboard: true,
      tabs: { main: { type: 'tab', components: {} } }
    })
  })

  it('takes booleans for `editable` and `deletable` of lists', () => {
    assertType<ListSchema<Parent>>({
      type: 'list',
      // @ts-expect-error - their buttons have no labels of their own
      editable: { label: 'Open' }
    })
  })

  it('accepts the item options of forms', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      creatable: false,
      editable: ({ item }) => item.id > 0,
      deletable: false,
      draggable: false
    })
    assertType<FormSchema<Entry>>({
      type: 'form',
      // @ts-expect-error - `idKey` belongs to the list or object
      idKey: 'uid'
    })
  })

  it('accepts `nested` on panels', () => {
    assertType<PanelSchema<Entry>>({ type: 'panel', nested: true })
  })

  it('accepts resources as functions', () => {
    assertType<Resource>(({ method }) => ({ path: 'items', method }))
  })

  it('accepts the widths of filters', () => {
    assertType<ListSchema<Parent>>({
      type: 'list',
      filters: { title: { filter: 'text', width: '1/2' } }
    })
  })
})

describe('events', () => {
  it('only types lifecycle events where they fire', () => {
    assertType<Components<Entry>>({
      // @ts-expect-error - fields don't initialize
      title: { type: 'text', onInitialize() {} }
    })
    assertType<SectionSchema<Entry>>({
      type: 'section',
      onInitialize() {},
      onDestroy() {}
    })
    // Lists fire `load` on the schema around them:
    // @ts-expect-error - lists don't load themselves
    assertType<ListSchema<Parent>>({ type: 'list', onLoad() {} })
    assertType<FormSchema<Entry>>({ type: 'form', onLoad() {} })
    assertType<SectionSchema<Entry>>({ type: 'section', onLoad() {} })
    assertType<PanelSchema<Entry>>({ type: 'panel', onLoad() {} })
    assertType<ViewSchema<Entry>>({ type: 'view', onInitialize() {} })
  })

  it('types the clicks that bubble from buttons', () => {
    assertType<FormSchema<Entry>>({ type: 'form', onClick() {} })
    assertType<ViewSchema<Entry>>({ type: 'view', onClick() {} })
    assertType<SectionSchema<Entry>>({ type: 'section', onClick() {} })
  })

  it('accepts view labels as callbacks', () => {
    assertType<ViewSchema<Entry>>({ type: 'view', label: () => 'Entries' })
  })

  it('passes forms and views to the callbacks of `api.defaults`', () => {
    assertType<ApiConfig['defaults']>({
      form: schema => ({ compact: schema.type === 'form' }),
      view: schema => ({ wide: schema.type === 'view' })
    })
  })
})
