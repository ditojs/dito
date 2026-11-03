import { createApi } from '@ditojs/server'
import { parseListQuery } from '../src/index.ts'

const api = createApi({
  controllers: [
    { path: 'fonts', actions: { get: ({ c }) => parseListQuery(c) } }
  ]
})

async function parse(query: string) {
  const response = await api.request(`/fonts?${query}`)
  return { status: response.status, json: await response.json() }
}

describe('parseListQuery()', () => {
  it('returns empty values without parameters', async () => {
    expect((await parse('')).json).toEqual({
      filter: {},
      order: [],
      range: null
    })
  })

  it('parses `filter[relation.id]` filters', async () => {
    const { json } = await parse('filter[family.id]=1')
    expect(json.filter).toEqual({ 'family.id': '1' })
  })

  it('parses `filter[name]` filters', async () => {
    const { json } = await parse('filter[text]=Uni&filter[active]&other=1')
    expect(json.filter).toEqual({ text: 'Uni', active: '' })
  })

  it('gives a repeated filter an array of its values in order', async () => {
    const { json } = await parse(
      'filter[range]=1&filter[text]=a&filter[range]=&filter[range]=9'
    )
    expect(json.filter).toEqual({ range: ['1', '', '9'], text: 'a' })
  })

  it('keeps names of `Object.prototype` as plain keys', async () => {
    const { json } = await parse('filter[__proto__]=1&filter[toString]=2')
    expect(Object.keys(json.filter)).toEqual(['__proto__', 'toString'])
  })

  it("ignores Dito 6's `filter=name:args`, `scope=name` and `fields`", async () => {
    const { status, json } = await parse(
      'filter=range:1,2&scope=published&fields=id'
    )
    expect(status).toBe(200)
    expect(json).toEqual({ filter: {}, order: [], range: null })
  })

  it('parses order and range', async () => {
    const { json } = await parse(
      'order=name&order=createdAt%20desc&range=0,49'
    )
    expect(json).toEqual({
      filter: {},
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
          path: 'fonts',
          actions: {
            get: ({ c }) =>
              parseListQuery(c, { 'filter[a]': ['1', '2'], 'range': '0,9' })
          }
        }
      ]
    })
    const response = await api.request('/fonts?range=5,6&order=name')
    expect(await response.json()).toEqual({
      filter: { a: ['1', '2'] },
      order: [],
      range: [0, 9]
    })
  })

  it.each([
    'filter[a-b]=1',
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
