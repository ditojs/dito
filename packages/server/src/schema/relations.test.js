import {
  BelongsToOneRelation,
  HasOneRelation,
  HasOneThroughRelation,
  HasManyRelation,
  ManyToManyRelation
} from 'objection'
import { Model } from '../models/index.js'
import {
  getRelationClass,
  convertRelation,
  convertRelations,
  addRelationSchemas
} from './relations.js'

describe('getRelationClass()', () => {
  it('returns the corresponding relation classes', () => {
    expect(getRelationClass('belongs-to')).toBe(BelongsToOneRelation)
    expect(getRelationClass('has-one')).toBe(HasOneRelation)
    expect(getRelationClass('has-one-through')).toBe(HasOneThroughRelation)
    expect(getRelationClass('has-many')).toBe(HasManyRelation)
    expect(getRelationClass('many-to-many')).toBe(ManyToManyRelation)

    expect(getRelationClass('belongsTo')).toBe(BelongsToOneRelation)
    expect(getRelationClass('hasOne')).toBe(HasOneRelation)
    expect(getRelationClass('hasOneThrough')).toBe(HasOneThroughRelation)
    expect(getRelationClass('hasMany')).toBe(HasManyRelation)
    expect(getRelationClass('manyToMany')).toBe(ManyToManyRelation)

    expect(getRelationClass('BelongsToOneRelation')).toBe(BelongsToOneRelation)
    expect(getRelationClass('HasOneRelation')).toBe(HasOneRelation)
    expect(getRelationClass('HasOneThroughRelation'))
      .toBe(HasOneThroughRelation)
    expect(getRelationClass('HasManyRelation')).toBe(HasManyRelation)
    expect(getRelationClass('ManyToManyRelation')).toBe(ManyToManyRelation)
  })
})

describe('convertRelation()', () => {
  class ModelOne extends Model {}
  class ModelTwo extends Model {}

  const models = { ModelOne, ModelTwo }

  it('converts a belongs-to relation to Objection.js format', () => {
    expect(
      convertRelation(
        {
          relation: 'belongs-to',
          from: 'ModelOne.modelTwoId',
          to: 'ModelTwo.id',
          modify: 'myScope'
        },
        models
      )
    ).toEqual({
      relation: BelongsToOneRelation,
      modelClass: ModelTwo,
      join: {
        from: 'ModelOne.modelTwoId',
        to: 'ModelTwo.id'
      },
      modify: 'myScope'
    })
  })

  it('converts a many-to-many relation to Objection.js format', () => {
    expect(
      convertRelation(
        {
          relation: 'many-to-many',
          from: 'ModelOne.id',
          to: 'ModelTwo.id',
          inverse: false
        },
        models
      )
    ).toEqual({
      relation: ManyToManyRelation,
      modelClass: ModelTwo,
      join: {
        from: 'ModelOne.id',
        through: {
          from: 'ModelOneModelTwo.modelOneId',
          to: 'ModelOneModelTwo.modelTwoId'
        },
        to: 'ModelTwo.id'
      }
    })
  })

  it('converts an inverse many-to-many relation to Objection.js format', () => {
    expect(
      convertRelation(
        {
          relation: 'many-to-many',
          from: 'ModelTwo.id',
          to: 'ModelOne.id',
          inverse: true
        },
        models
      )
    ).toEqual({
      relation: ManyToManyRelation,
      modelClass: ModelOne,
      join: {
        from: 'ModelTwo.id',
        through: {
          from: 'ModelOneModelTwo.modelTwoId',
          to: 'ModelOneModelTwo.modelOneId'
        },
        to: 'ModelOne.id'
      }
    })
  })

  it('preserves Objection.js relation format', () => {
    const relation = {
      relation: BelongsToOneRelation,
      modelClass: ModelTwo,
      join: {
        from: 'ModelOne.modelTwoId',
        to: 'ModelTwo.id'
      },
      modify: 'myScope'
    }
    expect(convertRelation(relation, models)).toEqual(relation)
  })
})

describe('addRelationSchemas()', () => {
  class ModelOne extends Model {
    static relations = {
      modelTwo: {
        relation: 'belongs-to',
        from: 'ModelOne.modelTwoId',
        to: 'ModelTwo.id'
      }
    }
  }

  class ModelTwo extends Model {
    static relations = {
      modelOnes: {
        relation: 'has-many',
        from: 'ModelTwo.id',
        to: 'ModelOne.modelTwoId',
        owner: true
      }
    }
  }

  // Add a mock app to both, to expose models:
  ModelOne.app = ModelTwo.app = {
    models: { ModelOne, ModelTwo }
  }

  it('adds correct property schema for a belongs-to relation', () => {
    expect(addRelationSchemas(ModelOne, {})).toEqual({
      modelTwo: {
        anyOf: [
          { type: 'null' },
          { relate: 'ModelTwo' },
          { $ref: 'ModelTwo' }
        ]
      }
    })
  })

  it('adds correct property schema for a has-many owner relation', () => {
    expect(addRelationSchemas(ModelTwo, {})).toEqual({
      modelOnes: {
        type: 'array',
        items: { $ref: 'ModelOne' }
      }
    })
  })
})

describe('convertRelation(): Dito.js-style options', () => {
  class Author extends Model {}
  class Book extends Model {}
  class Genre extends Model {}
  class BookGenre extends Model {}
  class Edition extends Model {}

  const models = { Author, Book, Genre, BookGenre, Edition }

  function createQuery() {
    const calls = []
    const query = {
      calls,
      find: object => calls.push(['find', object]),
      applyScope: (...args) => calls.push(['applyScope', ...args]),
      applyFilter: filter => calls.push(['applyFilter', filter]),
      modify: modifier => {
        calls.push(['modify'])
        modifier(query)
      }
    }
    return query
  }

  it('accepts camel-cased, hyphenated and class names of relations', () => {
    for (const relation of ['hasMany', 'has-many', 'HasManyRelation']) {
      expect(
        convertRelation(
          { relation, from: 'Author.id', to: 'Book.authorId' },
          models
        ).relation
      ).toBe(HasManyRelation)
    }
  })

  it('accepts relation classes', () => {
    expect(
      convertRelation(
        { relation: HasOneRelation, from: 'Book.id', to: 'Edition.bookId' },
        models
      )
    ).toEqual({
      relation: HasOneRelation,
      modelClass: Edition,
      join: { from: 'Book.id', to: 'Edition.bookId' }
    })
  })

  it('throws for unrecognized relations', () => {
    expect(() =>
      convertRelation(
        { relation: 'hasSome', from: 'Author.id', to: 'Book.authorId' },
        models
      )
    ).toThrow('Unrecognized relation: hasSome')
    expect(() => convertRelation(null, models)).toThrow(
      'Unrecognized relation: undefined'
    )
  })

  it('throws for references to unknown models', () => {
    expect(() =>
      convertRelation(
        { relation: 'hasMany', from: 'Author.id', to: 'Novel.authorId' },
        models
      )
    ).toThrow('Unknown model reference: Novel.authorId')
  })

  it('throws for composite keys across different models', () => {
    expect(() =>
      convertRelation(
        {
          relation: 'belongsTo',
          from: ['Book.authorId', 'Edition.authorId'],
          to: 'Author.id'
        },
        models
      )
    ).toThrow(
      'Composite keys need to be defined on the same table: Edition.authorId'
    )
  })

  it('supports composite keys', () => {
    expect(
      convertRelation(
        {
          relation: 'hasMany',
          from: ['Book.id', 'Book.language'],
          to: ['Edition.bookId', 'Edition.language']
        },
        models
      ).join
    ).toEqual({
      from: ['Book.id', 'Book.language'],
      to: ['Edition.bookId', 'Edition.language']
    })
  })

  it('auto-generates through joins for composite keys', () => {
    expect(
      convertRelation(
        {
          relation: 'manyToMany',
          from: ['Book.id', 'Book.language'],
          to: ['Genre.id', 'Genre.language']
        },
        models
      ).join
    ).toEqual({
      from: ['Book.id', 'Book.language'],
      through: {
        from: ['BookGenre.bookId', 'BookGenre.bookLanguage'],
        to: ['BookGenre.genreId', 'BookGenre.genreLanguage']
      },
      to: ['Genre.id', 'Genre.language']
    })
  })

  it('auto-generates through joins for has-one-through relations', () => {
    expect(
      convertRelation(
        { relation: 'hasOneThrough', from: 'Book.id', to: 'Genre.id' },
        models
      )
    ).toEqual({
      relation: HasOneThroughRelation,
      modelClass: Genre,
      join: {
        from: 'Book.id',
        through: {
          from: 'BookGenre.bookId',
          to: 'BookGenre.genreId'
        },
        to: 'Genre.id'
      }
    })
  })

  it('throws when composite keys of through joins differ in length', () => {
    expect(() =>
      convertRelation(
        {
          relation: 'manyToMany',
          from: ['Book.id', 'Book.language'],
          to: 'Genre.id'
        },
        models
      )
    ).toThrow(
      'Unable to create through join for composite keys from ' +
      `'[Book.id, Book.language]' to 'Genre.id'`
    )
  })

  it('throws when references of through joins lack a property name', () => {
    expect(() =>
      convertRelation(
        { relation: 'manyToMany', from: 'Book', to: 'Genre.id' },
        models
      )
    ).toThrow(/Unable to create through join from/)
  })

  it('extracts the join model class from through model references', () => {
    expect(
      convertRelation(
        {
          relation: 'manyToMany',
          from: 'Book.id',
          to: 'Genre.id',
          through: {
            from: 'BookGenre.bookId',
            to: 'BookGenre.genreId',
            extra: ['position']
          }
        },
        models
      ).join.through
    ).toEqual({
      modelClass: BookGenre,
      from: 'BookGenre.bookId',
      to: 'BookGenre.genreId',
      extra: ['position']
    })
  })

  it('keeps through references to join tables without models unmodified', () => {
    const through = {
      from: 'book_genres.book_id',
      to: 'book_genres.genre_id'
    }
    expect(
      convertRelation(
        { relation: 'manyToMany', from: 'Book.id', to: 'Genre.id', through },
        models
      ).join.through
    ).toEqual({
      from: 'book_genres.book_id',
      to: 'book_genres.genre_id'
    })
  })

  it('throws when through references point to different join models', () => {
    expect(() =>
      convertRelation(
        {
          relation: 'manyToMany',
          from: 'Book.id',
          to: 'Genre.id',
          through: { from: 'BookGenre.bookId', to: 'Edition.genreId' }
        },
        models
      )
    ).toThrow(
      'Both sides of the `through` definition need to be on the same join model'
    )
  })

  it('throws when through joins lack from or to definitions', () => {
    expect(() =>
      convertRelation(
        {
          relation: 'manyToMany',
          from: 'Book.id',
          to: 'Genre.id',
          through: { from: 'BookGenre.bookId' }
        },
        models
      )
    ).toThrow('The relation needs a `through.from` and `through.to` definition')
  })

  it('throws for through joins on relations that do not support them', () => {
    expect(() =>
      convertRelation(
        {
          relation: 'hasMany',
          from: 'Author.id',
          to: 'Book.authorId',
          through: { from: 'BookGenre.bookId', to: 'BookGenre.genreId' }
        },
        models
      )
    ).toThrow('Unsupported through join definition')
  })

  it('resolves model classes provided by name', () => {
    expect(
      convertRelation(
        {
          relation: 'hasMany',
          modelClass: 'Edition',
          from: 'Author.id',
          to: 'Book.authorId'
        },
        models
      ).modelClass
    ).toBe(Edition)
  })

  it('throws for unknown model classes provided by name', () => {
    expect(() =>
      convertRelation(
        {
          relation: 'hasMany',
          modelClass: 'Novel',
          from: 'Author.id',
          to: 'Book.authorId'
        },
        models
      )
    ).toThrow('Unknown model class: Novel')
  })

  it('omits Dito.js-only settings from the converted relation', () => {
    expect(
      convertRelation(
        {
          relation: 'belongsTo',
          from: 'Book.authorId',
          to: 'Author.id',
          nullable: true,
          owner: true,
          inverse: false
        },
        models
      )
    ).toEqual({
      relation: BelongsToOneRelation,
      modelClass: Author,
      join: { from: 'Book.authorId', to: 'Author.id' }
    })
  })

  it('converts find-filter objects in modify to find() calls', () => {
    const { modify } = convertRelation(
      {
        relation: 'hasMany',
        from: 'Author.id',
        to: 'Book.authorId',
        modify: { order: 'title' }
      },
      models
    )
    const query = createQuery()
    modify(query)
    expect(query.calls).toEqual([['find', { order: 'title' }]])
  })

  it('treats filter functions as modify functions', () => {
    const filter = query => query.find({ limit: 1 })
    expect(
      convertRelation(
        {
          relation: 'hasMany',
          from: 'Author.id',
          to: 'Book.authorId',
          filter
        },
        models
      ).modify
    ).toBe(filter)
  })

  it('prefers modify over filter functions', () => {
    const modify = () => {}
    expect(
      convertRelation(
        {
          relation: 'hasMany',
          from: 'Author.id',
          to: 'Book.authorId',
          modify,
          filter: () => {}
        },
        models
      ).modify
    ).toBe(modify)
  })

  it('applies scopes before the modify function', () => {
    const { modify } = convertRelation(
      {
        relation: 'hasMany',
        from: 'Author.id',
        to: 'Book.authorId',
        scope: ['published', 'recent'],
        modify: query => query.find({ order: 'title' })
      },
      models
    )
    const query = createQuery()
    modify(query)
    expect(query.calls).toEqual([
      // `false` allows scopes regardless of the query's allowed scopes.
      ['applyScope', 'published', 'recent', false],
      ['modify'],
      ['find', { order: 'title' }]
    ])
  })

  it('applies scopes without a modify function', () => {
    const { modify } = convertRelation(
      {
        relation: 'hasMany',
        from: 'Author.id',
        to: 'Book.authorId',
        scope: 'published'
      },
      models
    )
    const query = createQuery()
    modify(query)
    expect(query.calls).toEqual([['applyScope', 'published', false]])
  })

  it('applies named filters before scopes and modify', () => {
    const { modify } = convertRelation(
      {
        relation: 'hasMany',
        from: 'Author.id',
        to: 'Book.authorId',
        filter: { publishedAfter: [2000] },
        scope: 'published'
      },
      models
    )
    const query = createQuery()
    modify(query)
    expect(query.calls).toEqual([
      ['applyFilter', { publishedAfter: [2000] }],
      ['modify'],
      ['applyScope', 'published', false]
    ])
  })

  it('applies named filters without a modify function', () => {
    const { modify } = convertRelation(
      {
        relation: 'hasMany',
        from: 'Author.id',
        to: 'Book.authorId',
        filter: 'recent'
      },
      models
    )
    const query = createQuery()
    modify(query)
    expect(query.calls).toEqual([['applyFilter', 'recent']])
  })
})

describe('convertRelations()', () => {
  class Author extends Model {}
  class Book extends Model {}

  it('converts all relations by name', () => {
    const converted = convertRelations(
      Author,
      {
        books: { relation: 'hasMany', from: 'Author.id', to: 'Book.authorId' }
      },
      { Author, Book }
    )
    expect(Object.keys(converted)).toEqual(['books'])
    expect(converted.books.relation).toBe(HasManyRelation)
  })

  it('prefixes errors with the owner model and relation name', () => {
    expect(() =>
      convertRelations(
        Author,
        {
          books: { relation: 'hasMany', from: 'Author.id', to: 'Novel.id' }
        },
        { Author, Book }
      )
    ).toThrow('Author.relations.books: Unknown model reference: Novel.id')
  })
})

describe('addRelationSchemas(): one-to-one owner relations', () => {
  class Profile extends Model {}

  class Member extends Model {
    static relations = {
      profile: {
        relation: 'hasOne',
        from: 'Member.id',
        to: 'Profile.memberId',
        owner: true
      }
    }
  }

  Member.app = Profile.app = {
    models: { Member, Profile }
  }

  it('allows null and the model, but no references', () => {
    expect(addRelationSchemas(Member, {})).toEqual({
      profile: {
        anyOf: [{ type: 'null' }, { $ref: 'Profile' }]
      }
    })
  })
})
