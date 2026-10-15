import { describe, expectTypeOf, it } from 'vitest'
import type { FromModel, SerializedModel } from '@ditojs/server'
import { Model } from '@ditojs/server'
import type * as models from './from-model-models'
import type { Author, Book, Chapter, Novel, Tag } from './from-model-models'

class Sample extends Model {
  static override properties = {
    string: { type: 'string' },
    text: { type: 'text' },
    color: { type: 'color' },
    number: { type: 'number' },
    integer: { type: 'integer' },
    boolean: { type: 'boolean' },
    date: { type: 'date' },
    datetime: { type: 'datetime' },
    timestamp: { type: 'timestamp' },
    computedDate: { type: 'date', computed: true },
    address: {
      type: 'object',
      properties: {
        street: { type: 'string', required: true },
        movedAt: { type: 'date' }
      }
    },
    meta: { type: 'object' },
    tags: { type: 'array', items: { type: 'string' } },
    point: {
      type: 'array',
      prefixItems: [{ type: 'number' }, { type: 'string' }],
      items: false
    },
    list: { type: 'array' },
    role: { type: 'string', enum: ['admin', 'user'] },
    kind: { type: 'string', const: 'sample' },
    shipping: {
      $ref: '#Address',
      nullable: true,
      definitions: {
        '#Address': {
          type: 'object',
          properties: { city: { type: 'string', required: true } }
        }
      }
    },
    billing: {
      type: 'object',
      allOf: [
        { $ref: '#Address' },
        { properties: { vatNumber: { type: 'string' } } }
      ]
    },
    either: { anyOf: [{ type: 'string' }, { type: 'number' }] },
    one: { oneOf: [{ type: 'boolean' }, { type: 'integer' }] },
    nullable: { type: 'string', nullable: true },
    required: { type: 'string', required: true },
    asset: { type: 'asset' },
    book: { type: 'Book' },
    unknownModel: { type: 'Unknown' }
  } as const
}

interface Sample extends FromModel<typeof Sample, typeof models> {}

describe('FromModel — properties', () => {
  it('maps strings, numbers and booleans', () => {
    expectTypeOf<Sample['string']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Sample['text']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Sample['color']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Sample['number']>().toEqualTypeOf<number | undefined>()
    expectTypeOf<Sample['integer']>().toEqualTypeOf<number | undefined>()
    expectTypeOf<Sample['boolean']>().toEqualTypeOf<boolean | undefined>()
  })

  it('maps dates to Date, except computed and nested ones', () => {
    expectTypeOf<Sample['date']>().toEqualTypeOf<Date | undefined>()
    expectTypeOf<Sample['datetime']>().toEqualTypeOf<Date | undefined>()
    expectTypeOf<Sample['timestamp']>().toEqualTypeOf<Date | undefined>()
    expectTypeOf<Sample['computedDate']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<
      NonNullable<Sample['address']>['movedAt']
    >().toEqualTypeOf<string | undefined>()
  })

  it('maps objects with and without properties', () => {
    expectTypeOf<Sample['address']>().toEqualTypeOf<
      { street: string; movedAt?: string } | undefined
    >()
    expectTypeOf<Sample['meta']>().toEqualTypeOf<
      Record<string, unknown> | undefined
    >()
  })

  it('maps arrays and tuples', () => {
    expectTypeOf<Sample['tags']>().toEqualTypeOf<string[] | undefined>()
    expectTypeOf<Sample['point']>().toEqualTypeOf<
      [number, string] | undefined
    >()
    expectTypeOf<Sample['list']>().toEqualTypeOf<unknown[] | undefined>()
  })

  it('maps enum and const to literals', () => {
    expectTypeOf<Sample['role']>().toEqualTypeOf<'admin' | 'user' | undefined>()
    expectTypeOf<Sample['kind']>().toEqualTypeOf<'sample' | undefined>()
  })

  it('resolves $ref from the definitions of all properties', () => {
    expectTypeOf<Sample['shipping']>().toEqualTypeOf<
      { city: string } | null | undefined
    >()
    expectTypeOf<NonNullable<Sample['billing']>>().toMatchTypeOf<{
      city: string
      vatNumber?: string
    }>()
  })

  it('maps anyOf and oneOf to unions', () => {
    expectTypeOf<Sample['either']>().toEqualTypeOf<
      string | number | undefined
    >()
    expectTypeOf<Sample['one']>().toEqualTypeOf<boolean | number | undefined>()
  })

  it('maps nullable and required', () => {
    expectTypeOf<Sample['nullable']>().toEqualTypeOf<
      string | null | undefined
    >()
    expectTypeOf<Sample['required']>().toEqualTypeOf<string>()
    expectTypeOf<Sample>().toHaveProperty('required')
    // @ts-expect-error - required properties can't be left out
    const _sample: Pick<Sample, 'required'> = {}
  })

  it('maps model names through the registry, other types to unknown', () => {
    expectTypeOf<Sample['book']>().toEqualTypeOf<Book | undefined>()
    expectTypeOf<Sample['unknownModel']>().toEqualTypeOf<unknown>()
    expectTypeOf<Sample['asset']>().toEqualTypeOf<unknown>()
  })

  it('maps model names to unknown without a registry', () => {
    class _Unregistered extends Model {
      static override properties = {
        book: { type: 'Book', required: true }
      } as const
    }
    type Unregistered = FromModel<typeof _Unregistered>
    expectTypeOf<Unregistered['book']>().toEqualTypeOf<unknown>()
  })

  it('narrows unknown types in the interface', () => {
    interface Narrowed extends FromModel<typeof Sample, typeof models> {
      asset?: { key: string }
    }
    expectTypeOf<Narrowed['asset']>().toEqualTypeOf<
      { key: string } | undefined
    >()
  })

  it('makes computed properties readonly', () => {
    const author = {} as Author
    expectTypeOf(author.fullName).toEqualTypeOf<string | undefined>()
    // @ts-expect-error - computed properties are readonly
    author.fullName = 'Jane Doe'
    author.name = 'Jane'
  })

  it('keeps hidden properties on instances, not in serialized data', () => {
    expectTypeOf<Author['password']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<SerializedModel<Author>>().not.toHaveProperty('password')
    expectTypeOf<SerializedModel<Author>>().toHaveProperty('name')
    expectTypeOf<keyof SerializedModel<Author>>().toEqualTypeOf<
      'id' | 'name' | 'fullName' | 'favoriteBook' | 'books'
    >()
  })

  it('leaves out the general properties of Model', () => {
    class _Plain extends Model {}
    expectTypeOf<keyof FromModel<typeof _Plain>>().toEqualTypeOf<never>()
  })
})

describe('FromModel — relations', () => {
  it('types to-one relations as M | null', () => {
    expectTypeOf<Book['author']>().toEqualTypeOf<Author | null | undefined>()
    expectTypeOf<Book['firstChapter']>().toEqualTypeOf<
      Chapter | null | undefined
    >()
    expectTypeOf<Chapter['book']>().toEqualTypeOf<Book | null | undefined>()
  })

  it('types to-many relations as M[]', () => {
    expectTypeOf<Author['books']>().toEqualTypeOf<Book[] | undefined>()
    expectTypeOf<Book['chapters']>().toEqualTypeOf<Chapter[] | undefined>()
    expectTypeOf<Book['tags']>().toEqualTypeOf<Tag[] | undefined>()
  })

  it('takes the related model from modelClass', () => {
    expectTypeOf<Book['editor']>().toEqualTypeOf<Author | null | undefined>()
    expectTypeOf<Book['translator']>().toEqualTypeOf<
      Author | null | undefined
    >()
  })

  it('resolves models through relations of relations', () => {
    const book = {} as Book
    expectTypeOf(book.author!.books![0].chapters).toEqualTypeOf<
      Chapter[] | undefined
    >()
  })

  it('leaves out relations without a registry', () => {
    type Unregistered = FromModel<typeof models.Book>
    expectTypeOf<Unregistered>().not.toHaveProperty('author')
    expectTypeOf<Unregistered>().toHaveProperty('title')
  })
})

describe('FromModel — inheritance', () => {
  it('inherits the fields of mixins and base models', () => {
    expectTypeOf<Book['createdAt']>().toEqualTypeOf<Date>()
    expectTypeOf<Novel['title']>().toEqualTypeOf<string>()
    expectTypeOf<Novel['author']>().toEqualTypeOf<Author | null | undefined>()
    expectTypeOf<Novel['genre']>().toEqualTypeOf<
      'crime' | 'romance' | undefined
    >()
  })

  it('leaves out the hidden properties of subclasses when serialized', () => {
    expectTypeOf<SerializedModel<Novel>>().not.toHaveProperty('secret')
    expectTypeOf<SerializedModel<Novel>>().toHaveProperty('title')
    expectTypeOf<SerializedModel<Novel>['createdAt']>().toEqualTypeOf<string>()
  })

  it('rejects subclasses that change the type of a property', () => {
    class _Base extends Model {
      static override properties = {
        name: { type: 'string' }
      } as const
    }
    interface _Base extends FromModel<typeof _Base> {}

    // @ts-expect-error - name is a string in the base class
    class _Sub extends _Base {
      static override properties = {
        ..._Base.properties,
        name: { type: 'integer' }
      } as const
    }
  })
})

describe('FromModel — added properties', () => {
  it('adds the id property', () => {
    class _Plain extends Model {
      static override properties = {
        name: { type: 'string' }
      } as const
    }
    type Plain = FromModel<typeof _Plain>
    expectTypeOf<Plain['id']>().toEqualTypeOf<number | undefined>()
  })

  it('adds the properties of a custom idColumn', () => {
    class _Single extends Model {
      static override get idColumn() {
        return 'key' as const
      }

      static override properties = {
        name: { type: 'string' }
      } as const
    }
    class _Composite extends Model {
      static override get idColumn(): ['a', 'b'] {
        return ['a', 'b']
      }

      static override properties = {
        name: { type: 'string' }
      } as const
    }
    expectTypeOf<keyof FromModel<typeof _Single>>().toEqualTypeOf<
      'name' | 'key'
    >()
    expectTypeOf<keyof FromModel<typeof _Composite>>().toEqualTypeOf<
      'name' | 'a' | 'b'
    >()
  })

  it('keeps defined ids and primary properties', () => {
    class _Defined extends Model {
      static override properties = {
        id: { type: 'string' }
      } as const
    }
    class _Primary extends Model {
      static override properties = {
        isbn: { type: 'string', primary: true }
      } as const
    }
    expectTypeOf<FromModel<typeof _Defined>['id']>().toEqualTypeOf<
      string | undefined
    >()
    expectTypeOf<keyof FromModel<typeof _Primary>>().toEqualTypeOf<'isbn'>()
  })

  it('adds the foreign keys of relations', () => {
    class _Review extends Model {
      static override properties = {
        text: { type: 'text' }
      } as const

      static override relations = {
        book: { relation: 'belongsTo', from: 'Review.bookId', to: 'Book.id' },
        editor: {
          relation: 'belongsTo',
          from: 'Review.editorId',
          to: 'Author.id',
          nullable: true
        },
        comments: { relation: 'hasMany', from: 'Review.id', to: 'Tag.id' }
      } as const
    }
    type Review = FromModel<typeof _Review>
    expectTypeOf<Review['bookId']>().toEqualTypeOf<number | undefined>()
    expectTypeOf<Review['editorId']>().toEqualTypeOf<
      number | null | undefined
    >()
    expectTypeOf<Review['id']>().toEqualTypeOf<number | undefined>()
  })

  it('keeps defined foreign keys', () => {
    expectTypeOf<Chapter['bookId']>().toEqualTypeOf<number>()
  })
})
