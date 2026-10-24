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
    // References in `anyOf` and `oneOf`, closed on their own:
    pet: {
      anyOf: [{ type: 'null' }, { $ref: '#Cat' }],
      definitions: {
        '#Cat': { type: 'object', properties: { meow: { type: 'string' } } },
        '#Dog': { type: 'object', properties: { woof: { type: 'string' } } }
      }
    },
    animal: { oneOf: [{ $ref: '#Cat' }, { $ref: '#Dog' }] },
    // References next to properties that they don't evaluate, closed at the
    // outer level:
    tagged: {
      type: 'object',
      properties: { id: { type: 'string' } },
      anyOf: [{ $ref: '#Cat' }, { $ref: '#Dog' }]
    },
    // ...also next to the properties of other `allOf` parts or of patterns, and
    // in definitions, closed where they're used:
    combined: {
      type: 'object',
      allOf: [
        { anyOf: [{ $ref: '#Cat' }, { $ref: '#Dog' }] },
        { type: 'object', properties: { id: { type: 'string' } } }
      ]
    },
    patterned: {
      type: 'object',
      patternProperties: { '^x-': { type: 'string' } },
      anyOf: [{ $ref: '#Cat' }, { $ref: '#Dog' }]
    },
    extended: {
      type: 'object',
      additionalProperties: { type: 'string' },
      anyOf: [{ $ref: '#Cat' }, { $ref: '#Dog' }]
    },
    labeled: {
      type: 'object',
      properties: { id: { type: 'string' } },
      allOf: [{ $ref: '#Pet' }],
      definitions: {
        '#Pet': { anyOf: [{ $ref: '#Cat' }, { $ref: '#Dog' }] }
      }
    },
    // References as variants of a discriminator, which Ajv only follows
    // without other keywords:
    figure: {
      type: 'object',
      discriminator: { propertyName: 'type' },
      oneOf: [{ $ref: '#Image' }, { $ref: '#Text' }],
      definitions: {
        '#Image': {
          type: 'object',
          properties: { type: { const: 'image' }, url: { type: 'string' } }
        },
        '#Text': {
          type: 'object',
          properties: { type: { const: 'text' }, text: { type: 'string' } }
        }
      }
    },
    caption: {
      type: 'object',
      properties: { label: { type: 'string' } },
      discriminator: { propertyName: 'type' },
      oneOf: [{ $ref: '#Image' }, { $ref: '#Text' }]
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
  const app = createTestApp({ models: { Library } })

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

  // Alternatives also report the errors of the other alternatives:
  async function expectUnevaluated(json: object) {
    const [key] = Object.keys(json)
    expect(await getErrors(Library.query().insert(json as any))).toEqual({
      [key]: expect.arrayContaining([
        expect.objectContaining({ keyword: 'unevaluatedProperties' })
      ])
    })
  }

  it('closes nullable references', async () => {
    for (const pet of [null, { meow: 'Purr' }]) {
      expect(
        await getErrors(Library.query().insert({ pet } as any))
      ).toBeUndefined()
    }
    await expectUnevaluated({ pet: { meow: 'Purr', woof: 'Wuff' } })
  })

  it('closes references in `oneOf`', async () => {
    for (const animal of [{ meow: 'Purr' }, { woof: 'Wuff' }]) {
      expect(
        await getErrors(Library.query().insert({ animal } as any))
      ).toBeUndefined()
    }
    await expectUnevaluated({ animal: { meow: 'Purr', woof: 'Wuff' } })
  })

  it('closes references next to properties at the outer level', async () => {
    const tagged = { id: 'a', meow: 'Purr' }
    const library: any = await Library.query().insertAndFetch({
      tagged
    } as any)
    expect(library.tagged).toEqual(tagged)
    await expectUnevaluated({ tagged: { ...tagged, legs: 4 } })
  })

  it('closes references next to other evaluated properties', async () => {
    const combined = { id: 'a', meow: 'Purr' }
    const patterned = { 'x-id': 'a', 'meow': 'Purr' }
    const labeled = { id: 'a', woof: 'Wuff' }
    // Additional properties are valid next to the alternatives:
    const extended = { meow: 'Purr', note: 'Shy' }
    const library: any = await Library.query().insertAndFetch({
      combined,
      patterned,
      labeled,
      extended
    } as any)
    expect(library).toMatchObject({ combined, patterned, labeled, extended })
    await expectUnevaluated({ combined: { ...combined, legs: 4 } })
    await expectUnevaluated({ patterned: { ...patterned, legs: 4 } })
    await expectUnevaluated({ labeled: { ...labeled, legs: 4 } })
  })

  it('validates references as variants of a discriminator', async () => {
    const figure = { type: 'image', url: 'https://example.com/a.png' }
    const caption = { label: 'One', type: 'text', text: 'Hello' }
    const library: any = await Library.query().insertAndFetch({
      figure,
      caption
    } as any)
    expect(library).toMatchObject({ figure, caption })
    await expectUnevaluated({ figure: { ...figure, text: 'Hello' } })
    await expectUnevaluated({ caption: { ...caption, url: 'a.png' } })
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
    const app = createTestApp({ models: { Archive } })
    await expect(app.setupModels()).rejects.toThrow(
      'discriminator: oneOf subschemas (or referenced schemas) must have ' +
      '"properties/type"'
    )
  })
})
