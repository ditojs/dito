import { vi } from 'vitest'
import objection from 'objection'
import { Application } from '../app/Application.js'
import {
  GraphError,
  ModelError,
  NotFoundError,
  RelationError,
  ResponseError,
  ValidationError
} from '../errors/index.js'
import { Model } from './Model.js'
import RelationAccessor from './RelationAccessor.js'

// Uses the PostgreSQL dialect without a connection, to compile queries to SQL.
function createApp(models, knex = { client: 'pg' }) {
  return new Application({
    config: { log: { silent: true }, knex },
    models
  })
}

function toSQL(query) {
  return query.toKnexQuery().toSQL().toNative().sql
}

function makeFakeModel(assets) {
  const storage = {
    signAssetFile(file) {
      file.signature = `sig-of-${file.key}`
    }
  }
  return {
    app: {
      getStorage(name) {
        return name === 'test' ? storage : null
      }
    },
    definition: { assets }
  }
}

function signCallback(file, storage) {
  const signed = { ...file }
  storage.signAssetFile(signed)
  return signed
}

describe('Model._mapAssetFiles: asset signing across data paths', () => {
  it('writes the signature back to a literal data path', () => {
    const model = makeFakeModel({ 'image.file': { storage: 'test' } })
    const json = { image: { file: { key: 'foo.png' } } }
    Model._mapAssetFiles.call(model, json, signCallback)
    expect(json.image.file.signature).toBe('sig-of-foo.png')
  })

  it('writes the signature back to every match of a deep wildcard', () => {
    const model = makeFakeModel({ '**.file': { storage: 'test' } })
    const json = {
      content: {
        file: { key: 'a.png' },
        sections: [
          { file: { key: 'b.png' } },
          { file: { key: 'c.png' } }
        ]
      }
    }
    Model._mapAssetFiles.call(model, json, signCallback)
    expect(json.content.file.signature).toBe('sig-of-a.png')
    expect(json.content.sections[0].file.signature).toBe('sig-of-b.png')
    expect(json.content.sections[1].file.signature).toBe('sig-of-c.png')
  })

  it('writes the signature back into wildcard array values', () => {
    const model = makeFakeModel({ '**.files': { storage: 'test' } })
    const json = {
      content: {
        files: [{ key: 'x.png' }, { key: 'y.png' }]
      }
    }
    Model._mapAssetFiles.call(model, json, signCallback)
    expect(json.content.files[0].signature).toBe('sig-of-x.png')
    expect(json.content.files[1].signature).toBe('sig-of-y.png')
  })

  it('keeps empty values at asset data paths', () => {
    const model = makeFakeModel({
      cover: { storage: 'test' },
      gallery: { storage: 'test' }
    })
    const json = { cover: null, gallery: [{ key: 'a.png' }, null] }
    Model._mapAssetFiles.call(model, json, signCallback)
    expect(json).toEqual({
      cover: null,
      gallery: [{ key: 'a.png', signature: 'sig-of-a.png' }, null]
    })
  })

  it('is a no-op when the wildcard matches nothing', () => {
    const model = makeFakeModel({ '**.file': { storage: 'test' } })
    const json = { name: 'no-files-here' }
    Model._mapAssetFiles.call(model, json, signCallback)
    expect(json).toEqual({ name: 'no-files-here' })
  })
})

describe('Model._signAssetFiles()', () => {
  it('signs copies of the asset files, leaving the originals untouched', () => {
    const model = makeFakeModel({ cover: { storage: 'test' } })
    model._mapAssetFiles = Model._mapAssetFiles
    const file = { key: 'cover.png' }
    const json = { cover: file }
    Model._signAssetFiles.call(model, json)
    expect(json.cover).toEqual({
      key: 'cover.png',
      signature: 'sig-of-cover.png'
    })
    expect(json.cover).not.toBe(file)
    expect(file).toEqual({ key: 'cover.png' })
  })
})

describe('Model._forEachAssetFile()', () => {
  it('calls the callback for each file, including files in arrays', () => {
    const model = makeFakeModel({
      cover: { storage: 'test' },
      gallery: { storage: 'test' },
      missing: { storage: 'test' }
    })
    const json = {
      cover: { key: 'cover.png' },
      gallery: [{ key: 'a.png' }, null, [{ key: 'b.png' }]]
    }
    const keys = []
    Model._forEachAssetFile.call(model, json, (file, storage) => {
      expect(storage).toBe(model.app.getStorage('test'))
      keys.push(file.key)
    })
    expect(keys).toEqual(['cover.png', 'a.png', 'b.png'])
  })

  it('does nothing for models without assets', () => {
    const callback = vi.fn()
    Model._forEachAssetFile.call(
      makeFakeModel(undefined),
      { cover: { key: 'cover.png' } },
      callback
    )
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('Model.getProperty: type inference for $ref/discriminator schemas', () => {
  function getProperty({ name, properties, definitions = {} }) {
    return Model.getProperty.call(
      { definition: { properties }, jsonSchema: { definitions } },
      name
    )
  }

  it('returns the property unchanged when it has an explicit type', () => {
    expect(
      getProperty({
        name: 'name',
        properties: { name: { type: 'string' } }
      })
    ).toEqual({ type: 'string' })
  })

  it('infers type: object from a discriminator on a $ref schema', () => {
    const property = getProperty({
      name: 'content',
      properties: { content: { $ref: '#SectionContent' } },
      definitions: {
        '#SectionContent': {
          discriminator: { propertyName: 'type' },
          oneOf: [
            { type: 'object', properties: { type: { const: 'a' } } },
            { type: 'object', properties: { type: { const: 'b' } } }
          ]
        }
      }
    })
    expect(property.type).toBe('object')
    expect(property.discriminator).toEqual({ propertyName: 'type' })
  })

  it('infers a shared type from a homogeneous oneOf', () => {
    const property = getProperty({
      name: 'content',
      properties: {
        content: { oneOf: [{ type: 'object' }, { type: 'object' }] }
      }
    })
    expect(property.type).toBe('object')
  })

  it('infers a shared type from a homogeneous anyOf', () => {
    const property = getProperty({
      name: 'content',
      properties: {
        content: { anyOf: [{ type: 'array' }, { type: 'array' }] }
      }
    })
    expect(property.type).toBe('array')
  })

  it('leaves type undefined when oneOf branches disagree', () => {
    const property = getProperty({
      name: 'content',
      properties: {
        content: { oneOf: [{ type: 'object' }, { type: 'string' }] }
      }
    })
    expect(property.type).toBeUndefined()
  })

  it('keeps $ref properties with unknown definitions unchanged', () => {
    expect(
      getProperty({
        name: 'content',
        properties: { content: { $ref: '#Missing', nullable: true } }
      })
    ).toEqual({ $ref: '#Missing', nullable: true })
  })

  it('returns null for an unknown property', () => {
    expect(getProperty({ name: 'missing', properties: {} })).toBeNull()
  })
})

describe('Model.getPropertyOrRelationAtDataPath: traversal through inferred types', () => {
  function lookup({ dataPath, properties, definitions = {} }) {
    const host = {
      definition: { properties },
      jsonSchema: { definitions },
      getRelations: () => ({}),
      getProperty(name) {
        return Model.getProperty.call(this, name)
      }
    }
    return Model.getPropertyOrRelationAtDataPath.call(host, dataPath)
  }

  it('exposes object type for a discriminator-rooted nested wildcard path', () => {
    // Reproduces the original loadDataPath() crash on
    // `content.gallery.images[**].file`: before the fix, `content` had
    // no resolved `type`, so loadDataPath rejected the nested path.
    const result = lookup({
      dataPath: 'content.gallery.images[**].file',
      properties: { content: { $ref: '#SectionContent' } },
      definitions: {
        '#SectionContent': {
          discriminator: { propertyName: 'type' },
          oneOf: [{ type: 'object' }]
        }
      }
    })
    expect(result.property.type).toBe('object')
    expect(result.nestedDataPath).toBe('gallery/images/**/file')
    expect(result.dataPath).toBe('content')
  })

  it('returns no nestedDataPath for a leaf property lookup', () => {
    const result = lookup({
      dataPath: 'name',
      properties: { name: { type: 'string' } }
    })
    expect(result.property).toEqual({ type: 'string' })
    expect(result.nestedDataPath).toBe('')
  })
})

describe('Model#$is()', () => {
  class Entry extends Model {
    static properties = {
      code: {
        type: 'string',
        primary: true
      }
    }
  }

  class Membership extends Model {
    static properties = {
      groupId: {
        type: 'integer',
        primary: true
      },
      memberId: {
        type: 'integer',
        primary: true
      }
    }
  }

  const app = new Application({
    config: { log: { silent: true } },
    models: { Entry, Membership }
  })

  beforeAll(() => app.setupModels())

  it('compares instances by a custom id column', () => {
    const entry = Entry.fromJson({ code: 'a' })
    expect(entry.$is(Entry.fromJson({ code: 'a' }))).toBe(true)
    expect(entry.$is(Entry.fromJson({ code: 'b' }))).toBe(false)
  })

  it('compares instances by a composite id', () => {
    const membership = Membership.fromJson({ groupId: 1, memberId: 2 })
    expect(
      membership.$is(Membership.fromJson({ groupId: 1, memberId: 2 }))
    ).toBe(true)
    expect(
      membership.$is(Membership.fromJson({ groupId: 1, memberId: 3 }))
    ).toBe(false)
  })

  it('never matches instances of other model classes', () => {
    class OtherEntry extends Entry {}
    const entry = Entry.fromJson({ code: 'a' })
    expect(entry.$is(Object.assign(new OtherEntry(), { code: 'a' }))).toBe(
      false
    )
    expect(entry.$is(null)).toBe(false)
  })
})

describe('Model.tableName', () => {
  it('uses the class name without a trailing Model suffix', () => {
    class Library extends Model {}
    class LibraryModel extends Model {}
    class ModelKit extends Model {}
    expect(Library.tableName).toBe('Library')
    expect(LibraryModel.tableName).toBe('Library')
    expect(ModelKit.tableName).toBe('ModelKit')
  })
})

describe('Model.idColumn', () => {
  it('falls back to id without primary properties', () => {
    class Shelf extends Model {
      static properties = { label: { type: 'string' } }
    }
    expect(Shelf.idColumn).toBe('id')
  })

  it('uses a single primary property', () => {
    class Shelf extends Model {
      static properties = { code: { type: 'string', primary: true } }
    }
    expect(Shelf.idColumn).toBe('code')
  })
})

describe('Model.getReference() and Model.isReference()', () => {
  class Member extends Model {
    static properties = {
      name: { type: 'string' },
      email: { type: 'string' }
    }
  }

  class Seat extends Model {
    static properties = {
      row: { type: 'string', primary: true },
      number: { type: 'integer', primary: true },
      label: { type: 'string' }
    }
  }

  createApp({ Member, Seat })

  it('creates references from ids', () => {
    const reference = Member.getReference(3)
    expect(reference).toBeInstanceOf(Member)
    expect({ ...reference }).toEqual({ id: 3 })
  })

  it('creates references from composite ids', () => {
    expect({ ...Seat.getReference(['B', 12]) }).toEqual({
      row: 'B',
      number: 12
    })
  })

  it('throws when the amount of ids does not match the id properties', () => {
    expect(() => Seat.getReference(12)).toThrow(ModelError)
    expect(() => Seat.getReference(12)).toThrow(
      `Model 'Seat': Invalid amount of id values provided for reference: ` +
      `Unable to map 12 to ["row","number"].`
    )
  })

  it('creates references from models, omitting other properties', () => {
    const member = Member.fromJson({ id: 1, name: 'Ada', email: 'a@b.c' })
    expect({ ...Member.getReference(member) }).toEqual({ id: 1 })
    expect({ ...Member.getReference(member, ['name', 'phone']) }).toEqual({
      id: 1,
      name: 'Ada'
    })
  })

  it('creates references from #ref objects', () => {
    expect({ ...Member.getReference({ '#ref': 'ada' }) }).toEqual({
      '#ref': 'ada'
    })
  })

  it('recognizes objects holding only ids or #ref values as references', () => {
    expect(Member.isReference({ id: 1 })).toBe(true)
    expect(Member.isReference({ '#ref': 'ada' })).toBe(true)
    expect(Seat.isReference({ row: 'B', number: 12 })).toBe(true)
    expect(Member.isReference({ id: 1, name: 'Ada' })).toBe(false)
    expect(Member.isReference({ id: 'one' })).toBe(false)
    expect(Member.isReference({ 'id': 1, '#ref': 'ada' })).toBe(false)
    expect(Member.isReference(null)).toBe(false)
  })
})

describe('Model attribute lists', () => {
  class Event extends Model {
    static properties = {
      title: { type: 'string' },
      tags: { type: 'array' },
      details: { type: 'object' },
      location: { type: 'object', specificType: 'point' },
      isPublic: { type: 'boolean' },
      day: { type: 'date' },
      startsAt: { type: 'datetime' },
      updatedAt: { type: 'timestamp' },
      secret: { type: 'string', hidden: true },
      isFull: { type: 'boolean', computed: true },
      summary: { type: 'object', computed: true },
      venue: { $ref: '#venue' }
    }

    static schema = {
      definitions: {
        '#venue': {
          type: 'object',
          properties: { name: { type: 'string' } }
        }
      }
    }
  }

  createApp({ Event })

  it('lists JSON attributes, excluding computed and specific types', () => {
    expect(Event.jsonAttributes).toEqual(['tags', 'details', 'venue'])
  })

  it('lists boolean attributes, excluding computed ones', () => {
    expect(Event.booleanAttributes).toEqual(['isPublic'])
  })

  it('lists date and datetime attributes', () => {
    expect(Event.dateAttributes).toEqual(['day'])
    expect(Event.datetimeAttributes).toEqual(['startsAt', 'updatedAt'])
  })

  it('lists computed attributes, also as virtual attributes', () => {
    expect(Event.computedAttributes).toEqual(['isFull', 'summary'])
    expect(Event.virtualAttributes).toEqual(['isFull', 'summary'])
  })

  it('lists hidden attributes', () => {
    expect(Event.hiddenAttributes).toEqual(['secret'])
  })

  it('resolves properties that reference nested definitions', () => {
    // Root-level schema additions are merged in without conversion.
    expect(Event.getProperty('venue')).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } }
    })
  })
})

describe('Model.jsonSchema', () => {
  class Author extends Model {
    static properties = {
      name: { type: 'string', required: true }
    }

    static relations = {
      books: {
        relation: 'hasMany',
        from: 'Author.id',
        to: 'Book.authorId'
      }
    }

    // Root-level schema additions are merged in deeply:
    static schema = {
      properties: {
        name: { maxLength: 40 }
      }
    }
  }

  class Book extends Model {
    static properties = {
      title: { type: 'string' }
    }
  }

  createApp({ Author, Book })

  it('uses the model name as $id', () => {
    expect(Author.jsonSchema.$id).toBe('Author')
  })

  it('includes converted properties and merged root-level schema', () => {
    const { properties, required } = Author.jsonSchema
    expect(properties.name).toEqual({
      type: 'string',
      format: 'required',
      maxLength: 40
    })
    expect(required).toEqual(['name'])
  })

  it('includes schemas for relations', () => {
    expect(Author.jsonSchema.properties.books).toEqual({
      type: 'array',
      items: { anyOf: [{ relate: 'Book' }, { $ref: 'Book' }] }
    })
  })

  it('caches the schema', () => {
    expect(Author.jsonSchema).toBe(Author.jsonSchema)
  })
})

describe('Model JSON conversion', () => {
  class Event extends Model {
    static properties = {
      title: { type: 'string' },
      day: { type: 'date', nullable: true },
      startsAt: { type: 'datetime', nullable: true },
      isPublic: { type: 'boolean' },
      secret: { type: 'string', hidden: true },
      isFull: { type: 'boolean', computed: true }
    }
  }

  createApp({ Event })

  it('parses date and datetime strings to dates', () => {
    const event = Event.fromJson({
      day: '2026-05-14',
      startsAt: '2026-05-14T10:30:00.000Z'
    })
    expect(event.day).toEqual(new Date(2026, 4, 14))
    expect(event.startsAt).toEqual(new Date('2026-05-14T10:30:00.000Z'))
  })

  it('keeps null dates when formatting', () => {
    expect(Event.fromJson({ day: null }).toJSON()).toEqual({ day: null })
  })

  it('keeps date objects and null values when parsing', () => {
    const startsAt = new Date()
    const event = Event.fromJson({ startsAt, day: null })
    expect(event.startsAt).toBe(startsAt)
    expect(event.day).toBe(null)
  })

  it('removes hidden attributes and formats plain dates', () => {
    const event = Event.fromJson({
      title: 'Reading',
      day: '2026-05-14',
      startsAt: '2026-05-14T10:30:00.000Z',
      secret: 'shh'
    })
    const json = event.toJSON()
    expect(json).not.toHaveProperty('secret')
    expect(json.day).toBe('2026-05-14')
    expect(json.startsAt).toEqual(new Date('2026-05-14T10:30:00.000Z'))
    // The model itself keeps hidden attributes and dates.
    expect(event.secret).toBe('shh')
    expect(event.day).toBeInstanceOf(Date)
  })

  it('formats dates for the database and removes computed attributes', () => {
    const event = Event.fromJson({
      day: '2026-05-14',
      startsAt: '2026-05-14T10:30:00.000Z',
      isPublic: true
    })
    event.isFull = false
    expect(event.$toDatabaseJson()).toEqual({
      day: '2026-05-14',
      startsAt: '2026-05-14T10:30:00.000Z',
      isPublic: true
    })
  })

  it('parses database JSON like regular JSON', () => {
    const event = Event.fromDatabaseJson({
      day: '2026-05-14',
      startsAt: '2026-05-14T10:30:00.000Z'
    })
    expect(event.day).toEqual(new Date(2026, 4, 14))
    expect(event.startsAt).toEqual(new Date('2026-05-14T10:30:00.000Z'))
  })

  it('converts booleans to and from integers for SQLite', () => {
    class Task extends Model {
      static properties = {
        done: { type: 'boolean' },
        title: { type: 'string' }
      }
    }
    createApp({ Task }, { client: 'sqlite3', useNullAsDefault: true })
    expect(Task.isSQLite()).toBe(true)
    expect(Task.fromJson({ done: true }).$toDatabaseJson()).toEqual({
      done: 1
    })
    expect(Task.fromJson({ done: false }).$toDatabaseJson()).toEqual({
      done: 0
    })
    expect(Task.fromJson({ title: 'x' }).$toDatabaseJson()).toEqual({
      title: 'x'
    })
    expect(Task.fromDatabaseJson({ done: 1 }).done).toBe(true)
    expect(Task.fromDatabaseJson({ done: 0 }).done).toBe(false)
    expect(Task.fromDatabaseJson({ title: 'x' })).not.toHaveProperty('done')
  })
})

describe('Model#$setJson() with $initialize()', () => {
  const initialized = []

  class Edition extends Model {
    static properties = {
      seriesKey: { type: 'string', required: true },
      title: { type: 'string' }
    }

    static relations = {
      previous: {
        relation: 'belongsTo',
        from: 'Edition.previousId',
        to: 'Edition.id'
      }
    }

    $initialize() {
      initialized.push(this.title)
      // Take over the series key from the previous edition.
      this.seriesKey ??= this.previous?.seriesKey
    }
  }

  createApp({ Edition })

  beforeEach(() => {
    initialized.length = 0
  })

  it('calls $initialize() before validating required properties', () => {
    const edition = Edition.fromJson(
      {
        title: 'Second',
        previous: { id: 1, seriesKey: 'abc', title: 'First' }
      },
      { graph: true }
    )
    expect(edition.seriesKey).toBe('abc')
    expect(initialized).toContain('Second')
  })

  it('calls $initialize() on related models', () => {
    Edition.fromJson(
      {
        title: 'Second',
        previous: { id: 1, seriesKey: 'abc', title: 'First' }
      },
      { graph: true }
    )
    expect(initialized).toEqual(['First', 'Second'])
  })

  it('still validates after calling $initialize()', () => {
    expect(() => Edition.fromJson({ title: 'Orphan' })).toThrow(
      ValidationError
    )
    expect(initialized).toEqual(['Orphan'])
  })

  it('calls $initialize() when skipping validation', () => {
    const edition = Edition.fromJson(
      { title: 'Draft' },
      { skipValidation: true }
    )
    expect(edition.seriesKey).toBeUndefined()
    expect(initialized).toEqual(['Draft'])
  })

  it('creates instances without validation in the constructor', () => {
    const edition = new Edition({ title: 'Draft' })
    expect(edition.title).toBe('Draft')
  })

  it('leaves relations unparsed with the skipParseRelations option', () => {
    const edition = Edition.fromJson(
      {
        title: 'Second',
        previous: { id: 1, seriesKey: 'abc', title: 'First' }
      },
      { skipParseRelations: true }
    )
    expect(edition.previous).not.toBeInstanceOf(Edition)
    expect(edition.seriesKey).toBe('abc')
    expect(initialized).toEqual(['Second'])
  })

  it('does not call $initialize() for patches and references', () => {
    Edition.fromJson({ title: 'Patch' }, { patch: true })
    const reference = Edition.fromJson({ id: 1 }, { skipValidation: true })
    expect(reference.id).toBe(1)
    expect(initialized).toEqual([])
  })
})

describe('Model#$validate()', () => {
  class Recipe extends Model {
    static properties = {
      title: { type: 'string', required: true },
      servings: { type: 'integer', default: 2 }
    }

    static relations = {
      ingredients: {
        relation: 'hasMany',
        from: 'Recipe.id',
        to: 'Ingredient.recipeId'
      }
    }
  }

  class Ingredient extends Model {
    static properties = {
      name: { type: 'string', required: true }
    }
  }

  createApp({ Recipe, Ingredient })

  it('returns the json unvalidated when skipping validation', () => {
    const json = { servings: 'many' }
    expect(new Recipe().$validate(json, { skipValidation: true })).toBe(json)
  })

  it('applies default values to the passed json', () => {
    const json = { title: 'Soup' }
    const result = new Recipe().$validate(json)
    expect(result).toBe(json)
    expect(json).toEqual({ title: 'Soup', servings: 2 })
  })

  it('ignores invalid relations in shallow validation', () => {
    const json = { title: 'Soup', ingredients: [{ name: 3 }] }
    expect(() => new Recipe().$validate(json)).not.toThrow()
    expect(json.ingredients).toEqual([{ name: 3 }])
  })

  it('validates relations in graph validation', async () => {
    const recipe = Recipe.fromJson(
      { title: 'Soup', ingredients: [{ name: 3 }] },
      { skipValidation: true }
    )
    await expect(recipe.$validateGraph()).rejects.toThrow(ValidationError)
  })

  it('resolves to the model when graph validation passes', async () => {
    const recipe = new Recipe({ title: 'Soup', ingredients: [] })
    await expect(recipe.$validateGraph()).resolves.toBe(recipe)
  })

  it('validates asynchronously with the async option', async () => {
    const promise = Recipe.fromJson({ title: 'Soup' }, { async: true })
    expect(promise).toBeInstanceOf(Promise)
    const recipe = await promise
    expect(recipe).toBeInstanceOf(Recipe)
    expect(recipe.servings).toBe(2)
    await expect(
      Recipe.fromJson({ title: '' }, { async: true })
    ).rejects.toThrow(ValidationError)
  })
})

describe('Model#$has() and Model#$app', () => {
  class Note extends Model {
    static properties = {
      text: { type: 'string' }
    }
  }

  const app = createApp({ Note })

  it('checks for the presence of all passed properties', () => {
    const note = new Note({ id: 1, text: undefined })
    expect(note.$has('id')).toBe(true)
    expect(note.$has('id', 'text')).toBe(true)
    expect(note.$has('id', 'title')).toBe(false)
  })

  it('exposes the app on model instances', () => {
    expect(new Note().$app).toBe(app)
  })
})

describe('Model.getPropertyOrRelationAtDataPath(): relations', () => {
  class Author extends Model {
    static properties = {
      name: { type: 'string' }
    }

    static relations = {
      books: {
        relation: 'hasMany',
        from: 'Author.id',
        to: 'Book.authorId'
      }
    }
  }

  class Book extends Model {
    static properties = {
      title: { type: 'string' }
    }

    static relations = {
      author: {
        relation: 'belongsTo',
        from: 'Book.authorId',
        to: 'Author.id'
      }
    }
  }

  createApp({ Author, Book })

  it('finds properties of related models', () => {
    const result = Book.getPropertyOrRelationAtDataPath('author.name')
    expect(result).toMatchObject({
      property: { type: 'string' },
      wildcard: null,
      name: 'name',
      dataPath: 'author/name',
      nestedDataPath: ''
    })
    expect(result.relation).toBe(Book.getRelation('author'))
  })

  it('finds properties through wildcards on to-many relations', () => {
    expect(
      Author.getPropertyOrRelationAtDataPath('books/*/title')
    ).toMatchObject({
      name: 'title',
      dataPath: 'books/*/title'
    })
  })

  it('finds relations at the end of the data path', () => {
    const result = Book.getPropertyOrRelationAtDataPath('author.books')
    expect(result.relation).toBe(Author.getRelation('books'))
    expect(result.property).toBe(null)
    expect(result.expression).toBe('author.books')
  })

  it('finds relations directly on the model', () => {
    const result = Book.getPropertyOrRelationAtDataPath('author')
    expect(result.relation).toBe(Book.getRelation('author'))
    expect(result.expression).toBe('author')
  })

  it('finds top-level wildcards', () => {
    expect(Book.getPropertyOrRelationAtDataPath('*')).toMatchObject({
      wildcard: '*',
      name: '*',
      dataPath: '*'
    })
    expect(
      Book.getPropertyOrRelationAtDataPath('**').wildcard
    ).toBe('**')
  })

  it('does not support wildcards on one-to-one relations', () => {
    expect(
      Book.getPropertyOrRelationAtDataPath('author.*.name')
    ).toMatchObject({
      property: null,
      relation: null,
      dataPath: null,
      expression: null
    })
  })

  it('throws for deep wildcards on relations', () => {
    expect(() =>
      Author.getPropertyOrRelationAtDataPath('books.**.title')
    ).toThrow(`Model 'Author': Deep wildcards on relations are unsupported.`)
  })

  it('returns empty results for unknown properties and relations', () => {
    for (const dataPath of ['publisher', 'author.publisher.name']) {
      expect(Book.getPropertyOrRelationAtDataPath(dataPath)).toMatchObject({
        property: null,
        relation: null,
        wildcard: null
      })
    }
  })
})

describe('Model.modifierNotFound(): scopes and prefixes', () => {
  class Book extends Model {
    static properties = {
      title: { type: 'string' },
      year: { type: 'integer' }
    }

    static scopes = {
      default: query => query.whereNotNull('title'),
      recent: query => query.where('year', '>', 2000)
    }
  }

  createApp({ Book })

  it('applies scopes as modifiers', () => {
    expect(toSQL(Book.query().modify('recent'))).toBe(
      'select "Book".* from "Book" where "Book"."year" > $1'
    )
  })

  it('applies eager-scopes prefixed with ^', () => {
    expect(toSQL(Book.query().modify('^recent'))).toBe(
      'select "Book".* from "Book" where "Book"."year" > $1'
    )
  })

  it('selects columns prefixed with @', () => {
    expect(toSQL(Book.query().modify('@title'))).toBe(
      'select "Book"."title" from "Book"'
    )
  })

  it('selects all columns with *', () => {
    expect(toSQL(Book.query().modify('@title').modify('*'))).toBe(
      'select "Book"."title", "Book".* from "Book"'
    )
  })

  it('omits columns prefixed with ~ from the JSON', () => {
    const query = Book.query().modify('~title')
    expect(toSQL(query)).toBe('select "Book".* from "Book"')
  })

  it('ignores scopes prefixed with !', () => {
    const query = Book.query().modify('!recent').applyScope('recent')
    expect(toSQL(query)).toBe('select "Book".* from "Book"')
  })

  it('supports the deprecated - and # prefixes', () => {
    const deprecations = []
    const warn = vi
      .spyOn(console, 'warn')
      .mockImplementation(message => deprecations.push(message))
    try {
      expect(toSQL(Book.query().modify('#title'))).toBe(
        'select "Book"."title" from "Book"'
      )
      const query = Book.query().modify('-recent').applyScope('recent')
      expect(toSQL(query)).toBe('select "Book".* from "Book"')
    } finally {
      warn.mockRestore()
    }
  })

  it('throws for unknown modifiers', () => {
    expect(() => Book.query().modify('popular')).toThrow(
      /Unable to determine modify function from provided value: "popular"/
    )
    expect(() => Book.query().modify('*title')).toThrow(
      /Unable to determine modify function/
    )
  })

  it('throws for modifiers that are neither strings nor functions', () => {
    expect(() => Book.query().modify(42)).toThrow(
      /Unable to determine modify function from provided value/
    )
  })
})

describe('Model error factories', () => {
  class Book extends Model {}

  const app = createApp({ Book })

  it('creates not-found errors with and without ids', () => {
    const byId = Book.createNotFoundError({ byId: 7 })
    expect(byId).toBeInstanceOf(NotFoundError)
    expect(byId.message).toBe(`'Book' model with id 7 not found`)
    expect(Book.createNotFoundError({}).message).toBe(
      `'Book' model not found`
    )
    expect(Book.createNotFoundError({}, 'Gone').message).toBe('Gone')
    expect(
      Book.createNotFoundError({ byId: 7 }, { message: 'Gone' }).message
    ).toBe('Gone')
    expect(
      Book.createNotFoundError({ byId: 7 }, new Error('Gone')).message
    ).toBe('Gone')
    expect(Book.createNotFoundError({ byId: 7 }, {}).message).toBe(
      `'Book' model with id 7 not found`
    )
  })

  it('creates model validation errors with a default message', () => {
    const error = Book.createValidationError({
      type: 'ModelValidation',
      errors: [
        {
          instancePath: '/title',
          keyword: 'type',
          message: 'must be string',
          params: {}
        }
      ]
    })
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe(
      'The provided data for the Book model is not valid'
    )
    expect(error.data.errors).toEqual({
      title: [{ keyword: 'type', message: 'must be string', params: {} }]
    })
  })

  it('creates relation, graph and generic errors by type', () => {
    const create = type =>
      Book.createValidationError({ type, message: type, errors: [] })
    expect(create('RelationExpression')).toBeInstanceOf(RelationError)
    expect(create('UnallowedRelation')).toBeInstanceOf(RelationError)
    expect(create('InvalidGraph')).toBeInstanceOf(GraphError)
    const generic = create('Other')
    expect(generic).toBeInstanceOf(ResponseError)
    expect(generic.message).toBe('Other')
  })

  it('uses the shared app validator', () => {
    expect(Book.createValidator()).toBe(app.validator)
  })
})

describe('Model.transaction()', () => {
  class Book extends Model {}

  createApp({ Book })

  it('runs handlers with a passed transaction', async () => {
    const trx = {}
    const handler = vi.fn(async () => 'done')
    expect(await Book.transaction(trx, handler)).toBe('done')
    expect(handler).toHaveBeenCalledWith(trx)
    const book = new Book()
    expect(await book.$transaction(trx, handler)).toBe('done')
  })

  it('limits concurrency to one inside transactions', () => {
    expect(Book.getConcurrency({ isTransaction: true })).toBe(1)
    expect(Book.getConcurrency(Book.knex())).toBeGreaterThan(1)
  })
})

describe('Model relation accessors', () => {
  class Team extends Model {
    static properties = {
      name: { type: 'string' }
    }

    static relations = {
      members: {
        relation: 'manyToMany',
        from: 'Team.id',
        to: 'Member.id'
      },
      captain: {
        relation: 'belongsTo',
        from: 'Team.captainId',
        to: 'Member.id'
      }
    }
  }

  class Member extends Model {
    static properties = {
      name: { type: 'string' }
    }
  }

  createApp({ Team, Member })

  it('exposes cached relation accessors on the class', () => {
    const accessor = Team.$members
    expect(accessor).toBeInstanceOf(RelationAccessor)
    expect(accessor.name).toBe('members')
    expect(accessor.relation).toBe(Team.getRelation('members'))
    expect(accessor.modelClass).toBe(Team)
    expect(accessor.model).toBe(null)
    expect(Team.$members).toBe(accessor)
  })

  it('exposes cached relation accessors on instances', () => {
    const team = new Team({ id: 1 })
    const accessor = team.$captain
    expect(accessor.model).toBe(team)
    expect(accessor.modelClass).toBe(null)
    expect(team.$captain).toBe(accessor)
    expect(new Team({ id: 2 }).$captain).not.toBe(accessor)
    expect(Object.keys(team)).not.toContain('$captain')
  })

  it('creates related queries for instances', () => {
    const query = new Team({ id: 1, captainId: 5 }).$captain.query()
    expect(toSQL(query)).toBe(
      'select "Member".* from "Member" where "Member"."id" in ($1)'
    )
  })

  it('creates related queries for the class', () => {
    const query = Team.$members.query().for(1)
    expect(toSQL(query)).toMatch(
      /^select "members"\.\* from "Member" as "members" inner join "TeamMember"/
    )
  })

  it('exposes query builder methods on accessors', () => {
    const team = new Team({ id: 1, captainId: 5 })
    expect(toSQL(team.$captain.where('name', 'Ada'))).toBe(
      'select "Member".* from "Member" ' +
      'where "Member"."id" in ($1) and "Member"."name" = $2'
    )
  })

  it('exposes join model classes with query builder methods', () => {
    const { joinModelClass } = Team.$members
    expect(joinModelClass.tableName).toBe('TeamMember')
    expect(typeof joinModelClass.where).toBe('function')
    expect(Team.$members.joinModelClass).toBe(joinModelClass)
    expect(Team.$captain.joinModelClass).toBe(null)
  })

  it('throws when relation accessors clash with existing properties', () => {
    class Club extends Model {
      static relations = {
        members: {
          relation: 'hasMany',
          from: 'Club.id',
          to: 'Person.clubId'
        }
      }

      get $members() {
        return []
      }
    }

    class Person extends Model {}

    let error
    try {
      createApp({ Club, Person })
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(RelationError)
    expect(error.message).toBe(
      `Model 'Club' already defines a property with name '$members' that ` +
      `clashes with the relation accessor.`
    )
  })

  it('wraps errors of relations to plain Objection.js models', () => {
    class Member extends objection.Model {
      static tableName = 'Member'
    }
    class Club extends Model {
      static relations = {
        members: {
          relation: objection.Model.HasManyRelation,
          modelClass: Member,
          join: { from: 'Club.id', to: 'Member.clubId' }
        }
      }
    }

    let error
    try {
      createApp({ Club })
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(RelationError)
    expect(error.message).toMatch(/getRelatedRelations is not a function/)
  })

  it('wraps relation configuration errors in relation errors', () => {
    class Club extends Model {
      static relations = {
        members: {
          relation: 'hasMany',
          from: 'Club.id',
          to: 'Person.clubId'
        }
      }
    }

    let error
    try {
      createApp({ Club })
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(RelationError)
    expect(error.message).toBe(
      'Club.relations.members: Unknown model reference: Person.clubId'
    )
  })
})

describe('Model.query()', () => {
  class Book extends Model {}

  createApp({ Book })

  it('creates Dito.js query builders', () => {
    expect(Book.query().constructor).toBe(Book.QueryBuilder)
    expect(Book.useLimitInFirst).toBe(true)
    expect(objection.Model.isPrototypeOf(Book)).toBe(true)
  })
})
