import { WrappedError } from './WrappedError'

export class DatabaseError extends WrappedError {
  constructor(error) {
    // Remove knex SQL query and move to separate `query` property.
    // TODO: Fix this properly in Knex / Objection insetead, see:
    // https://gitter.im/Vincit/objection.js?at=5a68728f5a9ebe4f75ca40b0
    const [, sql, message] = error.message.match(/^(.*?)\s*-\s*([^-]*)$/)
    super(Object.setPrototypeOf({ message, sql }, error),
      { message: 'Database error', status: 400 })
  }

  toJSON() {
    // Remove SQL query from displayed data in front-end in production.
    if (process.env.NODE_ENV === 'production') {
      const { sql, ...data } = this.data
      return data
    }
    return this.data
  }
}
