import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { FormSchema, ResolvableForm } from '@ditojs/admin'
import type { Entry, Parent } from './fixtures.ts'

describe('FormSchema assignability', () => {
  it('FormSchema<Specific> is assignable to FormSchema<any>', () => {
    const specific: FormSchema<Entry> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }
    assertType<FormSchema<any>>(specific)
  })

  it('FormSchema<Specific> is assignable to ResolvableForm', () => {
    const specific: FormSchema<Entry> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }
    assertType<ResolvableForm>(specific)
  })

  it('Record<string, FormSchema<$Item>> is assignable to ResolvableForm<$Item>', () => {
    const module: Record<string, FormSchema<Entry>> = {
      entryForm: { type: 'form', components: {} }
    }
    assertType<ResolvableForm<Entry>>(module)
  })

  it('Record<string, FormSchema<WrongType>> is not assignable to ResolvableForm<$Item>', () => {
    const module: Record<string, FormSchema<Parent>> = {
      parentForm: { type: 'form', components: {} }
    }
    // @ts-expect-error FormSchema<Parent> isn't a ResolvableForm<Entry>
    assertType<ResolvableForm<Entry>>(module)
  })

  it('() => import() pattern is assignable to ResolvableForm', () => {
    const importForm = () =>
      Promise.resolve({
        default: { type: 'form', components: {} } as FormSchema<Entry>
      })
    assertType<ResolvableForm<Entry>>(importForm)
  })

  it('accepts the deprecated `events` with typed item', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      events: {
        error({ item, error }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.title).toBeString()
          expectTypeOf(error).toBeUnknown()
        }
      }
    })
  })

  it('accepts onSuccess with isCreating', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      onSuccess({ item, isCreating }) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item.title).toBeString()
        expectTypeOf(isCreating).toBeBoolean()
      }
    })
  })

  it('passes itemLabel to all form events', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      onLoad({ itemLabel }) {
        expectTypeOf(itemLabel).toEqualTypeOf<string | null>()
      },
      onError({ itemLabel }) {
        expectTypeOf(itemLabel).toEqualTypeOf<string | null>()
      },
      onCancel({ itemLabel }) {
        expectTypeOf(itemLabel).toEqualTypeOf<string | null>()
      }
    })
  })

  it('rejects the removed onCreate and onSubmit', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      // @ts-expect-error `onSuccess()` replaces `onCreate()`.
      onCreate() {}
    })
    assertType<FormSchema<Entry>>({
      type: 'form',
      // @ts-expect-error `onSuccess()` replaces `onSubmit()`.
      onSubmit() {}
    })
  })

  it('rejects `resource`, which forms load through their list', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      // @ts-expect-error Forms have no resource of their own.
      resource: 'entries'
    })
  })

  it('accepts the onError top-level callback', () => {
    assertType<FormSchema<Entry>>({
      type: 'form',
      onError({ item, error }) {
        expectTypeOf(item).not.toBeAny()
        // Errors of requests, handlers and transient forms can be anything:
        expectTypeOf(error).toBeUnknown()
      }
    })
  })

  it('typed FormSchema variable used as form prop in list component', () => {
    const childForm: FormSchema<Entry> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }

    const parentForm: FormSchema<Parent> = {
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
