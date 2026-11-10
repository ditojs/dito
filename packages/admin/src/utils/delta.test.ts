import { getDelta, getRecordGraph } from './delta.ts'

describe('getDelta()', () => {
  const base = {
    id: 1,
    title: 'Earthsea',
    settings: { color: 'red', tags: ['a', 'b'] },
    chapters: [
      { id: 10, title: 'One', position: 1 },
      { id: 11, title: 'Two', position: 2, pages: [{ id: 20, text: 'A' }] }
    ],
    author: { id: 30, name: 'Ursula' }
  }
  const graph = { chapters: { pages: {} }, author: {} }

  it('returns an empty delta for unchanged data', () => {
    expect(getDelta(base, structuredClone(base), graph)).toEqual({})
  })

  it('sends values that changed whole', () => {
    const data = structuredClone(base)
    data.title = 'Tehanu'
    data.settings.tags.push('c')
    expect(getDelta(base, data, graph)).toEqual({
      title: 'Tehanu',
      settings: { color: 'red', tags: ['a', 'b', 'c'] }
    })
  })

  it('sends the changed rows of lists of records by their ids', () => {
    const data = structuredClone(base)
    data.chapters[1].title = 'Two (revised)'
    expect(getDelta(base, data, graph)).toEqual({
      chapters: [{ id: 11, title: 'Two (revised)' }]
    })
  })

  it('sends new rows whole and marks removed rows', () => {
    const data = structuredClone(base)
    data.chapters = [data.chapters[1], { title: 'Three', position: 3 }] as any
    expect(getDelta(base, data, graph)).toEqual({
      chapters: [
        { title: 'Three', position: 3 },
        { 'id': 10, '#removed': true }
      ]
    })
  })

  it('sends the delta of nested rows through their parents', () => {
    const data = structuredClone(base)
    data.chapters[1].pages = []
    expect(getDelta(base, data, graph)).toEqual({
      chapters: [{ id: 11, pages: [{ 'id': 20, '#removed': true }] }]
    })
  })

  it('sends the delta of to-one records by their ids', () => {
    const data = structuredClone(base)
    data.author.name = 'Ursula K.'
    expect(getDelta(base, data, graph)).toEqual({
      author: { id: 30, name: 'Ursula K.' }
    })
  })

  it('sends other and removed to-one records whole', () => {
    expect(getDelta(base, { ...base, author: null }, graph)).toEqual({
      author: null
    })
    expect(
      getDelta(base, { ...base, author: { id: 31 } }, graph)
    ).toEqual({ author: { id: 31 } })
  })

  it('matches rows by the id keys of their lists, as strings', () => {
    const isbnBase = {
      chapters: [
        { isbn: '1', title: 'One' },
        { isbn: 2, title: 'Two' }
      ]
    }
    const data = {
      chapters: [
        { isbn: 1, title: 'One (revised)' },
        { isbn: '2', title: 'Two' }
      ]
    }
    const getIdKey = (path: string) => (path === 'chapters' ? 'isbn' : 'id')
    expect(getDelta(isbnBase, data, { chapters: {} }, getIdKey)).toEqual({
      chapters: [{ isbn: 1, title: 'One (revised)' }]
    })
  })

  it('treats lists outside the graph as values', () => {
    const data = structuredClone(base)
    data.chapters[0].title = 'One (revised)'
    expect(getDelta(base, data, {})).toEqual({ chapters: data.chapters })
  })
})

describe('getRecordGraph()', () => {
  const createResponse = (headers: Record<string, string> = {}) =>
    new Response(null, { headers })

  it('reads the record graph of a response', () => {
    expect(
      getRecordGraph(createResponse({ 'Dito-Record-Graph': '{"chapters":{}}' }))
    ).toEqual({ chapters: {} })
  })

  it('returns null without a graph or with an invalid one', () => {
    expect(getRecordGraph(createResponse())).toBeNull()
    expect(
      getRecordGraph(createResponse({ 'Dito-Record-Graph': '{' }))
    ).toBeNull()
    expect(getRecordGraph({} as Response)).toBeNull()
  })
})
