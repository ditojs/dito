import { shallowRef } from 'vue'

// Only targets let files be dropped, so the browser doesn't open files dropped
// elsewhere.

export class FileDropTargets {
  #targets = new Set()
  #isDraggingFiles = shallowRef(false)
  // `dragenter` and `dragleave` are triggered for each element:
  #enteredElementCount = 0

  get isDraggingFiles() {
    return this.#isDraggingFiles.value
  }

  get hasTargets() {
    return this.#targets.size > 0
  }

  add(element) {
    this.#targets.add(element)
    return () => {
      this.#targets.delete(element)
    }
  }

  isInTarget(node) {
    for (const target of this.#targets) {
      if (target.contains(node)) {
        return true
      }
    }
    return false
  }

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
        // Prevent the browser from opening the files:
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
