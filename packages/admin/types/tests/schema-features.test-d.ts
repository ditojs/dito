import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  Form,
  Components,
  PanelSchema,
  UploadSchema,
  DitoComponentInstance,
  HiddenSchema
} from '../index.d.ts'
import type { Entry, Parent } from './fixtures.ts'

describe('SchemaFields: methods', () => {
  it('methods have `this` typed as component instance', () => {
    assertType<Form<Entry>>({
      type: 'form',
      components: {
        title: { type: 'text' }
      },
      methods: {
        greet() {
          expectTypeOf(this).not.toBeAny()
          expectTypeOf(this).toEqualTypeOf<
            DitoComponentInstance<Entry>
          >()
          expectTypeOf(this.item).not.toBeAny()
          expectTypeOf(this.item.title).toBeString()
          expectTypeOf(this.item.id).toBeNumber()
        },
        getTitle() {
          return this.item.title
        }
      }
    })
  })
})

describe('SchemaFields: computed', () => {
  it('computed getter uses `this` typing', () => {
    assertType<Form<Entry>>({
      type: 'form',
      components: {
        title: { type: 'text' }
      },
      computed: {
        upperTitle() {
          expectTypeOf(this).not.toBeAny()
          expectTypeOf(this.item).not.toBeAny()
          expectTypeOf(this.item.title).toBeString()
          return this.item.title.toUpperCase()
        }
      }
    })
  })

  it('computed getter/setter object uses `this` typing', () => {
    assertType<Form<Entry>>({
      type: 'form',
      components: {
        title: { type: 'text' }
      },
      computed: {
        upperTitle: {
          get() {
            expectTypeOf(this).not.toBeAny()
            expectTypeOf(this.item).not.toBeAny()
            expectTypeOf(this.item.title).toBeString()
            return this.item.title.toUpperCase()
          },
          set(_value) {
            expectTypeOf(this).not.toBeAny()
            expectTypeOf(this.item.id).toBeNumber()
          }
        }
      }
    })
  })
})

describe('SchemaFields: watch', () => {
  it('watch with plain handler function', () => {
    assertType<Form<Entry>>({
      type: 'form',
      components: {
        title: { type: 'text' }
      },
      watch: {
        title(value, oldValue) {
          expectTypeOf(this).not.toBeAny()
          expectTypeOf(this.item).not.toBeAny()
          expectTypeOf(this.item.title).toBeString()
          expectTypeOf(value).toBeAny()
          expectTypeOf(oldValue).toBeAny()
        }
      }
    })
  })

  it('watch with object containing deep and immediate', () => {
    assertType<Form<Entry>>({
      type: 'form',
      components: {
        title: { type: 'text' }
      },
      watch: {
        title: {
          handler(value, oldValue) {
            expectTypeOf(this).not.toBeAny()
            expectTypeOf(this.item).not.toBeAny()
            expectTypeOf(this.item.title).toBeString()
            expectTypeOf(value).toBeAny()
            expectTypeOf(oldValue).toBeAny()
          },
          deep: true,
          immediate: true
        }
      }
    })
  })

  it('watch as factory function returning handlers', () => {
    assertType<Form<Entry>>({
      type: 'form',
      components: {
        title: { type: 'text' }
      },
      watch() {
        expectTypeOf(this).not.toBeAny()
        expectTypeOf(this.item).not.toBeAny()
        expectTypeOf(this.item.title).toBeString()
        return {
          title(value) {
            expectTypeOf(this).not.toBeAny()
            expectTypeOf(this.item).not.toBeAny()
            expectTypeOf(this.item.id).toBeNumber()
          }
        }
      }
    })
  })
})

describe('SchemaFields: panels', () => {
  it('form with panels containing components and buttons', () => {
    assertType<Form<Entry>>({
      type: 'form',
      components: {
        title: { type: 'text' }
      },
      panels: {
        sidebar: {
          type: 'panel',
          label: 'Sidebar',
          components: {
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

describe('SchemaFields: lifecycle callbacks', () => {
  it('onInitialize and onChange receive typed context', () => {
    assertType<Form<Entry>>({
      type: 'form',
      components: {
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

describe('SchemaTypeMixin: parse and process callbacks', () => {
  it('parse callback receives typed item', () => {
    assertType<Components<Parent>>({
      title: {
        type: 'text',
        parse({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.title).toBeString()
          expectTypeOf(item.entries).toEqualTypeOf<Entry[]>()
        }
      }
    })
  })

  it('process callback receives typed item', () => {
    assertType<Components<Parent>>({
      title: {
        type: 'text',
        process({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.title).toBeString()
          return item.title.trim()
        }
      }
    })
  })
})

describe('SchemaDataMixin: data callback', () => {
  it('data callback receives typed item on HiddenSchema', () => {
    assertType<HiddenSchema<Entry>>({
      type: 'hidden',
      data({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.title).toBeString()
        expectTypeOf(item.id).toBeNumber()
        return { computed: item.title }
      }
    })
  })
})

describe('UploadSchema', () => {
  it('accepts multiple, extensions, accept, and maxSize', () => {
    assertType<Components<Parent>>({
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
    assertType<Components<Parent>>({
      entries: {
        type: 'upload',
        extensions: /\.(gif|jpe?g|png)$/i
      }
    })
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
  it('accepts arbitrary component keys in panels', () => {
    assertType<PanelSchema<Entry>>({
      type: 'panel',
      components: {
        title: { type: 'text' },
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
          events: {
            click({ item }) {
              expectTypeOf(item).not.toBeAny()
              expectTypeOf(item.title).toBeString()
            }
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

  it('component callbacks in panels receive typed item', () => {
    assertType<PanelSchema<Parent>>({
      type: 'panel',
      components: {
        title: {
          type: 'text',
          format({ item }) {
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

  it('panels on Form inherit item type', () => {
    assertType<Form<Parent>>({
      type: 'form',
      components: {
        title: { type: 'text' }
      },
      panels: {
        info: {
          type: 'panel',
          components: {
            status: {
              type: 'text',
              format({ item }) {
                expectTypeOf(item).not.toBeAny()
                expectTypeOf(item.title).toBeString()
                return ''
              }
            }
          },
          buttons: {
            save: {
              text: 'Save',
              events: {
                click({ item }) {
                  expectTypeOf(item).not.toBeAny()
                  expectTypeOf(item.id).toBeNumber()
                }
              }
            }
          }
        }
      }
    })
  })
})
