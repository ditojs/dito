import { computed } from 'vue'
import { LoadingTracker, LoadingSwitch } from './LoadingTracker.js'

describe('LoadingTracker', () => {
  it('is loading until all operations ended', () => {
    const tracker = new LoadingTracker()
    expect(tracker.isLoading).toBe(false)
    const endFirst = tracker.begin()
    const endSecond = tracker.begin()
    endFirst()
    expect(tracker.isLoading).toBe(true)
    endSecond()
    expect(tracker.isLoading).toBe(false)
  })

  it('ignores ending an operation more than once', () => {
    const tracker = new LoadingTracker()
    const endFirst = tracker.begin()
    tracker.begin()
    endFirst()
    endFirst()
    expect(tracker.isLoading).toBe(true)
  })

  it('forwards operations to the enclosing scopes', () => {
    const root = new LoadingTracker()
    const view = new LoadingTracker(root)
    const list = new LoadingTracker(view)
    const end = list.begin()
    expect([root.isLoading, view.isLoading, list.isLoading]).toEqual([
      true,
      true,
      true
    ])
    end()
    expect([root.isLoading, view.isLoading, list.isLoading]).toEqual([
      false,
      false,
      false
    ])
  })

  it(`doesn't forward operations to nested scopes`, () => {
    const root = new LoadingTracker()
    const view = new LoadingTracker(root)
    root.begin()
    expect(view.isLoading).toBe(false)
  })

  it('returns the tracker of the outermost scope', () => {
    const root = new LoadingTracker()
    const view = new LoadingTracker(root)
    expect(new LoadingTracker(view).root).toBe(root)
    expect(root.root).toBe(root)
  })

  it('tracks async callbacks until they settle', async () => {
    const tracker = new LoadingTracker()
    let reject
    const tracked = tracker.track(
      () => new Promise((resolve, rejectPromise) => (reject = rejectPromise))
    )
    expect(tracker.isLoading).toBe(true)
    reject(new Error('Failed'))
    await expect(tracked).rejects.toThrow('Failed')
    expect(tracker.isLoading).toBe(false)
  })

  it('is reactive', () => {
    const tracker = new LoadingTracker()
    const isLoading = computed(() => tracker.isLoading)
    expect(isLoading.value).toBe(false)
    const end = tracker.begin()
    expect(isLoading.value).toBe(true)
    end()
    expect(isLoading.value).toBe(false)
  })
})

describe('LoadingSwitch', () => {
  it('begins one operation while switched on', () => {
    const tracker = new LoadingTracker()
    const loadingSwitch = new LoadingSwitch(tracker)
    const end = tracker.begin()
    loadingSwitch.set(true)
    loadingSwitch.set(true)
    expect(loadingSwitch.isOn).toBe(true)
    end()
    expect(tracker.isLoading).toBe(true)
    loadingSwitch.set(false)
    expect(loadingSwitch.isOn).toBe(false)
    expect(tracker.isLoading).toBe(false)
  })

  it(`doesn't end other operations when switched off again`, () => {
    const tracker = new LoadingTracker()
    const loadingSwitch = new LoadingSwitch(tracker)
    tracker.begin()
    loadingSwitch.set(true)
    loadingSwitch.set(false)
    loadingSwitch.set(false)
    expect(tracker.isLoading).toBe(true)
  })
})
