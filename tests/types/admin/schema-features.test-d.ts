import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  FormSchema,
  Fields,
  PanelSchema,
  UploadSchema,
  ValueSchema,
  ComputedSchema,
  DataSchema,
  HiddenSchema
} from '@ditojs/admin'
import type { Entry, Parent } from './fixtures.ts'

describe('SchemaBase: no component members', () => {
  it('rejects `methods`, `computed`, `watch` and `data`', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      fields: {
        title: { type: 'text' }
      },
      // @ts-expect-error — handlers receive their context instead
      methods: {}
    })
    assertType<FormSchema<Entry>>({
      type: 'form',
      // @ts-expect-error — handlers receive their context instead
      computed: {}
    })
    assertType<FormSchema<Entry>>({
      type: 'form',
      // @ts-expect-error — use `onChange` instead
      watch: {}
    })
    assertType<FormSchema<Entry>>({
      type: 'form',
      // @ts-expect-error — keep state in module scope instead
      data: {}
    })
  })

  it('passes the context members to handlers', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      fields: {
        title: { type: 'text' }
      },
      onChange(context) {
        const { dataPath, submit, isValid, valueIndex, itemIndex } = context
        expectTypeOf(dataPath).toBeString()
        expectTypeOf(valueIndex).toEqualTypeOf<number | null>()
        expectTypeOf(itemIndex).toEqualTypeOf<number | null>()
        // @ts-expect-error `valueIndex` is the index of the value
        expectTypeOf(context.index)
        expectTypeOf(submit).returns.toEqualTypeOf<Promise<boolean>>()
        expectTypeOf(isValid(/^title/)).toBeBoolean()
      }
    })
  })
})

describe('SchemaBase: panels', () => {
  it('form with panels containing fields and buttons', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      fields: {
        title: { type: 'text' }
      },
      panels: {
        sidebar: {
          type: 'panel',
          label: 'Sidebar',
          fields: {
            id: { type: 'number' }
          },
          buttons: {
            save: { text: 'Save' }
          },
          panelButtons: {
            refresh: { text: 'Refresh' }
          }
        }
      }
    })
  })
})

describe('SchemaBase: lifecycle callbacks', () => {
  it('onInitialize and onChange receive typed context', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      fields: {
        title: { type: 'text' }
      },
      onInitialize({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.title).toBeString()
        expectTypeOf(item.id).toBeNumber()
      },
      onChange({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.title).toBeString()
      }
    })
  })
})

describe('SchemaTypeMixin: parseValue and serializeValue callbacks', () => {
  it('parseValue callback receives typed item', () => {
    assertType<Fields<Parent>>({
      title: {
        type: 'text',
        parseValue({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.title).toBeString()
          expectTypeOf(item.entries).toEqualTypeOf<Entry[]>()
        }
      }
    })
  })

  it('serializeValue callback receives typed item', () => {
    assertType<Fields<Parent>>({
      title: {
        type: 'text',
        serializeValue({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.title).toBeString()
          return item.title.trim()
        }
      }
    })
  })
})

describe('SchemaDataMixin: data callback', () => {
  it('data callback receives typed item on ValueSchema', () => {
    assertType<ValueSchema<Entry>>({
      type: 'value',
      data({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.title).toBeString()
        expectTypeOf(item.id).toBeNumber()
        return { computed: item.title }
      }
    })
  })
})

describe('ValueSchema', () => {
  it('accepts the deprecated names of the type and its schema', () => {
    assertType<ValueSchema<Entry>>({ type: 'computed' })
    assertType<ValueSchema<Entry>>({ type: 'data', dataPath: 'title' })
    assertType<ValueSchema<Entry>>({ type: 'hidden', data: () => 42 })
    assertType<Fields<Entry>>({ title: { type: 'computed' } })
    expectTypeOf<ComputedSchema<Entry>>().toEqualTypeOf<ValueSchema<Entry>>()
    expectTypeOf<DataSchema<Entry>>().toEqualTypeOf<ValueSchema<Entry>>()
    expectTypeOf<HiddenSchema<Entry>>().toEqualTypeOf<ValueSchema<Entry>>()
  })
})

describe('UploadSchema', () => {
  it('accepts multiple, extensions, accept, and maxSize', () => {
    assertType<Fields<Parent>>({
      entries: {
        type: 'upload',
        multiple: true,
        extensions: ['jpg', 'png', 'gif'],
        accept: ['image/png', 'image/jpeg'],
        maxSize: '5mb'
      }
    })
  })

  it('accepts extensions as regex', () => {
    assertType<Fields<Parent>>({
      entries: {
        type: 'upload',
        extensions: /\.(gif|jpe?g|png)$/i
      }
    })
  })

  it('accepts clipboard', () => {
    assertType<UploadSchema<Entry>>({ type: 'upload', clipboard: true })
    assertType<UploadSchema<Entry>>({
      type: 'upload',
      clipboard: {
        copy: ({ clipboardItem }) => clipboardItem
      }
    })
  })

  it('accepts the sizes of thumbnails', () => {
    assertType<UploadSchema<Entry>>({ type: 'upload', thumbnails: 'small' })
    // @ts-expect-error - thumbnails come in three sizes
    assertType<UploadSchema<Entry>>({ type: 'upload', thumbnails: 'huge' })
  })

  it('accepts thumbnails and downloadUrl as callbacks', () => {
    assertType<UploadSchema<Entry>>({
      type: 'upload',
      thumbnails({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.title).toBeString()
        return true
      },
      downloadUrl({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.id).toBeNumber()
        return `/files/${item.id}`
      }
    })
  })

  it('accepts thumbnailUrl and render as callbacks', () => {
    assertType<UploadSchema<Entry>>({
      type: 'upload',
      thumbnailUrl({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.title).toBeString()
        return `/thumbs/${item.id}`
      },
      render({ item }) {
        expectTypeOf(item).not.toBeAny()
        return item.title
      }
    })
  })

  it('accepts draggable and deletable as callbacks', () => {
    assertType<UploadSchema<Entry>>({
      type: 'upload',
      draggable({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.id).toBeNumber()
        return true
      },
      deletable({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.title).toBeString()
        return false
      }
    })
  })
})

describe('PanelSchema', () => {
  it('constrains field keys to item properties', () => {
    assertType<PanelSchema<Entry>>({
      type: 'panel',
      fields: {
        id: { type: 'number' },
        title: { type: 'text' }
      }
    })
  })

  it('rejects unknown field keys', () => {
    assertType<PanelSchema<Entry>>({
      type: 'panel',
      fields: {
        // @ts-expect-error — 'extra' is not a key of Entry
        extra: { type: 'text' }
      }
    })
  })

  it('accepts buttons and panelButtons', () => {
    assertType<PanelSchema<Entry>>({
      type: 'panel',
      buttons: {
        save: {
          text: 'Save',
          onClick({ item }) {
            expectTypeOf(item).not.toBeAny()
            expectTypeOf(item.title).toBeString()
          }
        }
      },
      panelButtons: {
        refresh: { text: 'Refresh' }
      }
    })
  })

  it('accepts sticky as callback', () => {
    assertType<PanelSchema<Entry>>({
      type: 'panel',
      sticky({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.id).toBeNumber()
        return true
      }
    })
  })

  it('field callbacks in panels receive typed item', () => {
    assertType<PanelSchema<Parent>>({
      type: 'panel',
      fields: {
        title: {
          type: 'text',
          formatValue({ item }) {
            expectTypeOf(item).not.toBeAny()
            expectTypeOf(item.title).toBeString()
            expectTypeOf(item.entries)
              .toEqualTypeOf<Entry[]>()
            return ''
          }
        }
      }
    })
  })

  it('panels on FormSchema inherit item type', () => {
    assertType<FormSchema<Parent>>({
      type: 'form',
      fields: {
        title: { type: 'text' }
      },
      panels: {
        info: {
          type: 'panel',
          fields: {
            title: {
              type: 'text',
              formatValue({ item }) {
                expectTypeOf(item).not.toBeAny()
                expectTypeOf(item.title).toBeString()
                return ''
              }
            }
          },
          buttons: {
            save: {
              text: 'Save',
              onClick({ item }) {
                expectTypeOf(item).not.toBeAny()
                expectTypeOf(item.id).toBeNumber()
              }
            }
          }
        }
      }
    })
  })
})
