import session from 'koa-session'
import compose from 'koa-compose'
import { isString } from '@ditojs/utils'

export function handleSession(app, {
  modelClass,
  autoCommit = true,
  ...options
} = {}) {
  if (modelClass) {
    // Create a ContextStore that resolved the specified model class,
    // uses it to persist and retrieve the session, and automatically
    // binds all db operations to `ctx.transaction`, if it is set.
    // eslint-disable-next-line new-cap
    options.ContextStore = createSessionStore(modelClass)
  }
  options.autoCommit = false
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
    constructor(ctx) {
      this.ctx = ctx
      this.modelClass = isString(modelClass)
        ? ctx.app.models[modelClass]
        : modelClass
      if (!this.modelClass) {
        throw new Error(`Unable to find model class: '${modelClass}'`)
      }
    }

    query() {
      return this.modelClass.query(this.ctx.transaction)
    }

    async get(id) {
      const session = await this.query().findById(id)
      return session?.value || {}
    }

    async set(id, value) {
      await this.query()
        .findById(id)
        .upsert({
          ...this.modelClass.getReference(id),
          value
        })
    }

    async destroy(key) {
      await this.query().deleteById(key)
    }
  }
