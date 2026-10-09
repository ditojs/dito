import path from 'path'
import { resolveFileUrl } from './asset.js'
import { isHttpMethod } from './http.js'
import { formatJson } from './json.js'
import { getScope } from './scope.js'

describe('resolveFileUrl()', () => {
  it('resolves relative file urls to absolute ones', () => {
    expect(resolveFileUrl('file://covers/front.png')).toBe(
      `file://${path.resolve('covers/front.png')}`
    )
  })

  it('normalizes absolute file urls', () => {
    expect(resolveFileUrl('file:///covers/../front.png')).toBe(
      'file:///front.png'
    )
  })

  it('leaves other urls and nullish values untouched', () => {
    expect(resolveFileUrl('https://example.com/a.png')).toBe(
      'https://example.com/a.png'
    )
    expect(resolveFileUrl(null)).toBe(null)
    expect(resolveFileUrl(undefined)).toBe(undefined)
  })
})

describe('isHttpMethod()', () => {
  it('recognizes lower-case http methods', () => {
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head']) {
      expect(isHttpMethod(method)).toBe(true)
    }
  })

  it('rejects upper-case and unknown method names', () => {
    expect(isHttpMethod('GET')).toBe(false)
    expect(isHttpMethod('list')).toBe(false)
    expect(isHttpMethod(undefined)).toBe(false)
  })
})

describe('formatJson()', () => {
  it('indents with two spaces by default', () => {
    expect(formatJson({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}')
  })

  it('formats without whitespace when not indented', () => {
    expect(formatJson({ a: [1] }, false)).toBe('{"a":[1]}')
  })
})

describe('getScope()', () => {
  it('detects graph scopes with a leading ^', () => {
    expect(getScope('^published')).toEqual({
      scope: 'published',
      graph: true
    })
  })

  it('returns plain scopes as they are', () => {
    expect(getScope('published')).toEqual({
      scope: 'published',
      graph: false
    })
  })

  it('handles nullish expressions', () => {
    expect(getScope(undefined)).toEqual({ scope: undefined, graph: false })
    expect(getScope(null)).toEqual({ scope: null, graph: false })
  })
})
