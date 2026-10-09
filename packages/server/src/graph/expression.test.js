import { QueryBuilder } from '../query/index.js'
import {
  collectExpressionPaths,
  expressionPathToString
} from './expression.js'

function parse(expr) {
  return QueryBuilder.parseRelationExpression(expr)
}

describe('collectExpressionPaths()', () => {
  it('collects one path per leaf of the expression', () => {
    const paths = collectExpressionPaths(parse('[author, chapters.book]'))
    expect(paths).toEqual([
      [{ relation: 'author', alias: undefined, modify: [] }],
      [
        { relation: 'chapters', alias: undefined, modify: [] },
        { relation: 'book', alias: undefined, modify: [] }
      ]
    ])
  })

  it('collects aliases and modifiers of relations', () => {
    const paths = collectExpressionPaths(
      parse('chapters(ordered, final) as parts.book')
    )
    expect(paths).toEqual([
      [
        { relation: 'chapters', alias: 'parts', modify: ['ordered', 'final'] },
        { relation: 'book', alias: undefined, modify: [] }
      ]
    ])
  })

  it('returns no paths for empty expressions', () => {
    expect(collectExpressionPaths(parse('[]'))).toEqual([])
  })
})

describe('expressionPathToString()', () => {
  const path = [
    { relation: 'chapters', alias: 'parts', modify: ['ordered', 'final'] },
    { relation: 'book', alias: undefined, modify: [] },
    { relation: 'author', alias: undefined, modify: ['active'] }
  ]

  it('converts paths back to relation expressions', () => {
    expect(expressionPathToString(path)).toBe(
      'chapters(ordered, final) as parts.book.author(active)'
    )
  })

  it('converts paths from a start index', () => {
    expect(expressionPathToString(path, 1)).toBe('book.author(active)')
  })

  it('round-trips aliases through parseRelationExpression()', () => {
    const path = [{ relation: 'chapters', alias: 'parts', modify: [] }]
    const [parsed] = collectExpressionPaths(
      parse(expressionPathToString(path))
    )
    expect(parsed).toEqual(path)
  })

  it('round-trips aliases with modifiers', () => {
    const [parsed] = collectExpressionPaths(
      parse(expressionPathToString(path))
    )
    expect(parsed).toEqual(path)
  })
})
