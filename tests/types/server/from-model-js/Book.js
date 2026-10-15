import { TimestampedModel } from '@ditojs/server'

export class Book extends TimestampedModel {
  static properties = /** @type {const} */ ({
    title: { type: 'string', required: true },
    publishedAt: { type: 'datetime', nullable: true },
    authorId: { type: 'integer', foreign: true }
  })

  static relations = /** @type {const} */ ({
    author: { relation: 'belongsTo', from: 'Book.authorId', to: 'Author.id' }
  })

  get isPublished() {
    return !!this.publishedAt
  }
}
