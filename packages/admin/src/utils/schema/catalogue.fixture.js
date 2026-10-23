export const showPrices = ({ rootItem }) => rootItem.showPrices

// A catalogue with the structures that the walk handles: unnested sections
// with `if`, `fields()` callbacks, items of several forms, wrapped primitives,
// panels, tabs, and sources with their own resource:
export const catalogueForm = {
  fields: {
    title: { type: 'text', required: true },
    showPrices: { type: 'switch' },
    secret: { type: 'password' },
    collections: {
      type: 'list',
      inlined: true,
      form: {
        type: 'form',
        fields: {
          name: { type: 'text', required: true },
          code: {
            type: 'text',
            required: ({ item }) => item.items.length > 1
          },
          pricing: {
            type: 'section',
            if: showPrices,
            fields: {
              discount: { type: 'number', range: [0, 1] },
              currency: { type: 'select', options: ['EUR', 'USD'] }
            }
          },
          items: {
            type: 'list',
            inlined: true,
            forms: {
              book: {
                type: 'form',
                fields: {
                  name: { type: 'text', required: true },
                  pages: { type: 'integer', minimum: 1 },
                  onSale: { type: 'switch' },
                  price: {
                    type: 'number',
                    if: showPrices,
                    required: ({ item }) => item.onSale
                  },
                  chapters: {
                    type: 'list',
                    inlined: true,
                    form: {
                      type: 'form',
                      fields: {
                        title: { type: 'text', required: true, maxLength: 20 },
                        length: { type: 'number', default: 1 }
                      }
                    }
                  },
                  tags: {
                    type: 'list',
                    inlined: true,
                    wrapPrimitives: 'tag',
                    form: {
                      type: 'form',
                      fields: { tag: { type: 'text', required: true } }
                    }
                  },
                  details: {
                    type: 'section',
                    fields: ({ item }) =>
                      item.pages > 100
                        ? { summary: { type: 'text', required: true } }
                        : { blurb: { type: 'text', maxLength: 10 } }
                  }
                }
              },
              record: {
                type: 'form',
                fields: {
                  name: { type: 'text', required: true },
                  email: { type: 'email' },
                  format: {
                    type: 'select',
                    options: ['lp', 'cd'],
                    default: 'lp'
                  },
                  tracks: {
                    type: 'list',
                    inlined: true,
                    required: true,
                    form: {
                      type: 'form',
                      fields: {
                        title: { type: 'text', required: true },
                        seconds: { type: 'integer', minimum: 1 }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      panels: {
        summary: {
          type: 'panel',
          fields: { summaryNote: { type: 'text', maxLength: 5 } }
        }
      }
    },
    vendors: {
      type: 'list',
      resource: 'vendors',
      form: {
        type: 'form',
        fields: { name: { type: 'text', required: true } }
      }
    }
  },
  tabs: {
    extra: {
      type: 'tab',
      fields: { notes: { type: 'textarea', maxLength: 5 } }
    }
  }
}

export function createCatalogue() {
  return {
    title: '',
    showPrices: true,
    summaryNote: 'Too long',
    notes: 'Too long',
    collections: [
      {
        name: 'Books',
        code: null,
        discount: 2,
        currency: 'GBP',
        items: [
          {
            type: 'book',
            name: '',
            pages: 0,
            onSale: true,
            price: null,
            chapters: [{ title: 'x'.repeat(30) }, { title: 'Two' }],
            tags: ['a', ''],
            blurb: 'Much too long'
          },
          {
            type: 'book',
            name: 'Long',
            pages: 200,
            onSale: false,
            chapters: [],
            tags: []
          }
        ]
      },
      {
        name: '',
        items: [
          {
            type: 'record',
            name: 'Record',
            email: 'nope',
            tracks: []
          }
        ]
      }
    ],
    vendors: [{}]
  }
}

export const catalogueErrors = {
  'title': [{ message: 'is required' }],
  'notes': [{ message: 'must be at most 5 characters long' }],
  'summaryNote': [{ message: 'must be at most 5 characters long' }],
  'collections/0/code': [{ message: 'is required' }],
  'collections/0/discount': [{ message: 'must be between 0 and 1' }],
  'collections/0/items/0/name': [{ message: 'is required' }],
  'collections/0/items/0/pages': [{ message: 'must be 1 or more' }],
  'collections/0/items/0/price': [{ message: 'is required' }],
  'collections/0/items/0/chapters/0/title': [
    { message: 'must be at most 20 characters long' }
  ],
  'collections/0/items/0/tags/1': [{ message: 'is required' }],
  'collections/0/items/0/blurb': [
    { message: 'must be at most 10 characters long' }
  ],
  'collections/0/items/1/summary': [{ message: 'is required' }],
  'collections/1/name': [{ message: 'is required' }],
  'collections/1/items/0/email': [{ message: 'must be a valid email' }],
  'collections/1/items/0/tracks': [{ message: 'is required' }]
}

// The catalogue as it is serialized:
export const serializedCatalogue = {
  title: null,
  showPrices: true,
  summaryNote: 'Too long',
  notes: 'Too long',
  collections: [
    {
      name: 'Books',
      code: null,
      discount: 2,
      currency: 'GBP',
      items: [
        {
          type: 'book',
          name: null,
          pages: 0,
          onSale: true,
          price: null,
          chapters: [
            { title: 'x'.repeat(30), length: 1 },
            { title: 'Two', length: 1 }
          ],
          tags: ['a', null],
          blurb: 'Much too long'
        },
        {
          type: 'book',
          name: 'Long',
          pages: 200,
          onSale: false,
          price: null,
          chapters: [],
          tags: [],
          summary: null
        }
      ]
    },
    {
      name: null,
      code: null,
      discount: null,
      currency: null,
      items: [
        {
          type: 'record',
          name: 'Record',
          email: 'nope',
          format: 'lp',
          tracks: []
        }
      ]
    }
  ]
}
