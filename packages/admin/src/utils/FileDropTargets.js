import { shallowRef } from 'vue'

// FileDropTargets tracks the files that are dragged over the document, and the
// elements that accept them, e.g. the ones of `DitoTypeUpload`, which handle
// the dropped files themselves. The root of the admin creates one instance and
// passes it the drag events of the document, see `DitoRoot`. A drag of files
// only begins while there are targets, and only targets let files be dropped,
// so that the browser doesn't open files dropped elsewhere.
// `isDraggingFiles` is reactive.

export class FileDropTargets {
  #targets = new Set()
  #isDraggingFiles = shallowRef(false)
  // The number of elements that the drag entered and didn't leave yet, as
  // `dragenter` and `dragleave` are triggered for each element.
  #enteredElementCount = 0

  get isDraggingFiles() {
    return this.#isDraggingFiles.value
  }

  get hasTargets() {
    return this.#targets.size > 0
  }

  // Adds `element` as a target, and returns the function that removes it.
  add(element) {
    this.#targets.add(element)
    return () => {
      this.#targets.delete(element)
    }
  }

  // Returns whether `node` is a target or inside one.
  isInTarget(node) {
    for (const target of this.#targets) {
      if (target.contains(node)) {
        return true
      }
    }
    return false
  }

  // Returns the handlers of the drag events of the document, to be added to it
  // by the owner of the instance.
  getDocumentEventHandlers() {
    return {
      dragenter: event => this.#onDragEnter(event),
      dragleave: event => this.#onDragLeave(event),
      dragover: event => this.#onDragOver(event),
      drop: event => this.#onDrop(event)
    }
  }

  #onDragEnter(event) {
    if (isDraggingFiles(event)) {
      this.#enteredElementCount++
      if (this.#enteredElementCount === 1 && this.hasTargets) {
        this.#isDraggingFiles.value = true
      }
    }
  }

  #onDragLeave(event) {
    if (isDraggingFiles(event) && this.#enteredElementCount > 0) {
      this.#enteredElementCount--
      if (this.#enteredElementCount === 0) {
        this.#isDraggingFiles.value = false
      }
    }
  }

  #onDragOver(event) {
    if (isDraggingFiles(event)) {
      if (this.isInTarget(event.target)) {
        // The target allows the drop by preventing the default itself.
        event.dataTransfer.dropEffect = 'copy'
      } else {
        // Prevent the default, which opens the files in the browser, and show
        // that they can't be dropped here instead.
        event.preventDefault()
        event.dataTransfer.dropEffect = 'none'
      }
    }
  }

  #onDrop(event) {
    if (isDraggingFiles(event)) {
      this.#enteredElementCount = 0
      this.#isDraggingFiles.value = false
    }
  }
}

function isDraggingFiles(event) {
  return !!event.dataTransfer?.types?.includes('Files')
}
