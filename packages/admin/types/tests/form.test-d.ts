import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { Form, ResolvableForm } from '../index.d.ts'
import type { Entry, Parent } from './fixtures.ts'

describe('Form assignability', () => {
  it('Form<Specific> is assignable to Form<any>', () => {
    const specific: Form<Entry> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }
    assertType<Form<any>>(specific)
  })

  it('Form<Specific> is assignable to ResolvableForm', () => {
    const specific: Form<Entry> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }
    assertType<ResolvableForm>(specific)
  })

  it('Record<string, Form<$Item>> is assignable to ResolvableForm<$Item>', () => {
    const module: Record<string, Form<Entry>> = {
      entryForm: { type: 'form', components: {} }
    }
    assertType<ResolvableForm<Entry>>(module)
  })

  it('Record<string, Form<WrongType>> is not assignable to ResolvableForm<$Item>', () => {
    const module: Record<string, Form<Parent>> = {
      parentForm: { type: 'form', components: {} }
    }
    // @ts-expect-error Form<Parent> should not be assignable to ResolvableForm<Entry>
    assertType<ResolvableForm<Entry>>(module)
  })

  it('() => import() pattern is assignable to ResolvableForm', () => {
    const importForm = () =>
      Promise.resolve({
        default: { type: 'form', components: {} } as Form<Entry>
      })
    assertType<ResolvableForm<Entry>>(importForm)
  })

  it('accepts event callbacks with typed item', () => {
    assertType<Form<Entry>>({
      type: 'form',
      events: {
        create({ item }) {
          expectTypeOf(item.title).toBeString()
        },
        submit({ item }) {
          expectTypeOf(item.id).toBeNumber()
        },
        error({ item, error }) {
          expectTypeOf(item.title).toBeString()
          expectTypeOf(error).toEqualTypeOf<Error>()
        }
      }
    })
  })

  it('accepts onCreate/onSubmit/onError top-level callbacks', () => {
    assertType<Form<Entry>>({
      type: 'form',
      onCreate({ item }) {
        expectTypeOf(item.title).toBeString()
      },
      onSubmit({ item }) {
        expectTypeOf(item.id).toBeNumber()
      },
      onError({ item, error }) {
        expectTypeOf(error).toEqualTypeOf<Error>()
      }
    })
  })

  it('typed Form variable used as form prop in list component', () => {
    const childForm: Form<Entry> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }

    const parentForm: Form<Parent> = {
      type: 'form',
      components: {
        title: { type: 'text' },
        entries: {
          type: 'list',
          form: childForm
        }
      }
    }
  })
})
