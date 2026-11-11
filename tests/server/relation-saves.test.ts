import type { ModelProperties } from '@ditojs/server'
import { Model, ModelController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

class Page extends Model {
  declare id: number
  declare text: string
  declare bookId: number | null

  static override properties: ModelProperties = {
    text: { type: 'string' },
    bookId: { type: 'integer', foreign: true, nullable: true }
  }
}

class Cover extends Model {
  declare id: number
  declare color: string
  declare bookId: number | null

  static override properties: ModelProperties = {
    color: { type: 'string' },
    bookId: { type: 'integer', foreign: true, nullable: true }
  }
}

class Shelf extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: { type: 'string' }
  }
}

class Book extends Model {
  declare id: number
  declare pages: Page[]
  declare cover: Cover
  declare shelf: Shelf

  static override properties: ModelProperties = {
    title: { type: 'string' },
    shelfId: { type: 'integer', foreign: true, nullable: true }
  }

  static override relations: any = {
    pages: {
      relation: 'hasMany',
      from: 'Book.id',
      to: 'Page.bookId',
      owner: true
    },
    cover: {
      relation: 'hasOne',
      from: 'Book.id',
      to: 'Cover.bookId',
      owner: true
    },
    shelf: {
      relation: 'belongsTo',
      from: 'Book.shelfId',
      to: 'Shelf.id',
      owner: true
    }
  }
}

// Each controller needs relation objects of its own:
const getRelations = () => ({
  pages: { member: { allow: ['put', 'patch'] } },
  cover: { relation: { allow: ['put', 'patch'] } },
  shelf: { relation: { allow: ['put', 'patch'] } }
})

class Books extends ModelController<Book> {
  override modelClass = Book
  override member: any = { allow: ['get'] }
  override relations: any = getRelations()
}

class GraphBooks extends Books {
  override graph = true
  override relations: any = getRelations()
}

describe('Relation controllers', () => {
  const app = createTestApp({
    models: { Book, Page, Cover, Shelf },
    controllers: { Books, GraphBooks },
    config: { app: { normalizePaths: true, helmet: false } }
  })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.start()
  })

  afterAll(async () => {
    await app.stop()
    await app.knex?.destroy()
  })

  async function insertBook(title = 'Book') {
    return Book.query().insertGraphAndFetch({
      title,
      pages: [{ text: 'One' }],
      cover: { color: 'red' },
      shelf: { name: 'Top' }
    } as any)
  }

  function send(method: string, path: string, body: object) {
    return fetch(`${getAppUrl(app)}/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  }

  for (const path of ['books', 'graph-books']) {
    describe(path, () => {
      it('saves the members of to-many relations', async () => {
        const book = await insertBook()
        const [page] = book.pages
        const url = `${path}/${book.id}/pages/${page.id}`
        const patched = await send('PATCH', url, { text: 'Two' })
        expect(patched.status).toBe(200)
        expect(await patched.json()).toMatchObject({ text: 'Two' })
        const put = await send('PUT', url, { id: page.id, text: 'Three' })
        expect(put.status).toBe(200)
        expect(await Page.query().findById(page.id)).toMatchObject({
          text: 'Three',
          bookId: book.id
        })
      })

      it('refuses records that the relation does not hold', async () => {
        const book = await insertBook()
        const other = await insertBook('Other')
        const [page] = other.pages
        const url = `${path}/${book.id}/pages/${page.id}`
        expect((await send('PATCH', url, { text: 'Two' })).status).toBe(404)
        expect((await Page.query().findById(page.id))!.text).toBe('One')
      })

      it('saves the records of to-one relations', async () => {
        const book = await insertBook()
        for (const method of ['PATCH', 'PUT']) {
          const color = `${method} color`
          const response = await send(method, `${path}/${book.id}/cover`, {
            color
          })
          expect(response.status).toBe(200)
          expect(await Cover.query().findById(book.cover.id)).toMatchObject({
            color,
            bookId: book.id
          })
          const name = `${method} name`
          const shelf = await send(method, `${path}/${book.id}/shelf`, { name })
          expect(shelf.status).toBe(200)
          expect((await Shelf.query().findById(book.shelf.id))!.name).toBe(name)
        }
      })

      it('responds with 404 for to-one relations without a record', async () => {
        const book = await insertBook()
        await Cover.query().delete().where('bookId', book.id)
        const url = `${path}/${book.id}/cover`
        expect((await send('PATCH', url, { color: 'blue' })).status).toBe(404)
      })
    })
  }
})
