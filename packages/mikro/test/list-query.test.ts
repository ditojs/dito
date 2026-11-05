import { createApi } from '@ditojs/server'
import { parseListQuery } from '../src/index.ts'

const api = createApi({
  controllers: [
    { path: 'books', actions: { get: ({ c }) => parseListQuery(c) } }
  ]
})

async function parse(query: string) {
  const response = await api.request(`/books?${query}`)
  return { status: response.status, json: await response.json() }
}

describe('parseListQuery()', () => {
  it('returns empty values without parameters', async () => {
    expect((await parse('')).json).toEqual({
      filter: {},
      scope: [],
      order: [],
      range: null
    })
  })

  it('parses filters of relations', async () => {
    const { json } = await parse('filter=book.id:1')
    expect(json.filter).toEqual({ 'book.id': '1' })
  })

  it('gives filters their arguments as strings', async () => {
    const { json } = await parse(
      'filter=text:"Uni"&filter=active:true&filter=year:1900&other=1'
    )
    expect(json.filter).toEqual({ text: 'Uni', active: 'true', year: '1900' })
  })

  it('gives a filter with several arguments an array in order', async () => {
    const { json } = await parse(
      'filter=range:1,null,9&filter=genres:"a",["b","c"]'
    )
    expect(json.filter).toEqual({
      range: ['1', '', '9'],
      genres: ['a', 'b', 'c']
    })
  })

  it('keeps colons and commas in arguments', async () => {
    const { json } = await parse('filter=text:"a:b,c"')
    expect(json.filter).toEqual({ text: 'a:b,c' })
  })

  it('keeps names of `Object.prototype` as plain keys', async () => {
    const { json } = await parse('filter=__proto__:1&filter=toString:2')
    expect(Object.keys(json.filter)).toEqual(['__proto__', 'toString'])
  })

  it('collects scopes in order', async () => {
    const { json } = await parse('scope=published&scope=recent')
    expect(json.scope).toEqual(['published', 'recent'])
  })

  it('ignores the `fields` of Dito 6', async () => {
    const { status, json } = await parse('fields=id')
    expect(status).toBe(200)
    expect(json).toEqual({ filter: {}, scope: [], order: [], range: null })
  })

  it('parses order and range', async () => {
    const { json } = await parse(
      'order=name&order=createdAt%20desc&range=0,49'
    )
    expect(json).toEqual({
      filter: {},
      scope: [],
      order: [
        { property: 'name', direction: 'asc' },
        { property: 'createdAt', direction: 'desc' }
      ],
      range: [0, 49]
    })
  })

  it('reads `params` in place of the URL', async () => {
    const api = createApi({
      controllers: [
        {
          path: 'books',
          actions: {
            get: ({ c }) =>
              parseListQuery(c, { filter: 'a:1,2', range: '0,9' })
          }
        }
      ]
    })
    const response = await api.request('/books?range=5,6&order=name')
    expect(await response.json()).toEqual({
      filter: { a: ['1', '2'] },
      scope: [],
      order: [],
      range: [0, 9]
    })
  })

  it.each([
    'filter=a-b:1',
    'filter=a',
    'filter=a:b',
    'filter=a:1],[2',
    'order=name%20up',
    'order=a;drop',
    'range=5,1',
    'range=a,b',
    'range=0,9007199254740992',
    'range=9007199254740992,9007199254740993'
  ])('answers 400 for %s', async query => {
    const { status, json } = await parse(query)
    expect(status).toBe(400)
    expect(json.message).toMatch(/^Invalid /)
  })
})
