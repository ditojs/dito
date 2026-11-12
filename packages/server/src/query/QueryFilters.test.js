import { QueryFilters } from './QueryFilters.js'

function createQueryRecorder({ isPostgreSQL = true } = {}) {
  const calls = []
  return {
    calls,
    isPostgreSQL: () => isPostgreSQL,
    where(...args) {
      calls.push(['where', ...args])
    },
    whereRaw(...args) {
      calls.push(['whereRaw', ...args])
    },
    whereBetween(...args) {
      calls.push(['whereBetween', ...args])
    },
    whereIn(...args) {
      calls.push(['whereIn', ...args])
    }
  }
}

describe('QueryFilters.text', () => {
  const { handler } = QueryFilters.get('text')

  it('matches case-insensitively with ILIKE in PostgreSQL', () => {
    const query = createQueryRecorder()
    handler(query, 'title', { operator: 'ends-with', text: 'Dune' })
    expect(query.calls).toEqual([['where', 'title', 'ILIKE', '%Dune']])
  })

  it('matches lower-cased values with LIKE in other databases', () => {
    const query = createQueryRecorder({ isPostgreSQL: false })
    handler(query, 'title', { operator: 'starts-with', text: 'Dune' })
    expect(query.calls).toEqual([
      ['whereRaw', 'LOWER(??) LIKE ?', ['title', 'dune%']]
    ])
  })

  it('uses the contains operator when only text is passed', () => {
    const query = createQueryRecorder()
    handler(query, 'title', { operator: 'Dune' })
    expect(query.calls).toEqual([['where', 'title', 'ILIKE', '%Dune%']])
  })

  it('ignores unknown operators', () => {
    const query = createQueryRecorder()
    handler(query, 'title', { operator: 'matches', text: 'Dune' })
    expect(query.calls).toEqual([])
  })

  it('ignores empty text', () => {
    const query = createQueryRecorder()
    handler(query, 'title', { operator: 'equals', text: '' })
    expect(query.calls).toEqual([])
  })
})

describe('QueryFilters.equals', () => {
  const { handler } = QueryFilters.get('equals')

  it('compares the property with one value', () => {
    const query = createQueryRecorder()
    handler(query, 'genre', { value: 'poetry' })
    expect(query.calls).toEqual([['where', 'genre', 'poetry']])
  })

  it('compares the property with a list of values', () => {
    const query = createQueryRecorder()
    handler(query, 'genre', { value: ['poetry', 'drama'] })
    expect(query.calls).toEqual([['whereIn', 'genre', ['poetry', 'drama']]])
  })
})
