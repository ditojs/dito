import { MikroORM } from '@mikro-orm/postgresql'
import {
  CheckConstraintViolationException,
  ConstraintViolationException,
  DriverException,
  ForeignKeyConstraintViolationException,
  NotFoundError,
  NotNullConstraintViolationException,
  OptimisticLockError,
  UniqueConstraintViolationException,
  type EntityMetadata
} from '@mikro-orm/core'
import { defineEntity, p } from '@mikro-orm/core'
import { HttpError } from '@ditojs/server'
import { toHttpError } from '../src/errors.ts'
import { Cut, Family, FontSet, entities } from './entities.ts'

// A page owns its child pages, which share its table.
const PageSchema = defineEntity({
  name: 'Page',
  tableName: 'page',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    parent: () => p.manyToOne(Page).nullable(),
    children: () =>
      p
        .oneToMany(Page)
        .mappedBy(page => page.parent)
        .orphanRemoval()
  }
})
class Page extends PageSchema.class {}
PageSchema.setClass(Page)

// Discovering the metadata doesn't connect to the database.
const orm = await MikroORM.init({
  dbName: 'dito_mikro_metadata',
  entities: [...entities, Page]
})
const family = orm.getMetadata().get(Family)
const set = orm.getMetadata().get(FontSet)
const cut = orm.getMetadata().get(Cut)
const page = orm.getMetadata().get(Page)

// A MikroORM exception of a Postgres error, as the exception converter makes
// it.
function pgError<T extends DriverException>(
  Exception: new (error: Error) => T,
  message: string,
  fields: Record<string, string>
) {
  return new Exception(Object.assign(new Error(message), fields))
}

const body = (
  error: unknown,
  meta: EntityMetadata = family,
  method = 'PATCH'
) => (toHttpError(error, meta, method) as HttpError).toJSON()

describe('toHttpError()', () => {
  it('answers 23502 with 400 at the column of the root table', () => {
    const error = pgError(NotNullConstraintViolationException, 'not null', {
      code: '23502',
      table: 'family',
      column: 'name'
    })
    expect(body(error)).toMatchObject({
      status: 400,
      type: 'ModelValidation',
      errors: { name: [{ message: 'is required', keyword: 'invalid_type' }] }
    })
    // Without the metadata, or on another table, with the status only.
    expect(toHttpError(error)!.toJSON()).toEqual({
      status: 400,
      message: 'The data is not valid for the database.'
    })
    expect(body(error, set).errors).toBeUndefined()
  })

  it('answers with the status only for entities that own rows of their table', () => {
    const error = pgError(NotNullConstraintViolationException, 'not null', {
      code: '23502',
      table: 'page',
      column: 'title'
    })
    expect(body(error, page)).toEqual({
      status: 400,
      message: 'The data is not valid for the database.'
    })
  })

  it('answers 23505 with 409 at the key columns', () => {
    const error = pgError(UniqueConstraintViolationException, 'unique', {
      code: '23505',
      table: 'font_set',
      detail: 'Key (family_id, "name")=(1, Regular) already exists.'
    })
    expect(body(error, set)).toMatchObject({
      status: 409,
      errors: {
        family: [{ message: 'already exists', keyword: 'not_unique' }],
        name: [{ message: 'already exists', keyword: 'not_unique' }]
      }
    })
    const composite = pgError(UniqueConstraintViolationException, 'unique', {
      code: '23505',
      table: 'font_cut',
      detail: 'Key (set_id, name)=(1, Light) already exists.'
    })
    expect(Object.keys(body(composite, cut).errors!)).toEqual([
      'set',
      'name'
    ])
    // A key on an expression points nowhere.
    const expression = pgError(UniqueConstraintViolationException, 'unique', {
      code: '23505',
      table: 'family',
      detail: 'Key (lower(name::text))=(a) already exists.'
    })
    expect(body(expression)).toEqual({
      status: 409,
      message: 'The data conflicts with rows in the database.'
    })
  })

  it('answers 23503 on a write with 400 at the relation', () => {
    const error = pgError(ForeignKeyConstraintViolationException, 'fk', {
      code: '23503',
      table: 'font_set',
      detail: 'Key (family_id)=(99) is not present in table "family".'
    })
    expect(body(error, set)).toMatchObject({
      status: 400,
      errors: {
        family: [
          { message: 'references a missing row', keyword: 'invalid_value' }
        ]
      }
    })
    // A Postgres detail that it can't read points nowhere.
    const other = pgError(ForeignKeyConstraintViolationException, 'fk', {
      code: '23503',
      table: 'font_set',
      detail: 'Schlüssel (family_id)=(99) ist nicht vorhanden.'
    })
    expect(body(other, set)).toEqual({
      status: 400,
      message: 'The data is not valid for the database.'
    })
  })

  it('answers 23503 on a delete or on another table with 409', () => {
    const conflict = {
      status: 409,
      message: 'The data conflicts with rows in the database.'
    }
    // Postgres names the table that references the deleted row. The response
    // doesn't depend on the language of its messages.
    const error = pgError(ForeignKeyConstraintViolationException, 'fk', {
      code: '23503',
      table: 'award',
      detail: 'Auf Schlüssel (id)=(1) wird noch aus Tabelle »award« verwiesen.'
    })
    expect(body(error, family, 'DELETE')).toEqual(conflict)
    expect(body(error, family, 'PATCH')).toEqual(conflict)
    const root = pgError(ForeignKeyConstraintViolationException, 'fk', {
      code: '23503',
      table: 'family',
      detail: 'Auf Schlüssel (id)=(1) wird noch aus Tabelle »family« verwiesen.'
    })
    expect(body(root, family, 'DELETE')).toEqual(conflict)
  })

  it('answers 23514 with 400 at the column that the constraint names', () => {
    const error = pgError(CheckConstraintViolationException, 'check', {
      code: '23514',
      table: 'family',
      constraint: 'family_name_check'
    })
    expect(body(error).errors).toEqual({
      name: [{ message: 'fails a check', keyword: 'invalid_value' }]
    })
    const other = pgError(CheckConstraintViolationException, 'check', {
      code: '23514',
      table: 'family',
      constraint: 'name_not_empty'
    })
    expect(body(other)).toEqual({
      status: 400,
      message: 'The data is not valid for the database.'
    })
  })

  it('answers data exceptions such as 22001 with 400 without a field', () => {
    const error = pgError(DriverException, 'value too long', {
      code: '22001',
      table: 'family',
      column: 'name'
    })
    expect(body(error)).toEqual({
      status: 400,
      message: 'The data is not valid for the database.'
    })
  })

  it('answers other constraint violations with 409 without a field', () => {
    const exclusion = pgError(ConstraintViolationException, 'exclusion', {
      code: '23P01',
      table: 'family'
    })
    const unique = pgError(UniqueConstraintViolationException, 'unique', {
      code: '23505',
      table: 'family'
    })
    for (const error of [exclusion, unique]) {
      expect(body(error)).toEqual({
        status: 409,
        message: 'The data conflicts with rows in the database.'
      })
    }
  })

  it('answers other database errors with 500', () => {
    const error = pgError(DriverException, 'syntax error', { code: '42601' })
    expect(body(error).status).toBe(500)
  })

  it('maps MikroORM errors and leaves other errors', () => {
    expect(toHttpError(new NotFoundError('none'))!.status).toBe(404)
    expect(
      toHttpError(OptimisticLockError.lockFailed('Family'))!.status
    ).toBe(409)
    expect(toHttpError(new Error('other'))).toBeUndefined()
  })
})
