// Emit the change of an edited value only once the editing is done, e.g. on
// blur. Values changed by code don't emit, as only `markEdited()` edits count.
export function createChangeOnceEdited({ isEditing, emitChange }) {
  let isEdited = false

  return {
    markEdited() {
      isEdited = true
    },

    // Call after each edit and whenever the editing may have ended:
    emitIfDone() {
      if (isEdited && !isEditing()) {
        isEdited = false
        emitChange()
      }
    },

    // Forget edits replaced by a value that emits its own change:
    reset() {
      isEdited = false
    }
  }
}
