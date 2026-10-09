import { vi } from 'vitest'
import { createChangeOnceEdited } from './changeOnceEdited.js'

function createTracker() {
  const state = { isEditing: true }
  const emitChange = vi.fn()
  const changeOnceEdited = createChangeOnceEdited({
    isEditing: () => state.isEditing,
    emitChange
  })
  return { state, emitChange, changeOnceEdited }
}

describe('createChangeOnceEdited()', () => {
  it(`doesn't emit while the editing is ongoing`, () => {
    const { emitChange, changeOnceEdited } = createTracker()
    changeOnceEdited.markEdited()
    changeOnceEdited.emitIfDone()
    expect(emitChange).not.toHaveBeenCalled()
  })

  it('emits once after the editing is done', () => {
    const { state, emitChange, changeOnceEdited } = createTracker()
    changeOnceEdited.markEdited()
    changeOnceEdited.markEdited()
    state.isEditing = false
    changeOnceEdited.emitIfDone()
    changeOnceEdited.emitIfDone()
    expect(emitChange).toHaveBeenCalledTimes(1)
  })

  it(`doesn't emit without edits`, () => {
    const { state, emitChange, changeOnceEdited } = createTracker()
    state.isEditing = false
    changeOnceEdited.emitIfDone()
    expect(emitChange).not.toHaveBeenCalled()
  })

  it('forgets the edits on reset', () => {
    const { state, emitChange, changeOnceEdited } = createTracker()
    changeOnceEdited.markEdited()
    changeOnceEdited.reset()
    state.isEditing = false
    changeOnceEdited.emitIfDone()
    expect(emitChange).not.toHaveBeenCalled()
  })
})
