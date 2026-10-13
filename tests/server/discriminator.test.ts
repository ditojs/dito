import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

class Book extends Model {
  declare id: number
  declare title: string
  declare blocks: Record<string, unknown>[]
  declare cover: Record<string, unknown> | null
  declare spine: Record<string, unknown> | null
  declare caption: Record<string, unknown> | null

  // `ModelProperty` doesn't accept `{ $ref }` as `items`:
  static override properties: ModelProperties = {
    title: { type: 'string' },
    // Variants that extend a shared base through `$ref`:
    blocks: {
      type: 'array',
      items: { $ref: '#Block' },
      definitions: {
        '#BlockBase': {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', required: true }
          }
        },
        '#Block': {
          $ref: '#BlockBase',
          discriminator: { propertyName: 'type' },
          oneOf: [
            {
              properties: {
                type: { enum: ['heading', 'text'] },
                text: { type: 'string' }
              }
            },
            {
              properties: {
                type: { const: 'image' },
                url: { type: 'string' }
              }
            }
          ]
        }
      }
    },
    spine: { $ref: '#Block' },
    // The base on its own, closed where it's used:
    caption: { $ref: '#BlockBase' },
    // Variants that list all their properties, with a JSON Schema `required`
    // array that doesn't make the property itself required:
    cover: {
      type: 'object',
      required: ['type'],
      discriminator: { propertyName: 'type' },
      oneOf: [
        {
          properties: {
            type: { const: 'image' },
            url: { type: 'string' }
          }
        },
        {
          properties: {
            type: { const: 'color' },
            color: { type: 'string' }
          }
        }
      ]
    }
  } as any
}

describe('Discriminator in model properties', () => {
  const app = createTestApp({ models: { Book } })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.setup()
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  const blocks = [
    { id: 'a', type: 'heading', text: 'Chapter One' },
    { type: 'image', url: 'cover.png' }
  ]

  async function getErrors(promise: PromiseLike<unknown>) {
    const error: any = await promise.then(
      () => null,
      error => error
    )
    return error?.data?.errors
  }

  async function insertBook() {
    return Book.query().insertAndFetch({ title: 'Book' } as any)
  }

  it('inserts and patches valid variants', async () => {
    const book = await Book.query().insertAndFetch({
      title: 'Book',
      blocks,
      cover: { type: 'color', color: 'red' },
      spine: blocks[0],
      caption: { id: 'b', type: 'caption' }
    } as any)
    expect(book.blocks).toEqual(blocks)
    expect(book.spine).toEqual(blocks[0])
    expect(book.caption).toEqual({ id: 'b', type: 'caption' })
    await Book.query()
      .findById(book.id)
      .patch({ blocks: [{ type: 'text', text: 'The End' }] } as any)
    const patched = await Book.query().findById(book.id)
    expect(patched!.blocks).toEqual([{ type: 'text', text: 'The End' }])
  })

  it("doesn't require properties with a `required` array", async () => {
    const book = await insertBook()
    expect(book.cover).toBe(null)
  })

  it('rejects unknown properties', async () => {
    const unknown = [{ type: 'heading', text: 'Title', subtitle: 'Sub' }]
    const errors = {
      'blocks/0': [
        expect.objectContaining({
          keyword: 'unevaluatedProperties',
          params: { unevaluatedProperty: 'subtitle' }
        })
      ]
    }
    expect(
      await getErrors(Book.query().insert({ blocks: unknown } as any))
    ).toEqual(errors)
    const { id } = await insertBook()
    expect(
      await getErrors(
        Book.query()
          .findById(id)
          .patch({ blocks: unknown } as any)
      )
    ).toEqual(errors)
    expect(
      await getErrors(
        Book.query().insert({ caption: { type: 'caption', text: 'x' } } as any)
      )
    ).toEqual({
      caption: [
        expect.objectContaining({
          keyword: 'unevaluatedProperties',
          params: { unevaluatedProperty: 'text' }
        })
      ]
    })
  })

  it('rejects properties of other variants than the selected one', async () => {
    expect(
      await getErrors(
        Book.query().insert({ cover: { type: 'image', color: 'red' } } as any)
      )
    ).toEqual({
      cover: [
        expect.objectContaining({
          keyword: 'unevaluatedProperties',
          params: { unevaluatedProperty: 'color' }
        })
      ]
    })
  })

  it('rejects unknown and missing tags, also in patches', async () => {
    expect(
      await getErrors(
        Book.query().insert({ blocks: [{ type: 'video' }] } as any)
      )
    ).toEqual({
      'blocks/0': expect.arrayContaining([
        expect.objectContaining({
          keyword: 'discriminator',
          message: 'value of tag "type" must be in oneOf'
        })
      ])
    })
    const { id } = await insertBook()
    expect(
      await getErrors(
        Book.query()
          .findById(id)
          .patch({ cover: { url: 'cover.png' } } as any)
      )
    ).toEqual({
      cover: expect.arrayContaining([
        expect.objectContaining({
          keyword: 'required',
          params: { missingProperty: 'type' }
        })
      ])
    })
  })
})
