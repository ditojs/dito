import { Application } from '../../app/Application.js'
import { ModelError, ValidationError } from '../../errors/index.js'
import { Model } from '../Model.js'

// Uses the PostgreSQL dialect without a connection, to compile queries to SQL.
function createApp(models) {
  return new Application({
    config: {
      log: { silent: true },
      knex: { client: 'pg' }
    },
    models
  })
}

function toSQL(query) {
  const { sql, bindings } = query.toKnexQuery().toSQL().toNative()
  return { sql, bindings }
}

describe('definition.scopes', () => {
  class Item extends Model {
    static properties = {
      title: { type: 'string' },
      year: { type: 'integer' },
      archived: { type: 'boolean' }
    }

    static scopes = {
      default: query => query.where('archived', false),
      recent: query => query.where('year', '>', 2000),
      // Object scopes are applied as find-filters:
      ordered: { order: 'title desc' }
    }
  }

  class Book extends Item {
    static scopes = {
      // Extend the inherited scope by applying it first.
      default: (query, applyParentScope) =>
        applyParentScope(query).whereNotNull('title'),
      // Override the inherited scope without applying it.
      recent: query => query.where('year', '>', 2020)
    }
  }

  class Pamphlet extends Model {
    static properties = {
      title: { type: 'string' }
    }

    static scopes = {
      default: (query, applyParentScope) => applyParentScope(query)
    }
  }

  createApp({ Item, Book, Pamphlet })

  it('applies function scopes', () => {
    expect(toSQL(Item.query().applyScope('recent'))).toEqual({
      sql: 'select "Item".* from "Item" where "Item"."year" > $1',
      bindings: [2000]
    })
  })

  it('applies object scopes as find-filters', () => {
    expect(toSQL(Item.query().applyScope('ordered')).sql).toBe(
      'select "Item".* from "Item" order by "Item"."title" desc'
    )
  })

  it('inherits scopes from parent classes', () => {
    expect(Book.hasScope('ordered')).toBe(true)
    expect(Book.getScope('ordered')).not.toBe(Item.getScope('ordered'))
    expect(toSQL(Book.query().applyScope('ordered')).sql).toBe(
      'select "Book".* from "Book" order by "Book"."title" desc'
    )
  })

  it('lets scopes apply the parent scope of the same name', () => {
    expect(toSQL(Book.query().applyScope('default'))).toEqual({
      sql: (
        'select "Book".* from "Book" ' +
        'where "Book"."archived" = $1 and "Book"."title" is not null'
      ),
      bindings: [false]
    })
  })

  it('lets scopes override parent scopes of the same name', () => {
    expect(toSQL(Book.query().applyScope('recent')).bindings).toEqual([2020])
  })

  it('throws when applying an undefined parent scope', () => {
    expect(() => Pamphlet.query().applyScope('default')).toThrow(ModelError)
    expect(() => Pamphlet.query().applyScope('default')).toThrow(
      `Model 'Pamphlet': Undefined parent scope: 'default'`
    )
  })

  it('reports whether scopes are defined', () => {
    expect(Item.hasScope('recent')).toBe(true)
    expect(Item.hasScope('popular')).toBe(false)
    expect(Item.getScope('popular')).toBeUndefined()
  })

  it('throws for scopes that are neither functions nor objects', () => {
    class Shelf extends Model {
      static scopes = {
        broken: 'title'
      }
    }
    createApp({ Shelf })
    expect(() => Shelf.definition.scopes).toThrow(
      `Model 'Shelf': Invalid scope 'broken': title.`
    )
  })
})

describe('definition.filters', () => {
  class Book extends Model {
    static properties = {
      title: { type: 'string' },
      subtitle: { type: 'string' },
      year: { type: 'integer' },
      publishedAt: { type: 'datetime' }
    }

    static filters = {
      // Plain function filters receive the arguments unmodified.
      decade(query, decade) {
        query.whereBetween('year', [decade, decade + 9])
      },
      // Object filters with parameters receive the coerced values as object.
      publishedAfter: {
        parameters: {
          year: { type: 'integer', required: true }
        },
        handler(query, { year }) {
          query.where('year', '>', year)
        }
      },
      // Query filters with multiple properties combine them with OR.
      text: {
        filter: 'text',
        properties: ['title', 'subtitle']
      },
      // Query filters without properties use the filter's name as property.
      title: {
        filter: 'text'
      },
      publishedAt: {
        filter: 'date-range'
      }
    }
  }

  function between(query, from, to) {
    query.whereBetween('year', [from, to])
  }
  between.parameters = [
    { name: 'from', type: 'integer' },
    { name: 'to', type: 'integer' }
  ]

  class Novel extends Book {
    static filters = {
      between
    }
  }

  createApp({ Book, Novel })

  it('applies function filters with the passed arguments', () => {
    expect(toSQL(Book.query().applyFilter('decade', 1990))).toEqual({
      sql: 'select "Book".* from "Book" where ("Book"."year" between $1 and $2)',
      bindings: [1990, 1999]
    })
  })

  it('coerces parameters and passes them as object', () => {
    expect(
      toSQL(Book.query().applyFilter('publishedAfter', '2001')).bindings
    ).toEqual([2001])
  })

  it('coerces list parameters and passes them as separate arguments', () => {
    expect(
      toSQL(Novel.query().applyFilter('between', '1950', '1960')).bindings
    ).toEqual([1950, 1960])
  })

  it('throws validation errors for invalid filter parameters', () => {
    let error
    try {
      // Filters are applied lazily, when the query is built.
      toSQL(Book.query().applyFilter('publishedAfter', 'last year'))
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe(
      `The provided data for query filter 'publishedAfter' is not valid`
    )
    expect(error.data.type).toBe('FilterValidation')
    expect(Object.keys(error.data.errors)).toEqual(['publishedAfter/year'])
  })

  it('applies text query filters to all listed properties', () => {
    expect(
      toSQL(Book.query().applyFilter('text', 'starts-with', 'Dune'))
    ).toEqual({
      sql: (
        'select "Book".* from "Book" where ' +
        '(("Book"."title" ilike $1) or ("Book"."subtitle" ilike $2))'
      ),
      bindings: ['Dune%', 'Dune%']
    })
  })

  it('applies text query filters to the property named like the filter', () => {
    expect(toSQL(Book.query().applyFilter('title', 'Dune'))).toEqual({
      sql: 'select "Book".* from "Book" where ("Book"."title" ilike $1)',
      bindings: ['%Dune%']
    })
  })

  it('applies date-range query filters', () => {
    const { sql, bindings } = toSQL(
      Book.query().applyFilter(
        'publishedAt',
        '2020-01-01T00:00:00Z',
        '2020-12-31T00:00:00Z'
      )
    )
    expect(sql).toBe(
      'select "Book".* from "Book" ' +
      'where ("Book"."publishedAt" between $1 and $2)'
    )
    expect(bindings).toEqual([
      new Date('2020-01-01T00:00:00Z'),
      new Date('2020-12-31T00:00:00Z')
    ])
  })

  it('inherits filters from parent classes', () => {
    expect(Object.keys(Novel.definition.filters).toSorted()).toEqual([
      'between',
      'decade',
      'publishedAfter',
      'publishedAt',
      'text',
      'title'
    ])
  })

  it('throws for unknown query filter types', () => {
    class Shelf extends Model {
      static filters = {
        label: { filter: 'fuzzy' }
      }
    }
    createApp({ Shelf })
    expect(() => Shelf.definition.filters).toThrow(
      `Model 'Shelf': Invalid filter 'label': Unknown filter type 'fuzzy'.`
    )
  })

  it('throws for filter definitions without a handler', () => {
    class Shelf extends Model {
      static filters = {
        label: 'title'
      }
    }
    createApp({ Shelf })
    expect(() => Shelf.definition.filters).toThrow(
      `Model 'Shelf': Invalid filter 'label': Unrecognized definition: title.`
    )
  })
})

describe('definition.properties', () => {
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
      title: { type: 'string' },
      // Explicit definitions of foreign keys are kept as they are:
      editorId: { type: 'string', foreign: true }
    }

    static relations = {
      publisher: {
        relation: 'belongsTo',
        from: 'Book.publisherId',
        to: 'Publisher.code',
        nullable: true
      },
      editor: {
        relation: 'belongsTo',
        from: 'Book.editorId',
        to: 'Author.id'
      }
    }
  }

  class Publisher extends Model {
    static properties = {
      code: { type: 'string', primary: true },
      name: { type: 'string' }
    }
  }

  class Membership extends Model {
    static properties = {
      role: { type: 'string' },
      teamId: { type: 'integer', primary: true },
      memberId: { type: 'integer', primary: true }
    }
  }

  createApp({ Author, Book, Publisher, Membership })

  it('adds a primary id property', () => {
    expect(Author.definition.properties.id).toEqual({
      type: 'integer',
      primary: true
    })
  })

  it('adds foreign key properties for owned relations', () => {
    expect(Book.definition.properties.publisherId).toEqual({
      type: 'integer',
      unsigned: true,
      foreign: true,
      index: true,
      nullable: true
    })
  })

  it('adds foreign key properties for relations of other models', () => {
    // `Author.books` stores `authorId` in `Book`:
    expect(Book.definition.properties.authorId).toEqual({
      type: 'integer',
      unsigned: true,
      foreign: true,
      index: true
    })
  })

  it('keeps explicitly defined id properties', () => {
    expect(Book.definition.properties.editorId).toEqual({
      type: 'string',
      foreign: true
    })
    expect(Publisher.definition.properties.code).toEqual({
      type: 'string',
      primary: true
    })
    expect(Publisher.definition.properties).not.toHaveProperty('id')
  })

  it('adds string properties for #id and #ref references', () => {
    expect(Author.definition.properties['#id']).toEqual({ type: 'string' })
    expect(Author.definition.properties['#ref']).toEqual({ type: 'string' })
  })

  it('sorts primary ids first, then foreign ids, then the rest', () => {
    expect(Object.keys(Book.definition.properties)).toEqual([
      'id',
      'editorId',
      'publisherId',
      'authorId',
      'title',
      '#id',
      '#ref'
    ])
  })

  it('keeps the order of composite primary ids', () => {
    expect(Object.keys(Membership.definition.properties)).toEqual([
      'memberId',
      'teamId',
      'role',
      '#id',
      '#ref'
    ])
    expect(Membership.idColumn).toEqual(['teamId', 'memberId'])
  })
})

describe('definition inheritance', () => {
  // An abstract base class providing relations through a getter, so that they
  // can be defined in terms of the concrete sub-class.
  class Versioned extends Model {
    static get relations() {
      return {
        previous: {
          relation: 'belongsTo',
          from: `${this.name}.previousId`,
          to: `${this.name}.id`
        },
        next: {
          relation: 'hasOne',
          from: `${this.name}.id`,
          to: `${this.name}.previousId`
        }
      }
    }

    static properties = {
      seriesKey: { type: 'string' }
    }

    static modifiers = {
      latestFirst: query => query.orderBy('id', 'desc')
    }

    static options = {
      versioned: true,
      label: 'Version'
    }
  }

  class Manual extends Versioned {
    static properties = {
      title: { type: 'string' }
    }

    static modifiers = {
      titled: query => query.whereNotNull('title')
    }

    static options = {
      label: 'Manual'
    }
  }

  createApp({ Manual })

  it('creates relations for the sub-class through getters', () => {
    const relations = Manual.definition.relations
    expect(relations.previous).toEqual({
      relation: 'belongsTo',
      from: 'Manual.previousId',
      to: 'Manual.id'
    })
    expect(Manual.getRelation('next').relatedModelClass).toBe(Manual)
  })

  it('merges properties from base class to sub-class', () => {
    expect(Object.keys(Manual.definition.properties)).toEqual([
      'id',
      'previousId',
      'seriesKey',
      'title',
      '#id',
      '#ref'
    ])
  })

  it('merges modifiers and exposes them through getModifiers()', () => {
    expect(Object.keys(Manual.getModifiers())).toEqual([
      'latestFirst',
      'titled'
    ])
    expect(
      toSQL(Manual.query().modify('titled').modify('latestFirst')).sql
    ).toBe(
      'select "Manual".* from "Manual" ' +
      'where "Manual"."title" is not null order by "Manual"."id" desc'
    )
  })

  it('merges options with sub-class values taking precedence', () => {
    expect(Manual.definition.options).toEqual({
      versioned: true,
      label: 'Manual'
    })
  })

  it('keeps inherited definitions that sub-classes set to null', () => {
    class Note extends Model {
      static properties = {
        text: { type: 'string' }
      }
    }

    class Memo extends Note {
      static properties = null
    }

    createApp({ Memo })
    expect(Memo.definition.properties.text).toEqual({ type: 'string' })
  })

  it('returns the same definition object on repeated access', () => {
    expect(Manual.definition).toBe(Manual.definition)
    expect(Manual.definition.properties).toBe(Manual.definition.properties)
  })
})

describe('definition.hooks', () => {
  const calls = []

  class Entry extends Model {
    static properties = {
      title: { type: 'string' }
    }

    static hooks = {
      'before:insert'({ inputItems }) {
        calls.push(['Entry', this.name, inputItems.length])
      },
      // Multiple events can be handled by the same hook.
      'before:update, before:delete'({ type }) {
        calls.push(['Entry', type])
      }
    }
  }

  class Article extends Entry {
    static hooks = {
      'before:insert'() {
        calls.push(['Article'])
      },
      async 'after:find'({ result }) {
        await Promise.resolve()
        return result.filter(item => item.title)
      }
    }
  }

  class Note extends Model {
    static hooks = {
      'after:find'({ result }) {
        return result.map(item => ({ ...item, seen: true }))
      },
      'after:insert'() {
        // Returning nothing keeps the result unchanged.
      }
    }
  }

  createApp({ Entry, Article, Note })

  beforeEach(() => {
    calls.length = 0
  })

  it('runs inherited hooks before the sub-class hooks', async () => {
    await Article.beforeInsert({ inputItems: [{}, {}], result: [] })
    expect(calls).toEqual([['Entry', 'Article', 2], ['Article']])
  })

  it('registers hooks for comma-separated event names', async () => {
    await Entry.beforeUpdate({ result: [] })
    await Entry.beforeDelete({ result: [] })
    expect(calls).toEqual([
      ['Entry', 'before:update'],
      ['Entry', 'before:delete']
    ])
  })

  it('returns results that hooks have replaced', async () => {
    const result = [{ title: 'A' }, { title: null }]
    expect(await Article.afterFind({ result })).toEqual([{ title: 'A' }])
  })

  it('passes replaced results on to subsequent hooks', async () => {
    class Digest extends Note {
      static hooks = {
        'after:find'({ result }) {
          return result.filter(item => item.seen && item.title)
        }
      }
    }
    createApp({ Digest })
    expect(
      await Digest.afterFind({ result: [{ title: 'A' }, { title: '' }] })
    ).toEqual([{ title: 'A', seen: true }])
  })

  it('returns nothing when hooks keep the result unchanged', async () => {
    expect(await Note.afterInsert({ result: [{}] })).toBeUndefined()
    expect(await Note.afterDelete({ result: [{}] })).toBeUndefined()
    expect(await Entry.afterUpdate({ result: [{}] })).toBeUndefined()
    expect(await Entry.beforeFind({ result: [] })).toBeUndefined()
  })
})
