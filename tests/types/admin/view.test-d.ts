import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { FormSchema, View } from '@ditojs/admin'
import type { Entry } from './fixtures.ts'

describe('View with list component', () => {
  it('accepts view with single list component and inline form', () => {
    const view: View<Entry> = {
      type: 'view',
      component: {
        type: 'list',
        itemLabel: 'title',
        form: {
          type: 'form',
          components: {
            title: { type: 'text' }
          }
        }
      }
    }
  })

  it('accepts view with single list component and FormSchema variable', () => {
    const entryForm: FormSchema<Entry> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }

    const view: View<Entry> = {
      type: 'view',
      component: {
        type: 'list',
        itemLabel: 'title',
        form: entryForm
      }
    }
  })

  it('accepts view with single list component and promised form', () => {
    const promisedForm: Promise<Record<string, FormSchema<Entry>>> =
      Promise.resolve({
        entryForm: { type: 'form', components: {} }
      })

    const view: View<Entry> = {
      type: 'view',
      component: {
        type: 'list',
        itemLabel: 'title',
        form: promisedForm
      }
    }
  })

  it('accepts view with components map', () => {
    const view: View<Entry> = {
      type: 'view',
      components: {
        title: {
          type: 'text',
          formatValue({ item }) {
            expectTypeOf(item).not.toBeAny()
            expectTypeOf(item.title).toBeString()
          }
        }
      }
    }
  })
})

describe('View tabs and events', () => {
  it('accepts tabs on a view', () => {
    const view: View<Entry> = {
      type: 'view',
      tabs: {
        overview: {
          type: 'tab',
          label: 'Overview'
        },
        details: {
          type: 'tab',
          label: 'Details',
          defaultTab: true
        }
      }
    }
  })

  it('accepts events on a view', () => {
    const view: View<Entry> = {
      type: 'view',
      onChange({ item }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.id).toBeNumber()
      },
      // `input` bubbles to views and forms like `change`:
      onInput({ item }) {
        expectTypeOf(item.id).toBeNumber()
      }
    }
  })

  it('rejects `resource`, which views never load', () => {
    const view: View<Entry> = {
      type: 'view',
      // @ts-expect-error Views have no resource.
      resource: 'entries'
    }
  })

  it('accepts onToggle() on inlined forms, not on views and lists', () => {
    const view: View<Entry> = {
      type: 'view',
      component: {
        type: 'list',
        inlined: true,
        form: {
          type: 'form',
          onToggle({ item, collapsed }) {
            expectTypeOf(item).not.toBeAny()
            expectTypeOf(item.title).toBeString()
            expectTypeOf(collapsed).toBeBoolean()
          }
        }
      }
    }
    const invalidView: View<Entry> = {
      type: 'view',
      // @ts-expect-error: Views don't fire `toggle`.
      onToggle() {}
    }
    const invalidList: View<Entry> = {
      type: 'view',
      component: {
        type: 'list',
        // @ts-expect-error: Lists don't fire `toggle`.
        onToggle() {}
      }
    }
  })
})

describe('List filters', () => {
  it('accepts filter with custom components using arbitrary keys', () => {
    const view: View<Entry> = {
      type: 'view',
      component: {
        type: 'list',
        filters: {
          title: {
            filter: 'text',
            operators: ['contains', 'equals']
          },
          author: {
            filter: 'text',
            operators: true
          },
          createdAt: {
            filter: 'date-range'
          },
          status: {
            components: {
              pattern: {
                type: 'select',
                options: ['active', 'inactive']
              }
            }
          }
        }
      }
    }
  })

  it('accepts boolean and sticky filters', () => {
    const view: View<Entry> = {
      type: 'view',
      component: {
        type: 'list',
        filters: {
          sticky: true,
          title: true
        }
      }
    }
  })
})
