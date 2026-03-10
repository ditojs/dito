import { expectTypeOf, describe, it } from 'vitest'
import type {
  SchemaByType,
  InputSchema,
  ListSchema,
  SectionSchema,
  ButtonSchema,
  NumberSchema,
  SelectSchema,
  ObjectSchema
} from '../index.d.ts'
import type { Entry } from './fixtures.ts'

describe('SchemaByType', () => {
  it('text resolves to InputSchema', () => {
    expectTypeOf<SchemaByType<Entry>['text']>()
      .toEqualTypeOf<InputSchema<Entry>>()
  })

  it('list resolves to ListSchema', () => {
    expectTypeOf<SchemaByType<Entry>['list']>()
      .toEqualTypeOf<ListSchema<Entry>>()
  })

  it('section resolves to SectionSchema', () => {
    expectTypeOf<SchemaByType<Entry>['section']>()
      .toEqualTypeOf<SectionSchema<Entry>>()
  })

  it('unknown resolves to never', () => {
    expectTypeOf<SchemaByType<Entry>['unknown']>()
      .toEqualTypeOf<never>()
  })

  it('button resolves to ButtonSchema', () => {
    expectTypeOf<SchemaByType<Entry>['button']>()
      .toEqualTypeOf<ButtonSchema<Entry>>()
  })

  it('number resolves to NumberSchema', () => {
    expectTypeOf<SchemaByType<Entry>['number']>()
      .toEqualTypeOf<NumberSchema<Entry>>()
  })

  it('select resolves to SelectSchema', () => {
    expectTypeOf<SchemaByType<Entry>['select']>()
      .toEqualTypeOf<SelectSchema<Entry>>()
  })

  it('object resolves to ObjectSchema', () => {
    expectTypeOf<SchemaByType<Entry>['object']>()
      .toEqualTypeOf<ObjectSchema<Entry>>()
  })
})
