import { createApp, parseListQuery } from '../src/index.ts'

const app = createApp({
  controllers: [{ path: 'fonts', collection: { get: parseListQuery } }],
  getUser: async () => null
})

async function parse(query: string) {
  const response = await app.fetch(
    new Request(`http://localhost/fonts?${query}`)
  )
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

  it('gives a repeated filter several arguments in order', async () => {
    const { json } = await parse(
      'filter[range]=1&filter[text]=a&filter[range]=9'
    )
    expect(json.filters).toEqual([
      { name: 'range', args: ['1', '9'] },
      { name: 'text', args: ['a'] }
    ])
  })

  it("ignores Dito 6's `filter=name:args` and `scope=name`", async () => {
    const { status, json } = await parse('filter=range:1,2&scope=published')
    expect(status).toBe(200)
    expect(json.filters).toEqual([])
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
    'filter[a-b]=1',
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
