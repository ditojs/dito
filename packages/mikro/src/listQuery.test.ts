import { createApi } from '@ditojs/server'
import { parseListQuery } from './listQuery.ts'

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
      filter: [],
      order: [],
      range: null
    })
  })

  it('parses filters of relations', async () => {
    const { json } = await parse('filter=book.id:1')
    expect(json.filter).toEqual([{ name: 'book.id', value: '1' }])
  })

  it('gives filters their arguments as strings', async () => {
    const { json } = await parse(
      'filter=text:"Uni"&filter=active:true&filter=year:1900&other=1'
    )
    expect(json.filter).toEqual([
      { name: 'text', value: 'Uni' },
      { name: 'active', value: 'true' },
      { name: 'year', value: '1900' }
    ])
  })

  it('gives a filter with several arguments an array in order', async () => {
    const { json } = await parse(
      'filter=range:1,null,9&filter=genres:"a",["b","c"]'
    )
    expect(json.filter).toEqual([
      { name: 'range', value: ['1', '', '9'] },
      { name: 'genres', value: ['a', 'b', 'c'] }
    ])
  })

  it('keeps colons and commas in arguments', async () => {
    const { json } = await parse('filter=text:"a:b,c"')
    expect(json.filter).toEqual([{ name: 'text', value: 'a:b,c' }])
  })

  it('keeps repeated filters in order', async () => {
    const { json } = await parse('filter=state:"a"&filter=state:"b"')
    expect(json.filter).toEqual([
      { name: 'state', value: 'a' },
      { name: 'state', value: 'b' }
    ])
  })

  it('ignores the `fields` and `scope` of Dito 6', async () => {
    const { status, json } = await parse('fields=id&scope=published')
    expect(status).toBe(200)
    expect(json).toEqual({ filter: [], order: [], range: null })
  })

  it('parses order and range', async () => {
    const { json } = await parse(
      'order=name&order=createdAt%20desc&range=0,49'
    )
    expect(json).toEqual({
      filter: [],
      order: [
        { property: 'name', direction: 'asc' },
        { property: 'createdAt', direction: 'desc' }
      ],
      range: [0, 49]
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
