import { QueryParameters } from './QueryParameters.js'

function createQueryRecorder() {
  const calls = []
  return {
    calls,
    range(start, end) {
      calls.push(['range', start, end])
    },
    orderBy(...args) {
      calls.push(['orderBy', ...args])
    },
    tableRefFor() {
      return 'item'
    },
    modelClass() {
      return null
    }
  }
}

describe('QueryParameters.range', () => {
  const range = QueryParameters.get('range')

  it('parses string ranges with whitespace around the comma', () => {
    const query = createQueryRecorder()
    range(query, 'range', '10 , 20')
    expect(query.calls).toEqual([['range', 10, 20]])
  })

  it('rejects letters after the comma instead of swallowing them', () => {
    const query = createQueryRecorder()
    expect(() => range(query, 'range', '10,s20')).toThrow(
      'Invalid range: [10, NaN].'
    )
  })
})

describe('QueryParameters.order', () => {
  const order = QueryParameters.get('order')

  it('reports the invalid nulls order value in the error message', () => {
    const query = createQueryRecorder()
    expect(() => order(query, 'order', 'name asc middle')).toThrow(
      `Invalid nulls order: 'middle'.`
    )
  })
})
