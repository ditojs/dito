import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { Form, View } from '../index.d.ts'
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

  it('accepts view with single list component and Form variable', () => {
    const entryForm: Form<Entry> = {
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
    const promisedForm: Promise<Record<string, Form<Entry>>> = Promise.resolve({
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
          format({ item }) {
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
      events: {
        open({ item, open }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.title).toBeString()
          expectTypeOf(open).toBeBoolean()
        },
        change({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.id).toBeNumber()
        }
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
