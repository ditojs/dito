import { randomUUID } from 'node:crypto'
import { ProblemError, type Plugin, type Problem } from '@ditojs/server-next'
import { ResponseError, type Application } from '@ditojs/server'
import { wrapError } from 'objection'

// Connects the next server to a Dito 6 application: its knex for
// transactions, its request storage for the code that reads
// `app.requestLocals`, and its errors for the responses. Each request runs
// in request storage of its own, which holds its logger, and inside a
// transaction also the transaction. Dito 6's `session` is not part of it.

type RequestLocals = Parameters<Application['requestStorage']['run']>[0]

export function objectionPlugin({ app }: { app: Application }): Plugin {
  return {
    middleware: (c, next) =>
      app.requestStorage.run(
        {
          ...app.requestLocals,
          logger: app.logger.child({ requestId: randomUUID().slice(0, 6) })
        } as RequestLocals,
        next
      ),

    async transaction(c, fn) {
      const trx = await app.knex.transaction()
      c.set('trx', trx)
      try {
        const result = await app.requestStorage.run(
          { ...app.requestLocals, transaction: trx } as RequestLocals,
          fn
        )
        // Handlers may complete the transaction themselves, e.g. by rolling
        // it back, in which case `executionPromise` holds their result.
        if (!trx.isCompleted()) {
          await trx.commit()
          // Knex resolves `commit()` also when `COMMIT` fails, e.g. on
          // deferred constraints, and only rejects `executionPromise`.
          await trx.executionPromise.catch(error => {
            throw app.createDatabaseError(wrapError(error))
          })
        }
        await trx.executionPromise
        return result
      } catch (error) {
        if (!trx.isCompleted()) {
          await trx.rollback(error)
        }
        throw error
      } finally {
        c.set('trx', undefined)
      }
    },

    toProblem: error => toProblem(app, error)
  }
}

// Dito 6's errors keep the JSON that the admin reads: `type` and `message`
// for its notifications, and on a 400 the `errors` of the fields, keyed by
// Dito 6's data paths such as `sets/8/name`, not by JSON Pointers. Errors
// that aren't meant for the client answer their status only.
export function toProblem(app: Application, error: unknown) {
  if (!(error instanceof ResponseError)) return undefined
  app.logError(error)
  const { status = 500 } = error
  const exposed = app.config.env === 'development' || (error.expose ?? true)
  if (!exposed) return new ProblemError({ status }).toProblem()
  const { message, type, errors, ...data } = error.toJSON() as {
    message: string
    type?: string
    errors?: Problem['errors']
  }
  return {
    ...data,
    ...new ProblemError({ status, detail: message, type, errors }).toProblem(),
    message
  } as Problem
}
