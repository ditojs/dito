import session from 'koa-session'
import compose from 'koa-compose'
import { isString } from '@ditojs/utils'

interface SessionOptions {
  modelClass?: any
  autoCommit?: boolean
  sameSite?: 'strict' | 'lax' | 'none' | boolean
  [key: string]: any
}

export function handleSession(app, {
  modelClass,
  autoCommit = true,
  // Only send the session cookie along with same-site requests and top-level
  // navigations, against cross-site request forgery:
  sameSite = 'lax',
  ...options
}: SessionOptions = {}) {
  if (modelClass) {
    // Create a ContextStore that resolved the specified model class,
    // uses it to persist and retrieve the session, and automatically
    // binds all db operations to `ctx.transaction`, if it is set.
    options.ContextStore = createSessionStore(modelClass)
  }
  options.autoCommit = false
  options.sameSite = sameSite
  return compose([
    session(options, app),
    async (ctx, next) => {
      // Get hold of `session` now, since it may not be available from the
      // `ctx` if the session is destroyed.
      const {
        session,
        route: { transacted }
      } = ctx
      try {
        await next()
        if (autoCommit && transacted) {
          // When transacted, only commit when there are no errors. Otherwise,
          // the commit will fail and the original error will be lost.
          await session.commit()
        }
      } finally {
        // When not transacted, keep the original behavior of always
        // committing.
        if (autoCommit && !transacted) {
          await session.commit()
        }
      }
    }
  ])
}

const createSessionStore = modelClass =>
  class SessionStore {
    declare ctx: any
    declare modelClass: any

    constructor(ctx) {
      this.ctx = ctx
      this.modelClass = isString(modelClass)
        ? ctx.app.models[modelClass]
        : modelClass
      if (!this.modelClass) {
        throw new Error(`Unable to find model class: '${modelClass}'.`)
      }
    }

    query() {
      return this.modelClass.query(this.ctx.transaction)
    }

    async get(id: string): Promise<Record<string, any>> {
      const session = await this.query().findById(id)
      return session?.value || {}
    }

    async set(id: string, value: Record<string, any>): Promise<void> {
      // Sessions with `maxAge: 'session'` have no `_expire`:
      const { _expire } = value
      await this.query().upsert({
        ...this.modelClass.getReference(id),
        value,
        expiresAt: _expire ? new Date(_expire) : null
      })
    }

    async destroy(key: string): Promise<void> {
      await this.query().deleteById(key)
    }
  }
