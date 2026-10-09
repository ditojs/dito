// Emits the change of a value that the user edits only once the editing is
// done, e.g. once the input lost its focus, and not on every edit while it is
// still ongoing. Values changed by code don't emit change events, as only the
// edits marked through `markEdited()` count.
// `isEditing()` returns whether the editing is still ongoing, and
// `emitChange()` emits the change event.
export function createChangeOnceEdited({ isEditing, emitChange }) {
  // Whether the value was edited since the last change event. Not reactive,
  // as nothing renders it.
  let isEdited = false

  return {
    // Marks the value as edited, to emit its change once the editing is done.
    markEdited() {
      isEdited = true
    },

    // Emits the change if the value was edited and the editing is done. Call
    // it after each edit and whenever the editing may have ended, e.g. on blur.
    emitIfDone() {
      if (isEdited && !isEditing()) {
        isEdited = false
        emitChange()
      }
    },

    // Forgets the edits, e.g. when they are replaced by a value that emits its
    // own change event.
    reset() {
      isEdited = false
    }
  }
}
