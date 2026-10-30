import { createApp, parseListQuery } from '../src/index.ts'

const app = createApp({
  controllers: [{ path: 'fonts', collection: { get: parseListQuery } }],
  getUser: async () => null
})

async function parse(query: string) {
  const response = await app.request(`/fonts?${query}`)
  return { status: response.status, json: await response.json() }
}

describe('parseListQuery()', () => {
  it('returns empty values without parameters', async () => {
    expect((await parse('')).json).toEqual({
      filters: [],
      order: [],
      range: null,
      fields: null
    })
  })

  it('parses `filter[name]` filters', async () => {
    const { json } = await parse('filter[text]=Uni&filter[active]&other=1')
    expect(json.filters).toEqual([
      { name: 'text', args: ['Uni'] },
      { name: 'active', args: [] }
    ])
  })

  it("parses Dito 6's `filter=name:args` and `scope=name`", async () => {
    const { json } = await parse(
      `filter=${encodeURIComponent('range:1,"b",{"c":true}')}&scope=published`
    )
    expect(json.filters).toEqual([
      { name: 'range', args: [1, 'b', { c: true }] },
      { name: 'published', args: [] }
    ])
  })

  it('parses order, range and fields', async () => {
    const { json } = await parse(
      'order=name&order=createdAt%20desc&range=0,49&fields=id,designers.name'
    )
    expect(json).toMatchObject({
      order: [
        { property: 'name', direction: 'asc' },
        { property: 'createdAt', direction: 'desc' }
      ],
      range: [0, 49],
      fields: ['id', 'designers.name']
    })
  })

  it.each([
    'filter=nocolon',
    'filter=name:{bad',
    'filter[a-b]=1',
    'scope=a b',
    'order=name%20up',
    'order=a;drop',
    'range=5,1',
    'range=a,b',
    'fields=id,,name'
  ])('answers 400 for %s', async query => {
    const { status, json } = await parse(query)
    expect(status).toBe(400)
    expect(json.detail).toMatch(/^Invalid /)
  })
})
