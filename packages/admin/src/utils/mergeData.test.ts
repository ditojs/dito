import { mergeData } from './mergeData.ts'
import { getItemUid } from './schema/data.js'
import { cloneWithUids } from './uid.js'
import { defineType } from './schema/types.ts'

// Define minimal types, as the actual type components can't be imported
// without a Vue SFC compiler. Merging data never renders their components:
const component = {}
defineType({ type: 'text', component })
defineType({ type: 'tags', component })
defineType({ type: 'section', component, defaultNested: false })
defineType({ type: 'list', component, sourceType: 'list' })
defineType({ type: 'object', component, sourceType: 'object' })

const createForm = (components: Record<string, any> = {}) => ({
  type: 'form',
  components: { title: { type: 'text' }, ...components }
})

const createList = (options: Record<string, any> = {}) => ({
  type: 'list',
  form: createForm(),
  ...options
})

const schema = createForm({ chapters: createList() })

describe('mergeData()', () => {
  it('keeps the identity of the target and its list items', () => {
    const one = { id: 1, title: 'One' }
    const two = { id: 2, title: 'Two' }
    const chapters = [one, two]
    const target = { title: 'Book', chapters }
    const result = mergeData(schema, target, {
      title: 'Saved',
      chapters: [
        { id: 1, title: 'First' },
        { id: 2, title: 'Second' }
      ]
    })
    expect(result).toBe(target)
    expect(target.chapters).toBe(chapters)
    expect(target.chapters[0]).toBe(one)
    expect(target.chapters[1]).toBe(two)
    expect(target).toEqual({
      title: 'Saved',
      chapters: [
        { id: 1, title: 'First' },
        { id: 2, title: 'Second' }
      ]
    })
  })

  it('matches list items by ids of other types', () => {
    const one = { id: '1', title: 'One' }
    const target = { chapters: [one] }
    mergeData(schema, target, { chapters: [{ id: 1, title: 'First' }] })
    expect(target.chapters[0]).toBe(one)
    expect(one).toEqual({ id: 1, title: 'First' })
  })

  it('matches list items by a custom `idKey`', () => {
    const one = { isbn: 'a', title: 'One' }
    const two = { isbn: 'b', title: 'Two' }
    const target = { chapters: [one, two] }
    mergeData(
      createForm({ chapters: createList({ idKey: 'isbn' }) }),
      target,
      {
        chapters: [
          { isbn: 'b', title: 'Second' },
          { isbn: 'a', title: 'First' }
        ]
      }
    )
    expect(target.chapters[0]).toBe(two)
    expect(target.chapters[1]).toBe(one)
    expect(two.title).toBe('Second')
    expect(one.title).toBe('First')
  })

  it('matches new items in order', () => {
    const one = { id: 1, title: 'One' }
    const first: Record<string, any> = { title: 'New 1' }
    const second = { id: '@1', title: 'New 2' }
    const target = { chapters: [first, one, second] }
    mergeData(schema, target, {
      chapters: [
        { id: 3, title: 'New 1' },
        { id: 1, title: 'One' },
        { id: 4, title: 'New 2' }
      ]
    })
    expect(target.chapters).toEqual([first, one, second])
    expect(first.id).toBe(3)
    expect(second.id).toBe(4)
  })

  it('matches new items with temporary ids by their ids', () => {
    const first = { id: '@1', title: 'New 1' }
    const second = { id: '@2', title: 'New 2' }
    const target = { chapters: [first, second] }
    mergeData(schema, target, {
      chapters: [
        { title: 'New 3' },
        { id: '@2', title: 'Second' }
      ]
    })
    expect(target.chapters[0]).toBe(first)
    expect(target.chapters[1]).toBe(second)
    expect(first).toEqual({ title: 'New 3' })
    expect(second).toEqual({ id: '@2', title: 'Second' })
  })

  it('removes and adds list items in the order of the source', () => {
    const one = { id: 1, title: 'One' }
    const two = { id: 2, title: 'Two' }
    const three = { id: 3, title: 'Three' }
    const four = { id: 4, title: 'Four' }
    const target = { chapters: [one, two, three] }
    mergeData(schema, target, {
      chapters: [{ id: 3, title: 'Three' }, four, { id: 1, title: 'One' }]
    })
    expect(target.chapters).toHaveLength(3)
    expect(target.chapters[0]).toBe(three)
    expect(target.chapters[1]).toBe(four)
    expect(target.chapters[2]).toBe(one)
  })

  it('replaces items whose type changed', () => {
    const blocksSchema = createForm({
      blocks: createList({
        form: undefined,
        forms: {
          text: createForm(),
          image: createForm({ src: { type: 'text' } })
        }
      }),
      cover: {
        type: 'object',
        forms: {
          text: createForm(),
          image: createForm({ src: { type: 'text' } })
        }
      }
    })
    const text = { id: 1, type: 'text', title: 'Text' }
    const other = { id: 2, type: 'text', title: 'Other' }
    const cover = { type: 'text', title: 'Cover' }
    const target = { blocks: [text, other], cover }
    const image = { id: 1, type: 'image', src: 'a.png' }
    const imageCover = { type: 'image', src: 'b.png' }
    mergeData(blocksSchema, target, {
      blocks: [image, { id: 2, type: 'text', title: 'Changed' }],
      cover: imageCover
    })
    expect(target.blocks[0]).toBe(image)
    expect(target.blocks[1]).toBe(other)
    expect(other.title).toBe('Changed')
    expect(target.cover).toBe(imageCover)
    expect(text).toEqual({ id: 1, type: 'text', title: 'Text' })
  })

  it('merges nested lists of list items', () => {
    const paragraph = { id: 10, title: 'Paragraph' }
    const paragraphs = [paragraph]
    const chapter = { id: 1, title: 'One', paragraphs }
    const target = { chapters: [chapter] }
    mergeData(
      createForm({
        chapters: createList({
          form: createForm({ paragraphs: createList() })
        })
      }),
      target,
      {
        chapters: [
          {
            id: 1,
            title: 'One',
            paragraphs: [{ id: 11 }, { id: 10, title: 'Text' }]
          }
        ]
      }
    )
    expect(target.chapters[0]).toBe(chapter)
    expect(chapter.paragraphs).toBe(paragraphs)
    expect(paragraphs[1]).toBe(paragraph)
    expect(paragraphs).toEqual([{ id: 11 }, { id: 10, title: 'Text' }])
  })

  it('merges the items of object sources in place', () => {
    const author = { id: 1, name: 'Author', born: 1900 }
    const target = { author }
    mergeData(
      createForm({
        author: {
          type: 'object',
          form: createForm({ name: { type: 'text' } })
        }
      }),
      target,
      { author: { id: 1, name: 'Writer' } }
    )
    expect(target.author).toBe(author)
    expect(author).toEqual({ id: 1, name: 'Writer' })
  })

  it('merges the components of sections and tabs once', () => {
    const one = { id: 1, title: 'One' }
    const target = { chapters: [one] }
    mergeData(
      {
        type: 'form',
        components: {
          main: {
            type: 'section',
            components: { chapters: createList() }
          }
        },
        tabs: {
          layout: { type: 'tab', components: { chapters: createList() } }
        }
      },
      target,
      { chapters: [{ title: 'New' }, { id: 1, title: 'First' }] }
    )
    expect(target.chapters).toEqual([{ title: 'New' }, one])
    expect(one.title).toBe('First')
  })

  it('removes the values that are missing in the source', () => {
    const one = { id: 1, title: 'One', note: 'Note' }
    const target = { title: 'Book', subtitle: 'Sub', chapters: [one] }
    mergeData(schema, target, { title: 'Book', chapters: [{ id: 1 }] })
    expect(target).toEqual({ title: 'Book', chapters: [{ id: 1 }] })
    expect(target.chapters[0]).toBe(one)
  })

  it('replaces sources whose values are no lists or objects', () => {
    const target: Record<string, any> = { chapters: null }
    const chapters = [{ id: 1 }]
    mergeData(schema, target, { chapters })
    expect(target.chapters).toBe(chapters)
    mergeData(schema, target, { chapters: null })
    expect(target.chapters).toBe(null)
  })

  it('keeps the data of sources with resources if asked to', () => {
    const chapters = [{ id: 1, title: 'One' }]
    const resourceSchema = createForm({
      chapters: createList({ resource: { path: 'chapters' } })
    })
    const target: Record<string, any> = { title: 'Book', chapters }
    mergeData(
      resourceSchema,
      target,
      { title: 'Saved', chapters: [] },
      { shouldKeepSourcesWithResource: true }
    )
    expect(target).toEqual({ title: 'Saved', chapters })
    expect(target.chapters).toBe(chapters)
    expect(chapters).toEqual([{ id: 1, title: 'One' }])
    mergeData(
      resourceSchema,
      target,
      { title: 'Saved' },
      { shouldKeepSourcesWithResource: true }
    )
    expect(target.chapters).toBe(chapters)
    mergeData(resourceSchema, target, { title: 'Saved' })
    expect(target).toEqual({ title: 'Saved' })
  })

  it('matches the items of copies by their uids', () => {
    const one = { title: 'One' }
    const two = { title: 'Two' }
    const target = { chapters: [one, two] }
    const copy = cloneWithUids(target)
    copy.chapters.reverse()
    copy.chapters[0].title = 'Second'
    copy.chapters.push({ title: 'Three' })
    mergeData(schema, target, copy, { shouldMatchUids: true })
    expect(target.chapters).toEqual([
      { title: 'Second' },
      { title: 'One' },
      { title: 'Three' }
    ])
    expect(target.chapters[0]).toBe(two)
    expect(target.chapters[1]).toBe(one)
  })

  it('keeps the uids of new items', () => {
    const listSchema = createList()
    const item = { title: 'New' }
    const uid = getItemUid(listSchema, item)
    const target = { chapters: [item] }
    mergeData(createForm({ chapters: listSchema }), target, {
      chapters: [{ id: 1, title: 'New' }]
    })
    expect(target.chapters[0]).toBe(item)
    expect(getItemUid(listSchema, target.chapters[0])).toBe(uid)
  })

  it('replaces primitives and values without nested schemas', () => {
    const tags = ['a']
    const meta = { size: 1 }
    const target = { title: 'Book', tags, meta }
    const source = { title: 'Saved', tags: ['a', 'b'], meta: { size: 2 } }
    mergeData(
      createForm({ tags: { type: 'tags' }, meta: { type: 'text' } }),
      target,
      source
    )
    expect(target.tags).toBe(source.tags)
    expect(target.meta).toBe(source.meta)
    expect(target.title).toBe('Saved')
  })

  it('replaces the values of lists of primitives in place', () => {
    const prices = [1, 2]
    const target = { prices }
    mergeData(
      createForm({
        prices: createList({
          wrapPrimitives: 'price',
          form: { type: 'form', components: { price: { type: 'text' } } }
        })
      }),
      target,
      { prices: [3, 1] }
    )
    expect(target.prices).toBe(prices)
    expect(prices).toEqual([3, 1])
  })
})
