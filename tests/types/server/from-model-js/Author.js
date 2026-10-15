import { Model } from '@ditojs/server'

export class Author extends Model {
  static properties = /** @type {const} */ ({
    name: { type: 'string', required: true },
    address: {
      type: 'object',
      nullable: true,
      properties: {
        street: { type: 'string', required: true },
        zip: { type: 'string' }
      }
    },
    password: { type: 'string', hidden: true }
  })

  static relations = /** @type {const} */ ({
    books: { relation: 'hasMany', from: 'Author.id', to: 'Book.authorId' }
  })
}
