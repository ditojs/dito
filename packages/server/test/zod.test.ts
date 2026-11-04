import { z } from 'zod'
import { q } from '../src/zod.ts'

describe('q', () => {
  it('parses booleans', () => {
    const schema = q.boolean()
    expect(schema.parse('true')).toBe(true)
    expect(schema.parse('1')).toBe(true)
    expect(schema.parse('false')).toBe(false)
    expect(schema.parse('0')).toBe(false)
    expect(schema.safeParse('yes').success).toBe(false)
    expect(schema.safeParse('').success).toBe(false)
  })

  it('parses numbers and integers', () => {
    expect(q.number().parse('1.5')).toBe(1.5)
    expect(q.number().safeParse('').success).toBe(false)
    expect(q.number().safeParse('abc').success).toBe(false)
    expect(q.integer().parse('12')).toBe(12)
    expect(q.integer().safeParse('1.5').success).toBe(false)
  })

  it('parses strings and dates', () => {
    expect(q.string().parse('text')).toBe('text')
    expect(q.date().parse('2026-10-30')).toEqual(new Date('2026-10-30'))
    expect(q.date().safeParse('never').success).toBe(false)
  })

  it('parses repeated keys, and a single value as one item', () => {
    const schema = q.array(q.integer())
    expect(schema.parse(['1', '2'])).toEqual([1, 2])
    expect(schema.parse('1')).toEqual([1])
    expect(schema.safeParse(['1', 'a']).success).toBe(false)
    expect(schema.safeParse(undefined).success).toBe(false)
    expect(z.object({ ids: schema.optional() }).parse({})).toEqual({})
    expect(z.object({ ids: schema.default([]) }).parse({})).toEqual({ ids: [] })
  })

  it('limits the number of repeated keys with `max`', () => {
    const schema = q.array(q.integer(), { max: 2 })
    expect(schema.parse(['1', '2'])).toEqual([1, 2])
    expect(schema.parse('1')).toEqual([1])
    expect(schema.safeParse(['1', '2', '3']).success).toBe(false)
  })

  it('works with `optional()` and `default()`', () => {
    const schema = z.object({
      draft: q.boolean().default(false),
      page: q.integer().optional()
    })
    expect(schema.parse({})).toEqual({ draft: false })
    expect(schema.parse({ draft: 'true', page: '2' })).toEqual({
      draft: true,
      page: 2
    })
  })
})
