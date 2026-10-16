import { Model } from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

const sectionBase = {
  properties: {
    id: { type: 'string' },
    type: { type: 'string', required: true }
  }
}

class Library extends Model {
  declare id: number

  // `ModelProperty` doesn't accept `{ $ref }` as `items`:
  static override properties = {
    // A definition that allows unknown properties wherever it's used:
    notes: {
      type: 'array',
      items: { $ref: '#Note' },
      definitions: {
        '#Note': {
          type: 'object',
          unevaluatedProperties: true,
          properties: { text: { type: 'string' } }
        }
      }
    },
    // Objects without properties stay open:
    meta: {
      $ref: '#Meta',
      definitions: { '#Meta': { type: 'object' } }
    },
    // Non-objects aren't affected by closing them where they're used:
    motto: {
      $ref: '#Motto',
      definitions: { '#Motto': { type: 'string' } }
    },
    tint: { type: 'color' },
    // An object combined from typed parts:
    edition: {
      type: 'object',
      allOf: [
        { type: 'object', properties: { title: { type: 'string' } } },
        { type: 'object', properties: { year: { type: 'integer' } } }
      ]
    },
    // Variants that combine a base with their own properties through `allOf`,
    // without a discriminator:
    sections: {
      type: 'array',
      items: { $ref: '#Section' },
      definitions: {
        '#SectionBase': sectionBase,
        '#Section': {
          type: 'object',
          oneOf: [
            {
              allOf: [
                { $ref: '#SectionBase' },
                {
                  properties: {
                    type: { const: 'chapter' },
                    title: { type: 'string' }
                  }
                }
              ]
            },
            {
              allOf: [
                { $ref: '#SectionBase' },
                {
                  properties: {
                    type: { const: 'appendix' },
                    letter: { type: 'string' }
                  }
                }
              ]
            }
          ]
        }
      }
    }
  } as any
}

// The same variants with a discriminator, which Ajv only supports with the
// tag directly in the `properties` of each variant:
class Archive extends Model {
  declare id: number

  static override properties = {
    sections: {
      type: 'array',
      items: { $ref: '#Section' },
      definitions: {
        '#SectionBase': sectionBase,
        '#Section': {
          ...Library.properties.sections.definitions['#Section'],
          discriminator: { propertyName: 'type' }
        }
      }
    }
  } as any
}

describe('Definitions in model properties', () => {
  const app = createTestApp({ models: { Library, Archive } })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.setup()
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  async function getErrors(promise: PromiseLike<unknown>) {
    const error: any = await promise.then(
      () => null,
      error => error
    )
    return error?.data?.errors
  }

  it('keeps definitions with `unevaluatedProperties: true` open', async () => {
    const notes = [{ text: 'Read', author: 'Ada' }]
    const library: any = await Library.query().insertAndFetch({ notes } as any)
    expect(library.notes).toEqual(notes)
  })

  it('keeps objects without properties open', async () => {
    const meta = { shelves: 12 }
    const library: any = await Library.query().insertAndFetch({ meta } as any)
    expect(library.meta).toEqual(meta)
  })

  it('validates references to non-objects as before', async () => {
    const library: any = await Library.query().insertAndFetch({
      motto: 'Read more',
      tint: '#ffcc00'
    } as any)
    expect(library).toMatchObject({ motto: 'Read more', tint: '#ffcc00' })
    expect(
      await getErrors(Library.query().insert({ motto: 42 } as any))
    ).toEqual({
      motto: [expect.objectContaining({ keyword: 'type' })]
    })
  })

  it('combines typed `allOf` parts into one object', async () => {
    const edition = { title: 'Origins', year: 1859 }
    const library: any = await Library.query().insertAndFetch({
      edition
    } as any)
    expect(library.edition).toEqual(edition)
    expect(
      await getErrors(
        Library.query().insert({ edition: { ...edition, pages: 502 } } as any)
      )
    ).toEqual({
      edition: [expect.objectContaining({ keyword: 'unevaluatedProperties' })]
    })
  })

  it('validates variants that combine a base through `allOf`', async () => {
    const sections = [
      { id: 'a', type: 'chapter', title: 'One' },
      { type: 'appendix', letter: 'A' }
    ]
    const library: any = await Library.query().insertAndFetch({
      sections
    } as any)
    expect(library.sections).toEqual(sections)
    await Library.query()
      .findById(library.id)
      .patch({ sections: [sections[1]] } as any)
    for (const section of [
      { type: 'chapter', title: 'One', pages: 10 },
      { type: 'appendix', title: 'One' }
    ]) {
      expect(
        await getErrors(Library.query().insert({ sections: [section] } as any))
      ).toEqual({
        'sections/0': [
          expect.objectContaining({ keyword: 'unevaluatedProperties' })
        ]
      })
    }
  })

  it('rejects discriminators with the tag in `allOf` parts', async () => {
    await expect(
      Archive.query().insert({ sections: [{ type: 'chapter' }] } as any)
    ).rejects.toThrow(
      'discriminator: oneOf subschemas (or referenced schemas) must have ' +
      '"properties/type"'
    )
  })
})
