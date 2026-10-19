import { expectTypeOf, assertType, describe, it } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import {
  defineFieldComponent,
  useDitoContext,
  DitoListField,
  DitoNumberField,
  DitoTextField
} from '@ditojs/admin'
import type {
  DitoContext,
  FieldProps,
  FormSchema,
  NumberSchema
} from '@ditojs/admin'

type Book = { title: string; chapters: { title: string }[] }

describe('Template forms', () => {
  it('accepts forms with a component and no components', () => {
    const Editor = defineComponent({
      setup: () => () => [
        h(DitoTextField, { path: 'title', required: true }),
        h(DitoNumberField, { path: 'price', min: 0 }),
        h(
          DitoListField,
          { path: 'chapters', inlined: true },
          { default: () => h(DitoTextField, { path: 'title' }) }
        )
      ]
    })
    assertType<FormSchema<Book>>({ type: 'form', component: Editor })
    assertType<FormSchema<Book>>({
      type: 'form',
      component: () => import('./fixtures.ts').then(() => Editor)
    })
  })

  it('derives the props of field components from their schemas', () => {
    expectTypeOf(DitoTextField).toExtend<Component>()
    expectTypeOf<FieldProps<NumberSchema>>().toHaveProperty('min')
    expectTypeOf<FieldProps<NumberSchema>['path']>().toBeString()
    expectTypeOf<FieldProps<NumberSchema>>().not.toHaveProperty('type')
  })

  it('creates the field components of custom types', () => {
    const DitoStarsField = defineFieldComponent<NumberSchema>('stars')
    expectTypeOf(DitoStarsField).toExtend<Component>()
  })

  it('types the context of useDitoContext()', () => {
    const context = useDitoContext<Book>()
    expectTypeOf(context).toEqualTypeOf<DitoContext<Book>>()
    expectTypeOf(context.item.title).toBeString()
  })
})
