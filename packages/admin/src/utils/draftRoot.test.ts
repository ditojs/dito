import { effect, isReadonly, reactive, readonly, watch, nextTick } from 'vue'
import { clone } from '@ditojs/utils'
import { createDraftRoot } from './draftRoot.ts'

const createData = () =>
  reactive({
    title: 'Book',
    meta: { year: 2026 },
    chapters: [
      { id: 1, title: 'One', notes: [] as any[] },
      {
        id: 2,
        title: 'Two',
        contents: {
          notes: [
            { id: 3, text: 'First' },
            { id: 4, text: 'Second' }
          ]
        }
      },
      { id: 5, title: 'Three' }
    ]
  })

const toPlainData = (data: object) => JSON.parse(JSON.stringify(data))

describe('createDraftRoot()', () => {
  it('returns the draft for empty paths', () => {
    const draft = reactive({ id: 1 })
    expect(createDraftRoot(createData(), '', draft)).toBe(draft)
  })

  it('resolves the path to the draft at list indexes', () => {
    const data = createData()
    const draft = reactive(clone(data.chapters[1]))
    const root = createDraftRoot(data, 'chapters/1', draft)
    expect(root.chapters[1]).toBe(draft)
    expect(root.chapters[0]).toEqual(data.chapters[0])
    expect(root.chapters[2].title).toBe('Three')
  })

  it('resolves the path to the draft at object keys', () => {
    const data = reactive({ title: 'Book', settings: { color: 'red' } })
    const draft = reactive({ color: 'blue' })
    const root = createDraftRoot(data, 'settings', draft)
    expect(root.settings).toBe(draft)
    expect(root.title).toBe('Book')
  })

  it('resolves nested paths through lists and objects', () => {
    const data = createData()
    const draft = reactive(clone(data.chapters[1].contents!.notes[1]))
    const root = createDraftRoot(data, 'chapters/1/contents/notes/1', draft)
    const { contents } = root.chapters[1]
    expect(contents!.notes[1]).toBe(draft)
    expect(contents!.notes[0].text).toBe('First')
    expect(root.chapters[1].title).toBe('Two')
  })

  it('reads the parent data outside the draft live', () => {
    const data = createData()
    const root = createDraftRoot(data, 'chapters/1', reactive({}))
    const titles: string[] = []
    effect(() => titles.push(`${root.title}: ${root.chapters[0].title}`))
    data.title = 'Novel'
    data.chapters[0].title = 'Start'
    expect(titles).toEqual(['Book: One', 'Novel: One', 'Novel: Start'])
  })

  it('watches lists on the path for changes', async () => {
    const data = createData()
    const root = createDraftRoot(data, 'chapters/1', reactive({}))
    const lengths: number[] = []
    watch(
      () => root.chapters.length,
      length => lengths.push(length)
    )
    data.chapters.push({ id: 6, title: 'Four' })
    await nextTick()
    expect(lengths).toEqual([4])
    expect(root.chapters[3].title).toBe('Four')
  })

  it('reads and writes the draft reactively', async () => {
    const data = createData()
    const draft = reactive(clone(data.chapters[1]))
    const root = createDraftRoot(data, 'chapters/1', draft)
    const titles: string[] = []
    watch(
      () => root.chapters[1].title,
      title => titles.push(title)
    )
    root.chapters[1].title = 'Second'
    await nextTick()
    expect(titles).toEqual(['Second'])
    expect(draft.title).toBe('Second')
    root.chapters[1].contents!.notes.push({ id: 7, text: 'Third' })
    expect(draft.contents!.notes).toHaveLength(3)
  })

  it('ignores writes outside the draft with a warning', () => {
    // Vue reports writes to readonly data through `console.warn()`, which we
    // spy on to check and silence them:
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data = createData()
    const root = createDraftRoot(data, 'chapters/1', reactive({}))
    root.title = 'Novel'
    root.meta.year = 2027
    root.chapters[0].title = 'Start'
    root.chapters[1] = { id: 8, title: 'Other' }
    // Pushing warns twice, about the new index and the length:
    root.chapters.push({ id: 9, title: 'Four' })
    delete (root as any).meta
    delete (root.chapters as any)[1]
    expect(warn).toHaveBeenCalledTimes(8)
    expect(warn.mock.calls[0][0]).toMatch(/target is readonly/)
    expect(warn.mock.calls[6][0]).toMatch(/Delete operation/)
    warn.mockRestore()
    expect(toPlainData(data)).toEqual(toPlainData(createData()))
  })

  it('never mutates the parent data', () => {
    const data = createData()
    const original = toPlainData(data)
    const draft = reactive(clone(data.chapters[1].contents!.notes[0]))
    const root = createDraftRoot(data, 'chapters/1/contents/notes/0', draft)
    root.chapters[1].contents!.notes[0].text = 'Changed'
    expect(toPlainData(root.chapters[1].contents!.notes)).toEqual([
      { id: 3, text: 'Changed' },
      { id: 4, text: 'Second' }
    ])
    expect(toPlainData(data)).toEqual(original)
  })

  it('returns the same objects across reads', () => {
    const data = createData()
    const root = createDraftRoot(data, 'chapters/1/contents/notes/0', {})
    expect(root.chapters).toBe(root.chapters)
    expect(root.chapters[1]).toBe(root.chapters[1])
    expect(root.chapters[1].contents).toBe(root.chapters[1].contents)
    expect(root.meta).toBe(root.meta)
    expect(root.meta).toBe(readonly(data.meta))
    expect(root.chapters[0]).toBe(root.chapters[0])
  })

  it('keeps the length and iteration of lists on the path', () => {
    const data = createData()
    const draft = reactive(clone(data.chapters[1]))
    const root = createDraftRoot(data, 'chapters/1', draft)
    const { chapters } = root
    expect(Array.isArray(chapters)).toBe(true)
    expect(chapters).toHaveLength(3)
    expect(chapters.map(chapter => chapter.title)).toEqual([
      'One',
      'Two',
      'Three'
    ])
    expect(chapters.map(chapter => chapter)[1]).toBe(draft)
    expect(chapters.find(chapter => chapter.id === 2)).toBe(draft)
    expect(chapters.indexOf(draft)).toBe(1)
    expect(chapters.includes(data.chapters[1])).toBe(false)
    expect([...chapters][1]).toBe(draft)
    expect(Object.keys(chapters)).toEqual(['0', '1', '2'])
  })

  it('marks the data outside the draft as readonly', () => {
    const data = createData()
    const draft = reactive({})
    const root = createDraftRoot(data, 'chapters/1', draft)
    expect(isReadonly(root)).toBe(true)
    expect(isReadonly(root.chapters)).toBe(true)
    expect(isReadonly(root.chapters[0])).toBe(true)
    expect(isReadonly(root.chapters[1])).toBe(false)
    // Wrapping the root again keeps the redirect:
    expect(reactive(root)).toBe(root)
    expect(readonly(root)).toBe(root)
  })

  it('composes over the root of a parent draft', () => {
    const data = createData()
    const chapter = reactive(clone(data.chapters[1]))
    const parentRoot = createDraftRoot(data, 'chapters/1', chapter)
    const note = reactive(clone(chapter.contents!.notes[0]))
    const root = createDraftRoot(
      parentRoot,
      'chapters/1/contents/notes/0',
      note
    )
    expect(root.chapters[1].contents!.notes[0]).toBe(note)
    expect(root.chapters[1].contents!.notes[1]).toBe(
      readonly(chapter.contents!.notes[1])
    )
    expect(isReadonly(root.chapters[1])).toBe(true)
    expect(chapter.contents!.notes[0]).not.toBe(note)
  })
})
