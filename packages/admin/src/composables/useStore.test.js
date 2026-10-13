import { reactive } from 'vue'
import { useStore } from './useStore.ts'

describe('useStore()', () => {
  it('creates the stores of the children once, in the store', () => {
    const store = reactive({})
    const { getChildStore } = useStore({ store })
    const chapters = getChildStore('chapters')
    expect(chapters).toEqual({})
    expect(getChildStore('chapters')).toBe(chapters)
    expect(store.chapters).toBe(chapters)
  })

  it('reads values of the store with defaults, and writes them', () => {
    const store = reactive({})
    const opened = useStore({ store }).getStoreRef('opened', () => false)
    expect(opened.value).toBe(false)
    opened.value = true
    expect(store.opened).toBe(true)
    expect(opened.value).toBe(true)
  })
})
