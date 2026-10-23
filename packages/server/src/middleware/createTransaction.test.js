import { vi } from 'vitest'
import {
  createTestKnex,
  isSQLiteTest
} from '../../../../tests/utils/test-knex.ts'
import { createTransaction } from './createTransaction.js'
import { Application } from '../app/Application.js'
import { DatabaseError } from '../errors/index.js'

// Booting PGlite can exceed the default timeout under full-suite load.
describe('createTransaction()', { timeout: 30_000 }, () => {
  const app = new Application({
    config: {
      log: { silent: true },
      knex: createTestKnex()
    }
  })
  const { knex } = app
  const middleware = createTransaction()

  const createContext = () => ({
    route: { transacted: true, controller: {} },
    app
  })

  beforeAll(async () => {
    await knex.schema.createTable('parent', table => {
      table.increments('id').primary()
    })
    // A deferred constraint is only checked when the transaction commits.
    await knex.raw(`
      CREATE TABLE child (
        id serial PRIMARY KEY,
        parent_id integer REFERENCES parent (id)
          DEFERRABLE INITIALLY DEFERRED
      )
    `)
  })

  afterAll(async () => {
    await knex.destroy()
  })

  afterEach(async () => {
    await knex('child').del()
    await knex('parent').del()
  })

  const insertChild = (ctx, parentId) =>
    ctx.transaction('child').insert({ parent_id: parentId })

  it('commits the transaction', async () => {
    const ctx = createContext()
    await middleware(ctx, async () => {
      const [{ id }] = await ctx
        .transaction('parent')
        .insert({})
        .returning('id')
      await insertChild(ctx, id)
    })
    expect(await knex('child').count('* as count')).toEqual([{ count: 1 }])
  })

  it('throws when the commit fails', async () => {
    const ctx = createContext()
    await expect(
      middleware(ctx, async () => {
        await insertChild(ctx, 1234)
      })
    ).rejects.toThrow(/foreign key constraint/i)
    expect(await knex('child').count('* as count')).toEqual([{ count: 0 }])
  })

  it('wraps the errors of failed commits like other database errors', async context => {
    context.skip(isSQLiteTest, `Objection doesn't wrap better-sqlite3 errors`)
    const ctx = createContext()
    const error = await middleware(ctx, async () => {
      await insertChild(ctx, 1234)
    }).catch(error => error)
    expect(error).toBeInstanceOf(DatabaseError)
    // Like the same violation in a query, not a generic database error:
    expect(error.status).toBe(409)
    expect(error.message).toBe(
      'insert or update on table "child" violates foreign key constraint ' +
      '"child_parent_id_fkey"'
    )
  })

  it(`doesn't roll back transactions that a failed commit completed`, async () => {
    const ctx = createContext()
    let rollback
    await expect(
      middleware(ctx, async () => {
        await insertChild(ctx, 1234)
        rollback = vi.spyOn(ctx.transaction, 'rollback')
      })
    ).rejects.toThrow(/foreign key constraint/i)
    expect(rollback).not.toHaveBeenCalled()
  })

  it('fails when the handler rolls back the transaction itself', async () => {
    const ctx = createContext()
    const error = new Error('Rolled back')
    await expect(
      middleware(ctx, async () => {
        await insertChild(ctx, null)
        await ctx.transaction.rollback(error)
      })
    ).rejects.toBe(error)
    expect(await knex('child').count('* as count')).toEqual([{ count: 0 }])
  })

  it('succeeds when the handler rolls back the transaction without an error', async () => {
    const ctx = createContext()
    await middleware(ctx, async () => {
      await insertChild(ctx, null)
      await ctx.transaction.rollback()
    })
    expect(await knex('child').count('* as count')).toEqual([{ count: 0 }])
  })

  it('rolls back when the handler throws', async () => {
    const ctx = createContext()
    const error = new Error('Handler failed')
    await expect(
      middleware(ctx, async () => {
        const [{ id }] = await ctx
          .transaction('parent')
          .insert({})
          .returning('id')
        await insertChild(ctx, id)
        throw error
      })
    ).rejects.toBe(error)
    expect(await knex('child').count('* as count')).toEqual([{ count: 0 }])
  })

  it('rejects `executionPromise` with the error of the handler', async () => {
    const ctx = createContext()
    const error = new Error('Handler failed')
    let executionPromise
    await expect(
      middleware(ctx, async () => {
        executionPromise = ctx.transaction.executionPromise
        throw error
      })
    ).rejects.toBe(error)
    await expect(executionPromise).rejects.toBe(error)
  })
})
