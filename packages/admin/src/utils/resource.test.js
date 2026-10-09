import { vi } from 'vitest'
import { hasResource, getResource, getMemberResource } from './resource.js'

describe('getResource()', () => {
  it('converts paths to resources', () => {
    expect(getResource('books')).toEqual({ path: 'books' })
  })

  it('returns `null` for missing resources', () => {
    expect(getResource(undefined)).toBe(null)
    expect(getResource(null, { type: 'collection' })).toBe(null)
    expect(getResource(false)).toBe(null)
  })

  it('applies the defaults to the resource', () => {
    expect(
      getResource('books', { type: 'collection', method: 'get' })
    ).toEqual({ type: 'collection', method: 'get', path: 'books' })
    expect(
      getResource(
        { path: 'publish', method: 'post' },
        { type: 'collection', method: 'get' }
      )
    ).toEqual({ type: 'collection', method: 'post', path: 'publish' })
  })

  it('does not modify object resources', () => {
    const resource = { path: 'publish' }
    getResource(resource, { method: 'post', parent: { path: 'books' } })
    expect(resource).toEqual({ path: 'publish' })
  })

  it('calls resource functions with the defaults', () => {
    const parent = { type: 'member', path: 'books', id: '1' }
    const resource = vi.fn(({ method }) => ({
      path: method === 'post' ? 'reviews' : 'ratings'
    }))
    expect(getResource(resource, { method: 'post', parent })).toEqual({
      method: 'post',
      path: 'reviews',
      parent
    })
    expect(resource).toHaveBeenCalledWith({ method: 'post', parent })
  })

  describe('with a parent', () => {
    const books = { type: 'collection', path: 'books' }
    const book = getMemberResource(7, books)

    it('nests relative paths in the parent, e.g. for item actions', () => {
      expect(
        getResource({ path: 'publish', method: 'post' }, { parent: book })
      ).toEqual({
        path: 'publish',
        method: 'post',
        parent: { type: 'member', path: 'books', id: '7' }
      })
    })

    it(`uses the parent itself, as '.', for resources without a path`, () => {
      expect(
        getResource({ method: 'patch' }, { parent: book })
      ).toEqual({ method: 'patch', path: '.', parent: book })
    })

    it('does not nest absolute paths in the parent', () => {
      expect(getResource('/authors', { parent: book })).toEqual({
        path: '/authors'
      })
    })

    it('keeps parents of the resource, even if `null`', () => {
      const authors = { type: 'collection', path: 'authors' }
      expect(
        getResource({ path: 'list', parent: authors }, { parent: book }).parent
      ).toBe(authors)
      expect(
        getResource({ path: 'list', parent: null }, { parent: book }).parent
      ).toBe(null)
    })

    it('sets `null` parents, so resources stop looking for one', () => {
      expect(getResource('books', { parent: null })).toEqual({
        path: 'books',
        parent: null
      })
    })
  })
})

describe('getMemberResource()', () => {
  it('turns collections into members with the id as a string', () => {
    const parent = { type: 'member', path: 'libraries', id: '1' }
    expect(
      getMemberResource(0, {
        type: 'collection',
        method: 'get',
        path: 'books',
        parent,
        query: { order: 'title' },
        data: { title: 'Orlando' }
      })
    ).toEqual({
      type: 'member',
      method: 'get',
      path: 'books',
      parent,
      id: '0'
    })
  })

  it('returns `null` without an id or a collection', () => {
    const books = { type: 'collection', path: 'books' }
    expect(getMemberResource(null, books)).toBe(null)
    expect(getMemberResource(undefined, books)).toBe(null)
    expect(getMemberResource(1, { type: 'member', path: 'books' })).toBe(null)
    expect(getMemberResource(1, { path: 'books' })).toBe(null)
    expect(getMemberResource(1, null)).toBe(null)
  })
})

describe('hasResource()', () => {
  it('checks schemas for valid resources', () => {
    expect(hasResource({ resource: 'books' })).toBe(true)
    expect(hasResource({ resource: { path: 'books' } })).toBe(true)
    expect(hasResource({ resource: () => 'books' })).toBe(true)
    expect(hasResource({ resource: () => null })).toBe(false)
    expect(hasResource({})).toBe(false)
  })
})
